const SHEET_NAME = "records";
const LOG_SHEET_NAME = "_sync_log";
const SPREADSHEET_ID = ""; // ใส่ได้ทั้ง Spreadsheet ID หรือ URL
const TOKEN = ""; // ถ้าต้องการล็อก token ให้ใส่ค่าเดียวกับ GOOGLE_SCRIPT_TOKEN
const NOTIFY_EMAIL = ""; // อีเมลแจ้งเตือนเริ่มต้น (ปล่อยว่างได้)
const MAX_RECORDS = 50000;

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
    var params = (e && e.parameter) || {};
    var config = getConfig_();
    guardToken_(params.token, config.token);

    var action = String(params.action || "pullRecords");
    if (action === "health") {
      return json_({
        ok: true,
        service: "google-driver",
        sheetName: config.sheetName,
        hasToken: Boolean(config.token),
        updatedAt: new Date().toISOString()
      });
    }

    if (action !== "pullRecords") {
      return json_({ ok: false, error: "Unsupported action" });
    }

    return json_({ ok: true, records: readRecords_(config) });
  } catch (error) {
    return json_({ ok: false, error: String(error) });
  }
}

function doPost(e) {
  try {
    var payload = parseJson_((e && e.postData && e.postData.contents) || "{}");
    var config = getConfig_();
    guardToken_(payload.token, config.token);

    var action = String(payload.action || "");
    if (action !== "pushRecords") {
      return json_({ ok: false, error: "Unsupported action" });
    }

    var records = Array.isArray(payload.records) ? payload.records : [];
    var synced = writeRecords_(records, config);
    var emailed = sendSyncEmail_(synced, payload.notifyEmail, config);

    return json_({ ok: true, synced: synced, emailed: emailed });
  } catch (error) {
    return json_({ ok: false, error: String(error) });
  }
}

function readRecords_(config) {
  var sheet = ensureSheet_(config);
  var values = sheet.getDataRange().getValues();

  if (values.length <= 1) return [];

  var rows = values.slice(1).filter(function (row) {
    return row.some(function (cell) {
      return String(cell || "").trim() !== "";
    });
  });

  return rows.map(function (row) {
    var record = {};
    for (var i = 0; i < HEADERS.length; i++) {
      record[HEADERS[i]] = stringify_(row[i]);
    }
    return record;
  });
}

function writeRecords_(records, config) {
  if (!Array.isArray(records)) throw new Error("รูปแบบ records ไม่ถูกต้อง");
  if (records.length > MAX_RECORDS) throw new Error("จำนวน records เกิน " + MAX_RECORDS + " รายการ");

  var lock = LockService.getScriptLock();
  lock.waitLock(25000);

  try {
    var sheet = ensureSheet_(config);
    var rows = normalizeIncomingRows_(records);
    var width = HEADERS.length;

    sheet.getRange(1, 1, 1, width).setValues([HEADERS]);
    if (sheet.getFrozenRows() < 1) sheet.setFrozenRows(1);

    var existingDataRows = Math.max(sheet.getLastRow() - 1, 0);
    if (existingDataRows > 0) {
      sheet.getRange(2, 1, existingDataRows, width).clearContent();
    }

    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, width).setValues(rows);
    }

    appendSyncLog_(config, "pushRecords", rows.length);
    return rows.length;
  } finally {
    lock.releaseLock();
  }
}

function normalizeIncomingRows_(records) {
  return records.map(function (record) {
    var obj = (record && typeof record === "object") ? record : {};
    return HEADERS.map(function (header) {
      return sanitizeCell_(obj[header]);
    });
  });
}

function sanitizeCell_(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function ensureSheet_(config) {
  var ss = getSpreadsheet_(config);
  var sheet = ss.getSheetByName(config.sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(config.sheetName);
  }

  ensureHeader_(sheet);
  return sheet;
}

function ensureHeader_(sheet) {
  var width = HEADERS.length;
  var current = [];

  if (sheet.getLastRow() >= 1) {
    current = sheet.getRange(1, 1, 1, width).getValues()[0];
  }

  var same = current.length === width;
  if (same) {
    for (var i = 0; i < width; i++) {
      if (String(current[i] || "") !== HEADERS[i]) {
        same = false;
        break;
      }
    }
  }

  if (!same) {
    sheet.getRange(1, 1, 1, width).setValues([HEADERS]);
  }
}

function getSpreadsheet_(config) {
  if (config.spreadsheetId) {
    var sheetId = normalizeSpreadsheetId_(config.spreadsheetId);
    if (!sheetId) {
      throw new Error("SPREADSHEET_ID ไม่ถูกต้อง: กรุณาใส่ ID หรือ URL ของ Google Sheets ให้ถูกต้อง");
    }

    try {
      return SpreadsheetApp.openById(sheetId);
    } catch (error) {
      throw new Error("เปิดชีตไม่สำเร็จ: ตรวจสอบ ID และสิทธิ์ของบัญชีที่ Deploy");
    }
  }

  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error("ไม่พบ Spreadsheet ที่เชื่อมกับสคริปต์ (แนะนำให้ตั้ง SPREADSHEET_ID)");
  }

  return active;
}

function normalizeSpreadsheetId_(value) {
  var raw = String(value || "").trim();
  if (!raw) return "";
  var match = raw.match(/[-\w]{25,}/);
  return match ? match[0] : "";
}

function getConfig_() {
  var props = PropertiesService.getScriptProperties();
  return {
    sheetName: readConfig_(props, "SHEET_NAME", SHEET_NAME),
    spreadsheetId: readConfig_(props, "SPREADSHEET_ID", SPREADSHEET_ID),
    token: readConfig_(props, "TOKEN", TOKEN),
    notifyEmail: readConfig_(props, "NOTIFY_EMAIL", NOTIFY_EMAIL)
  };
}

function readConfig_(props, key, fallbackValue) {
  var fromProps = props.getProperty(key);
  if (fromProps !== null && String(fromProps).trim() !== "") {
    return String(fromProps).trim();
  }
  return String(fallbackValue || "").trim();
}

function guardToken_(incomingToken, expectedToken) {
  if (!expectedToken) return;

  if (String(incomingToken || "") !== expectedToken) {
    throw new Error("Unauthorized token");
  }
}

function stringify_(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function sendSyncEmail_(syncedCount, incomingEmail, config) {
  var recipient = String(incomingEmail || config.notifyEmail || "").trim();
  if (!recipient) return false;

  try {
    var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    var subject = "แจ้งเตือน: บันทึกข้อมูลทะเบียนคุมบัญชีสำเร็จ";
    var body =
      "ระบบได้บันทึกข้อมูลขึ้น Google Sheets แล้ว\n" +
      "- จำนวนรายการ: " + syncedCount + "\n" +
      "- เวลา: " + now + "\n" +
      "- ไฟล์: " + getSpreadsheet_(config).getUrl();

    MailApp.sendEmail(recipient, subject, body);
    return true;
  } catch (error) {
    Logger.log("sendSyncEmail_ error: " + error);
    return false;
  }
}

function appendSyncLog_(config, action, syncedCount) {
  try {
    var ss = getSpreadsheet_(config);
    var logSheet = ss.getSheetByName(LOG_SHEET_NAME);

    if (!logSheet) {
      logSheet = ss.insertSheet(LOG_SHEET_NAME);
      logSheet.getRange(1, 1, 1, 4).setValues([["timestamp", "action", "syncedCount", "by"]]);
      logSheet.setFrozenRows(1);
    }

    logSheet.appendRow([new Date(), String(action), Number(syncedCount || 0), Session.getEffectiveUser().getEmail()]);
  } catch (error) {
    Logger.log("appendSyncLog_ error: " + error);
  }
}

function parseJson_(text) {
  try {
    return JSON.parse(String(text || "{}"));
  } catch (error) {
    throw new Error("JSON ไม่ถูกต้อง");
  }
}

function json_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
