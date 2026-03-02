const FILE_NAME = "ทะเบียนคุมบันทึกการปรับปรุงรายการบัญชี.csv";

const HEADER = [
  "วันเดือนปี","เลขที่เอกสาร","รายการ",
  "RE","JR","JV","PP",
  "จำนวนเงิน",
  "Dr","Cr","หมายเหตุ"
];

const DATA_CACHE_KEY = "rows_cache_v1";
const DATA_CACHE_TTL = 120; // seconds
const AUDIT_FILE_NAME = "ทะเบียนคุม_audit_log.csv";

function doGet() {
  return HtmlService.createHtmlOutputFromFile("index");
}

/* LOGIN */
function login(password) {
  const pw = String(password || "").trim();
  if (pw === "0000") return "admin";
  if (pw === "1111") return "user";
  return "";
}

/* FILE */
function getFile() {
  const files = DriveApp.getFilesByName(FILE_NAME);
  if (files.hasNext()) return files.next();

  return DriveApp.createFile(
    FILE_NAME,
    "\uFEFF" + HEADER.join(",") + "\n",
    MimeType.CSV
  );
}

function readAll() {
  const cached = getRowsFromCache();
  if (cached && cached.length) return cached;

  const content = getFile().getBlob().getDataAsString("UTF-8");
  const rows = Utilities.parseCsv(content || "");
  const safe = (!rows || rows.length === 0) ? [HEADER] : rows;
  putRowsToCache(safe);
  return safe;
}

function toCsvLine(row) {
  return row.map(function(v){
    const s = String(v == null ? "" : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(",");
}

function saveAll(rows) {
  const safeRows = (rows && rows.length) ? rows : [HEADER];
  const content = "\uFEFF" + safeRows.map(toCsvLine).join("\n");
  getFile().setContent(content);
  clearRowsCache();
}

function getRowsFromCache(){
  try{
    const cache = CacheService.getScriptCache();
    const s = cache.get(DATA_CACHE_KEY);
    if(!s) return null;
    const rows = JSON.parse(s);
    return Array.isArray(rows) ? rows : null;
  }catch(e){
    return null;
  }
}

function putRowsToCache(rows){
  try{
    const cache = CacheService.getScriptCache();
    const s = JSON.stringify(rows);
    // หลีกเลี่ยงเกินขนาด cache 100KB โดยประมาณ
    if(s.length < 90000){
      cache.put(DATA_CACHE_KEY, s, DATA_CACHE_TTL);
    }
  }catch(e){}
}

function clearRowsCache(){
  try{
    CacheService.getScriptCache().remove(DATA_CACHE_KEY);
  }catch(e){}
}

/* CRUD */
function addRow(row) {
  const valid = validateAndCheckDuplicate(row, null);
  if (!valid.ok) throw new Error("ข้อมูลไม่ผ่านการตรวจสอบ: " + valid.errors.join(", "));
  const rows = readAll();
  rows.push(row);
  saveAll(rows);
  appendAudit("ADD", { row: row });
}

function updateRow(index, row) {
  const valid = validateAndCheckDuplicate(row, index);
  if (!valid.ok) throw new Error("ข้อมูลไม่ผ่านการตรวจสอบ: " + valid.errors.join(", "));
  const rows = readAll();
  if (index <= 0 || index >= rows.length) throw new Error("ไม่พบแถวที่ต้องการแก้ไข");
  rows[index] = row;
  saveAll(rows);
  appendAudit("UPDATE", { index: index, row: row });
}

function deleteRow(index) {
  const rows = readAll();
  if (index <= 0 || index >= rows.length) throw new Error("ไม่พบแถวที่ต้องการลบ");
  const deleted = rows[index];
  rows.splice(index, 1);
  saveAll(rows);
  appendAudit("DELETE", { index: index, row: deleted });
}

function deleteRows(indexes){
  const rows = readAll();
  const deleted = [];
  const sorted = (indexes || []).filter(Number.isInteger).sort(function(a,b){ return b-a; });
  sorted.forEach(function(i){
    if(i > 0 && i < rows.length){
      deleted.push({ index: i, row: rows[i] });
      rows.splice(i,1);
    }
  });
  saveAll(rows);
  appendAudit("DELETE_MULTI", { indexes: sorted, deleted: deleted });
}

function readAllData(){
  return readAll();
}

/* IMPORT */
function importData(obj){
  const name = obj && obj.name ? obj.name.toLowerCase() : "";
  const data = obj && obj.data ? obj.data : "";
  const encoding = obj && obj.encoding ? String(obj.encoding) : "";
  if(!name || !data) throw new Error("ไม่มีข้อมูลไฟล์");

  if(name.endsWith(".csv")){
    replaceCSV(data);
    appendAudit("IMPORT_CSV", { file: name });
    return "ok";
  }
  if(name.endsWith(".xlsx")){
    replaceXLSX(data, encoding);
    appendAudit("IMPORT_XLSX", { file: name });
    return "ok";
  }
  throw new Error("รองรับเฉพาะ .csv หรือ .xlsx");
}

function replaceCSV(content){
  const rows = Utilities.parseCsv(content);
  if (!rows || rows.length === 0) throw new Error("ไฟล์ว่าง");
  validateHeader(rows[0]);
  mergeAndSave(rows.slice(1));
}

function replaceXLSX(rawData, encoding){
  let blob;
  if(encoding === "base64"){
    const base64 = String(rawData).split(",").pop();
    const bytes = Utilities.base64Decode(base64);
    blob = Utilities.newBlob(bytes, "application/zip", "upload.xlsx");
  }else{
    blob = Utilities.newBlob(rawData, "application/zip", "upload.xlsx");
  }
  const rows = parseXlsxToRows(blob);
  if (!rows || rows.length === 0) throw new Error("ไฟล์ว่าง");
  validateHeader(rows[0]);
  mergeAndSave(rows.slice(1));
}

function validateHeader(fileHeader){
  const cleaned = fileHeader.map(normalizeHeaderText);
  const expected = HEADER.map(normalizeHeaderText);
  for (let i = 0; i < expected.length; i++) {
    if (!headerCellMatches(cleaned[i], expected[i])) {
      throw new Error(
        "หัวตารางไม่ตรงคอลัมน์ที่ " + (i + 1) +
        " (ต้องเป็น: " + HEADER[i] + ", แต่พบ: " + (fileHeader[i] || "") + ")"
      );
    }
  }
}

function mergeAndSave(newRows){
  const existing = readAll();
  const merged = existing.concat(newRows);
  const sorted = sortByDateAsc(merged);
  saveAll(sorted);
}

function sortByDateAsc(rows){
  if (!rows || rows.length <= 1) return rows || [HEADER];
  const header = rows[0];
  const data = rows.slice(1);

  data.sort(function(a, b){
    const da = parseDateDMY(a[0]);
    const db = parseDateDMY(b[0]);
    if (da && db) return da - db;
    if (da && !db) return -1;
    if (!da && db) return 1;
    return 0;
  });

  return [header].concat(data);
}

function parseDateDMY(value){
  const s = String(value || "").trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  let y = parseInt(m[3], 10);
  // รองรับปี พ.ศ.
  if (y >= 2400) y -= 543;
  const dt = new Date(y, mo, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return dt.getTime();
}

function parseXlsxToRows(blob){
  const parts = Utilities.unzip(blob);
  let sheetXml = null, sstXml = null;
  parts.forEach(function(b){
    if(b.getName() === "xl/worksheets/sheet1.xml") sheetXml = b.getDataAsString();
    if(b.getName() === "xl/sharedStrings.xml") sstXml = b.getDataAsString();
  });
  if(!sheetXml){
    // fallback: ใช้ worksheet ตัวแรกที่หาเจอ
    const ws = parts.filter(function(b){
      return /^xl\/worksheets\/sheet\d+\.xml$/.test(b.getName());
    }).sort(function(a,b){ return a.getName() > b.getName() ? 1 : -1; });
    if(ws.length > 0) sheetXml = ws[0].getDataAsString();
  }
  if(!sheetXml) throw new Error("ไม่พบข้อมูลชีตในไฟล์ xlsx");

  const sst = [];
  if(sstXml){
    const docSst = XmlService.parse(sstXml);
    const root = docSst.getRootElement();
    const ns = root.getNamespace();
    root.getChildren("si", ns).forEach(function(si){
      const t = si.getChild("t", ns);
      if(t){ sst.push(t.getText()); return; }
      const runs = si.getChildren("r", ns);
      sst.push(runs.map(function(rn){
        const tt = rn.getChild("t", ns);
        return tt ? tt.getText() : "";
      }).join(""));
    });
  }

  function colIndex(ref){
    const letters = ref.replace(/\d+/g, "");
    let n = 0;
    for(let i=0;i<letters.length;i++){
      n = n*26 + (letters.charCodeAt(i)-64);
    }
    return n-1;
  }
  function cellText(c, ns){
    const tAttr = c.getAttribute("t");
    const v = c.getChild("v", ns);
    const isNode = c.getChild("is", ns);
    const tVal = tAttr ? tAttr.getValue() : "";
    if(tVal === "s"){
      const idx = v ? parseInt(v.getText(),10) : -1;
      return idx >=0 ? (sst[idx] || "") : "";
    }
    if(tVal === "inlineStr"){
      if(isNode){
        const t = isNode.getChild("t", ns);
        if(t) return t.getText();
      }
      return "";
    }
    return v ? v.getText() : "";
  }

  const doc = XmlService.parse(sheetXml);
  const ns = doc.getRootElement().getNamespace();
  const sheetData = doc.getRootElement().getChild("sheetData", ns);
  if(!sheetData) return [];
  const rowNodes = sheetData.getChildren("row", ns);

  const rows = [];
  rowNodes.forEach(function(rn){
    const cells = rn.getChildren("c", ns);
    let maxCol = 0;
    cells.forEach(function(c){
      const ref = c.getAttribute("r");
      if(ref){
        const ci = colIndex(ref.getValue());
        if(ci > maxCol) maxCol = ci;
      }
    });
    const arr = new Array(maxCol+1).fill("");
    cells.forEach(function(c){
      const ref = c.getAttribute("r");
      const ci = ref ? colIndex(ref.getValue()) : 0;
      arr[ci] = cellText(c, ns);
    });
    rows.push(arr);
  });
  return rows;
}

function normalizeHeaderText(v){
  return String(v || "")
    .replace(/^\uFEFF/, "")
    .replace(/^'+/, "")
    .replace(/[“”"']/g, "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
}

function headerCellMatches(actual, expected){
  if (actual === expected) return true;
  const aliases = {
    "วันเดือนปี": ["วันที่"],
    "จำนวนเงิน": ["จำนวนเงิน(บาท)", "ยอดเงิน", "จำนวนเงินบาท"],
    "dr": ["เดบิต"],
    "cr": ["เครดิต"]
  };
  const key = Object.keys(aliases).find(function(k){
    return normalizeHeaderText(k) === expected;
  });
  if (!key) return false;
  return aliases[key].some(function(a){
    return normalizeHeaderText(a) === actual;
  });
}

/* EXPORT */
function downloadSelected(indexes) {
  const all = readAll();
  if (!all || all.length === 0) {
    return { name:"export.xlsx", type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", data:"" };
  }

  const header = all[0];
  const rows = (indexes || []).map(function(i){ return all[i]; }).filter(Boolean);
  const dataRows = [header].concat(rows);

  const xlsxBlob = buildXlsx(dataRows);
  return {
    name: "ทะเบียนคุม_ส่งออก.xlsx",
    type: xlsxBlob.getContentType(),
    data: Utilities.base64Encode(xlsxBlob.getBytes())
  };
}

/* VALIDATION + DUPLICATE */
function validateAndCheckDuplicate(row, editIndex){
  const errors = [];
  const date = String((row && row[0]) || "").trim();
  const doc = String((row && row[1]) || "").trim();
  const item = String((row && row[2]) || "").trim();
  const amountRaw = String((row && row[7]) || "").trim();
  const drRaw = String((row && row[8]) || "").trim();
  const crRaw = String((row && row[9]) || "").trim();

  if (!date) errors.push("วันที่ห้ามว่าง");
  if (date && !parseDateToObject(date)) errors.push("วันที่ไม่ถูกต้อง ต้องเป็นรูปแบบ dd/mm/yyyy");
  if (!doc) errors.push("เลขที่เอกสารห้ามว่าง");
  if (!item) errors.push("รายการห้ามว่าง");
  if (!amountRaw) errors.push("จำนวนเงินห้ามว่าง");

  const amount = toNumber(amountRaw);
  if (amountRaw && isNaN(parseFloat(amountRaw.replace(/,/g, "")))) errors.push("จำนวนเงินต้องเป็นตัวเลข");
  if (amount < 0) errors.push("จำนวนเงินต้องไม่ติดลบ");

  if (drRaw && isNaN(parseFloat(drRaw.replace(/,/g, "")))) errors.push("Dr ต้องเป็นตัวเลข");
  if (crRaw && isNaN(parseFloat(crRaw.replace(/,/g, "")))) errors.push("Cr ต้องเป็นตัวเลข");

  const dup = findDuplicateRow(row, editIndex);
  return {
    ok: errors.length === 0,
    errors: errors,
    duplicate: !!dup,
    duplicateRow: dup
  };
}

function findDuplicateRow(row, editIndex){
  const rows = readAll();
  const keyDate = String((row && row[0]) || "").trim();
  const keyDoc = String((row && row[1]) || "").trim().toLowerCase();
  const keyAmt = Number(toNumber((row && row[7]) || "")).toFixed(2);
  if (!keyDate || !keyDoc) return null;

  for (let i = 1; i < rows.length; i++){
    if (editIndex !== null && editIndex !== undefined && i === Number(editIndex)) continue;
    const d = String(rows[i][0] || "").trim();
    const doc = String(rows[i][1] || "").trim().toLowerCase();
    const amt = Number(toNumber(rows[i][7] || "")).toFixed(2);
    if (d === keyDate && doc === keyDoc && amt === keyAmt){
      return i;
    }
  }
  return null;
}

/* MONTHLY SUMMARY */
function getMonthlySummary(month, year){
  const m = Number(month);
  let y = Number(year);
  if (!m || m < 1 || m > 12) throw new Error("เดือนไม่ถูกต้อง");
  if (y >= 2400) y -= 543;

  const all = readAll();
  const rows = all.slice(1).filter(function(r){
    const dt = parseDateToObject(r[0]);
    return dt && dt.getMonth() === (m - 1) && dt.getFullYear() === y;
  });

  const result = {
    count: rows.length,
    total: formatMoney(sumColumn(rows, 7)),
    re: formatMoney(sumByType(rows, 3)),
    jr: formatMoney(sumByType(rows, 4)),
    jv: formatMoney(sumByType(rows, 5)),
    pp: formatMoney(sumByType(rows, 6)),
    dr: formatMoney(sumColumn(rows, 8)),
    cr: formatMoney(sumColumn(rows, 9))
  };

  appendAudit("MONTHLY_SUMMARY", { month: m, year: y, count: result.count });
  return result;
}

/* AUDIT LOG */
function getAuditFile(){
  const files = DriveApp.getFilesByName(AUDIT_FILE_NAME);
  if (files.hasNext()) return files.next();
  const header = "\uFEFF" + ["เวลา","ผู้ใช้","การกระทำ","รายละเอียด(JSON)"].join(",") + "\n";
  return DriveApp.createFile(AUDIT_FILE_NAME, header, MimeType.CSV);
}

function appendAudit(action, payload){
  try{
    const file = getAuditFile();
    const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    const user = Session.getActiveUser().getEmail() || "anonymous";
    const detail = safeJson(payload);
    const line = toCsvLine([now, user, action, detail]);
    const old = file.getBlob().getDataAsString("UTF-8");
    file.setContent(old + line + "\n");
  }catch(e){
    // ไม่ให้ล้มธุรกรรมหลักถ้า log มีปัญหา
  }
}

function safeJson(v){
  try{
    return JSON.stringify(v || {});
  }catch(e){
    return "{}";
  }
}

function buildXlsx(rows){
  function colName(n){
    let s = "", r = n;
    while(r > 0){ const m = (r-1)%26; s = String.fromCharCode(65+m) + s; r = Math.floor((r-1)/26); }
    return s;
  }
  function esc(s){
    return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;");
  }
  const sheetRows = [];
  for (let r=0; r<rows.length; r++){
    const cells = [];
    for (let c=0; c<rows[r].length; c++){
      const ref = colName(c+1)+(r+1);
      const v = esc(rows[r][c]);
      cells.push('<c r="'+ref+'" t="inlineStr"><is><t>'+v+'</t></is></c>');
    }
    sheetRows.push('<row r="'+(r+1)+'">'+cells.join('')+'</row>');
  }

  const sheetXml = '<?xml version="1.0" encoding="UTF-8"?>'
    +'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    +'<sheetData>'+sheetRows.join('')+'</sheetData></worksheet>';

  const workbookXml = '<?xml version="1.0" encoding="UTF-8"?>'
    +'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
    +'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    +'<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>';

  const relsWorkbook = '<?xml version="1.0" encoding="UTF-8"?>'
    +'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    +'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
    +'<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    +'</Relationships>';

  const relsRoot = '<?xml version="1.0" encoding="UTF-8"?>'
    +'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    +'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
    +'</Relationships>';

  const stylesXml = '<?xml version="1.0" encoding="UTF-8"?>'
    +'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    +'<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>'
    +'<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
    +'<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
    +'<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    +'<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>'
    +'<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
    +'</styleSheet>';

  const contentTypes = '<?xml version="1.0" encoding="UTF-8"?>'
    +'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    +'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    +'<Default Extension="xml" ContentType="application/xml"/>'
    +'<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    +'<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    +'<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    +'</Types>';

  const blobs = [
    Utilities.newBlob(contentTypes, 'application/xml', '[Content_Types].xml'),
    Utilities.newBlob(relsRoot, 'application/xml', '_rels/.rels'),
    Utilities.newBlob(workbookXml, 'application/xml', 'xl/workbook.xml'),
    Utilities.newBlob(relsWorkbook, 'application/xml', 'xl/_rels/workbook.xml.rels'),
    Utilities.newBlob(sheetXml, 'application/xml', 'xl/worksheets/sheet1.xml'),
    Utilities.newBlob(stylesXml, 'application/xml', 'xl/styles.xml')
  ];

  return Utilities.zip(blobs, "workbook.zip").setName("workbook.xlsx");
}

function toNumber(v){
  const n = parseFloat(String(v == null ? "" : v).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

function sumColumn(data, col){
  return data.reduce(function(s, r){ return s + toNumber(r[col]); }, 0);
}

function sumByType(data, typeCol){
  return data.reduce(function(s, r){
    if (String(r[typeCol] || "").trim() !== "") s += toNumber(r[7]);
    return s;
  }, 0);
}

function parseDateToObject(value){
  const s = String(value || "").trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  let y = parseInt(m[3], 10);
  if (y >= 2400) y -= 543;
  const dt = new Date(y, mo, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return dt;
}

function formatMoney(n){
  return Utilities.formatString("%,.2f", n || 0);
}
