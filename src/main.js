const STORAGE_KEY = "accounting_register_records_v1";

const FIELD_ORDER = [
  "วันที่",
  "รายการ",
  "เลขที่เอกสาร",
  "RE",
  "JR",
  "JV",
  "PP",
  "จำนวนเงิน",
  "Dr",
  "Cr",
  "หมายเหตุ"
];

const form = document.getElementById("recordForm");
const typeFilter = document.getElementById("typeFilter");
const startDate = document.getElementById("startDate");
const endDate = document.getElementById("endDate");
const showAllBtn = document.getElementById("showAllBtn");
const dateRangeBtn = document.getElementById("dateRangeBtn");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importFile = document.getElementById("importFile");
const recordCount = document.getElementById("recordCount");
const tableHead = document.querySelector("#recordsTable thead");
const tableBody = document.querySelector("#recordsTable tbody");

let records = loadRecords();
let filteredRecords = [...records];

function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function getFormRecord() {
  return {
    "วันที่": document.getElementById("date").value,
    "รายการ": document.getElementById("item").value.trim(),
    "เลขที่เอกสาร": document.getElementById("docNo").value.trim(),
    RE: document.getElementById("RE").value.trim(),
    JR: document.getElementById("JR").value.trim(),
    JV: document.getElementById("JV").value.trim(),
    PP: document.getElementById("PP").value.trim(),
    "จำนวนเงิน": document.getElementById("amount").value.trim(),
    Dr: document.getElementById("Dr").value.trim(),
    Cr: document.getElementById("Cr").value.trim(),
    "หมายเหตุ": document.getElementById("note").value.trim()
  };
}

function clearForm() {
  form.reset();
}

function renderTypeOptions(sourceRecords) {
  const values = new Set();
  sourceRecords.forEach((record) => {
    const type = String(record["รายการ"] || "").trim();
    if (type) values.add(type);
  });

  const currentValue = typeFilter.value;
  typeFilter.innerHTML = '<option value="">ทั้งหมด</option>';

  [...values].sort((a, b) => a.localeCompare(b, "th")).forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    typeFilter.appendChild(option);
  });

  if ([...values].includes(currentValue)) {
    typeFilter.value = currentValue;
  }
}

function collectColumns(data) {
  const columns = [...FIELD_ORDER];
  data.forEach((record) => {
    Object.keys(record).forEach((key) => {
      if (!columns.includes(key)) columns.push(key);
    });
  });
  return columns;
}

function renderTable(data) {
  const columns = collectColumns(data.length ? data : records);

  tableHead.innerHTML = "";
  tableBody.innerHTML = "";

  const headRow = document.createElement("tr");
  columns.forEach((column) => {
    const th = document.createElement("th");
    th.textContent = column;
    headRow.appendChild(th);
  });
  tableHead.appendChild(headRow);

  if (!data.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = columns.length;
    cell.textContent = "ยังไม่มีข้อมูล";
    cell.className = "empty-cell";
    row.appendChild(cell);
    tableBody.appendChild(row);
  } else {
    data.forEach((record) => {
      const row = document.createElement("tr");
      columns.forEach((column) => {
        const td = document.createElement("td");
        td.textContent = String(record[column] ?? "");
        row.appendChild(td);
      });
      tableBody.appendChild(row);
    });
  }

  recordCount.textContent = `${data.length} รายการ`;
}

function matchesType(record) {
  if (!typeFilter.value) return true;
  return String(record["รายการ"] || "") === typeFilter.value;
}

function matchesDateRange(record) {
  const dateValue = record["วันที่"];
  if (!dateValue) return false;
  if (startDate.value && dateValue < startDate.value) return false;
  if (endDate.value && dateValue > endDate.value) return false;
  return true;
}

function applyTypeOnlyFilter() {
  filteredRecords = records.filter((record) => matchesType(record));
  renderTable(filteredRecords);
}

function applyDateRangeFilter() {
  filteredRecords = records.filter((record) => matchesType(record) && matchesDateRange(record));
  renderTable(filteredRecords);
}

function normalizeImportedRecord(row) {
  const result = {};
  FIELD_ORDER.forEach((field) => {
    result[field] = String(row[field] ?? "").trim();
  });

  if (!result["วันที่"] && row.date) result["วันที่"] = String(row.date);
  if (!result["รายการ"] && row.item) result["รายการ"] = String(row.item);

  return result;
}

function exportToExcel() {
  const data = filteredRecords.length ? filteredRecords : records;
  const worksheetData = data.map((record) => {
    const ordered = {};
    FIELD_ORDER.forEach((field) => {
      ordered[field] = record[field] ?? "";
    });
    return ordered;
  });

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "AccountingRecords");
  XLSX.writeFile(workbook, "ทะเบียนคุมบันทึกการปรับปรุงรายการบัญชี.xlsx");
}

function importFromExcel(file) {
  const reader = new FileReader();
  reader.onload = (event) => {
    const data = new Uint8Array(event.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });

    const imported = rows
      .map(normalizeImportedRecord)
      .filter((row) => row["วันที่"] || row["รายการ"]);

    records = imported;
    saveRecords();
    renderTypeOptions(records);
    applyTypeOnlyFilter();
  };
  reader.readAsArrayBuffer(file);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const record = getFormRecord();

  if (!record["วันที่"]) {
    alert("กรุณากรอกวันที่ก่อนบันทึก");
    return;
  }

  records.push(record);
  saveRecords();
  renderTypeOptions(records);
  applyTypeOnlyFilter();
  clearForm();
});

typeFilter.addEventListener("change", applyTypeOnlyFilter);
showAllBtn.addEventListener("click", () => {
  startDate.value = "";
  endDate.value = "";
  filteredRecords = records.filter((record) => matchesType(record));
  renderTable(filteredRecords);
});
dateRangeBtn.addEventListener("click", applyDateRangeFilter);
exportBtn.addEventListener("click", exportToExcel);
importBtn.addEventListener("click", () => importFile.click());
importFile.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  importFromExcel(file);
  event.target.value = "";
});

renderTypeOptions(records);
renderTable(records);
