const SHEET_NAME = "records";
const SPREADSHEET_ID = ""; // ใส่ได้ทั้ง Spreadsheet ID หรือ URL
const TOKEN = ""; // ถ้าต้องการล็อก token ให้ใส่ค่าเดียวกับ GOOGLE_SCRIPT_TOKEN
const NOTIFY_EMAIL = ""; // อีเมลแจ้งเตือนเริ่มต้น (ปล่อยว่างได้)

const HEADERS = [
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

function doGet(e) {
  try {
    guardToken_(e.parameter.token);

    const action = String(e.parameter.action || "pullRecords");
    if (action !== "pullRecords") {
      return json_({ ok: false, error: "Unsupported action" });
    }

    return json_({ ok: true, records: readRecords_() });
  } catch (error) {
    return json_({ ok: false, error: String(error) });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse((e.postData && e.postData.contents) || "{}");
    guardToken_(payload.token);

    const action = String(payload.action || "");
    if (action !== "pushRecords") {
      return json_({ ok: false, error: "Unsupported action" });
    }

    const records = Array.isArray(payload.records) ? payload.records : [];
    writeRecords_(records);
    const emailed = sendSyncEmail_(records.length, payload.notifyEmail);

    return json_({ ok: true, synced: records.length, emailed: emailed });
  } catch (error) {
    return json_({ ok: false, error: String(error) });
  }
}

function readRecords_() {
  const sheet = ensureSheet_();
  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) return [];

  const headers = values[0].map(function (h) {
    return String(h || "");
  });

  const rows = values.slice(1).filter(function (row) {
    return row.some(function (cell) {
      return String(cell || "").trim() !== "";
    });
  });

  return rows.map(function (row) {
    const record = {};

    headers.forEach(function (header, index) {
      record[header] = stringify_(row[index]);
    });

    return record;
  });
}

function writeRecords_(records) {
  const sheet = ensureSheet_();

  sheet.clearContents();
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);

  if (records.length === 0) return;

  const rows = records.map(function (record) {
    return HEADERS.map(function (header) {
      return stringify_(record[header]);
    });
  });

  sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
}

function ensureSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  return sheet;
}

function getSpreadsheet_() {
  if (SPREADSHEET_ID) {
    var sheetId = normalizeSpreadsheetId_(SPREADSHEET_ID);
    if (!sheetId) {
      throw new Error("SPREADSHEET_ID ไม่ถูกต้อง: กรุณาใส่ ID หรือ URL ของ Google Sheets ให้ถูกต้อง");
    }

    try {
      return SpreadsheetApp.openById(sheetId);
    } catch (error) {
      throw new Error(
        "เปิดชีตไม่สำเร็จ: ตรวจสอบว่า ID ถูกต้อง และบัญชีที่ Deploy มีสิทธิ์เข้าถึงชีตนี้"
      );
    }
  }

  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error("ไม่พบ Spreadsheet ที่เชื่อมกับสคริปต์");
  }

  return active;
}

function normalizeSpreadsheetId_(value) {
  var raw = String(value || "").trim();
  if (!raw) return "";

  // รองรับทั้งกรณีใส่เป็น ID ตรง ๆ หรือใส่เป็น URL เต็ม
  var match = raw.match(/[-\w]{25,}/);
  return match ? match[0] : "";
}

function guardToken_(incomingToken) {
  if (!TOKEN) return;

  if (String(incomingToken || "") !== TOKEN) {
    throw new Error("Unauthorized token");
  }
}

function stringify_(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function sendSyncEmail_(syncedCount, incomingEmail) {
  var recipient = String(incomingEmail || NOTIFY_EMAIL || "").trim();
  if (!recipient) return false;

  try {
    var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    var subject = "แจ้งเตือน: บันทึกข้อมูลทะเบียนคุมบัญชีสำเร็จ";
    var body =
      "ระบบได้บันทึกข้อมูลขึ้น Google Sheets แล้ว\n" +
      "- จำนวนรายการ: " +
      syncedCount +
      "\n" +
      "- เวลา: " +
      now +
      "\n" +
      "- ไฟล์: " +
      getSpreadsheet_().getUrl();

    MailApp.sendEmail(recipient, subject, body);
    return true;
  } catch (error) {
    Logger.log("sendSyncEmail_ error: " + error);
    return false;
  }
}

function json_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
