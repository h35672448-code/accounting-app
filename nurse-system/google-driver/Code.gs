const ENTITY_HEADERS = {
  users: ["id", "username", "password_hash", "role", "is_active", "created_at", "updated_at"],
  students: ["id", "student_code", "first_name", "last_name", "department", "class_room", "allergy_note", "chronic_note", "created_at", "updated_at"],
  medicines: ["id", "medicine_code", "name", "image_url", "stock_qty", "reorder_level", "expire_date", "created_at", "updated_at"],
  visits: ["id", "student_id", "symptom", "severity", "triage_status", "nurse_id", "visit_at", "parent_notified", "event_note", "created_at", "updated_at"],
  visit_medicines: ["id", "visit_id", "medicine_id", "qty", "dosage", "instruction", "created_at"],
  medicine_stock_logs: ["id", "medicine_id", "actor_id", "action_type", "qty_before", "qty_change", "qty_after", "note", "created_at"],
  news: ["id", "title", "detail", "image_url", "published_at", "author_id", "created_at", "updated_at"],
  feedback: ["id", "student_id", "visit_id", "mood", "comment", "created_at"],
  alerts: ["id", "alert_type", "status", "message", "visit_id", "medicine_id", "created_at", "resolved_at"],
  audit_logs: ["id", "user_id", "action", "entity", "entity_id", "before_json", "after_json", "created_at"]
};

const SPREADSHEET_ID = "";
const TOKEN = "";

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    var action = String(params.action || "health");
    var config = getConfig_();

    guardToken_(params.token, config.token);

    if (action === "health") {
      return json_({
        ok: true,
        service: "nurse-drive-store",
        entities: Object.keys(ENTITY_HEADERS),
        updatedAt: new Date().toISOString()
      });
    }

    if (action === "pullEntity") {
      var entity = String(params.entity || "").trim();
      var rows = readEntityRows_(config, entity);
      return json_({ ok: true, entity: entity, rows: rows });
    }

    return json_({ ok: false, error: "Unsupported action" });
  } catch (error) {
    return json_({ ok: false, error: String(error) });
  }
}

function doPost(e) {
  try {
    var payload = parseJson_((e && e.postData && e.postData.contents) || "{}");
    var action = String(payload.action || "");
    var config = getConfig_();

    guardToken_(payload.token, config.token);

    if (action === "pushEntity") {
      var entity = String(payload.entity || "").trim();
      var rows = Array.isArray(payload.rows) ? payload.rows : [];
      writeEntityRows_(config, entity, rows);
      return json_({ ok: true, entity: entity, count: rows.length });
    }

    return json_({ ok: false, error: "Unsupported action" });
  } catch (error) {
    return json_({ ok: false, error: String(error) });
  }
}

function readEntityRows_(config, entity) {
  var headers = getHeaders_(entity);
  var sheet = ensureEntitySheet_(config, entity, headers);
  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  var rows = values.slice(1).filter(function (row) {
    return row.some(function (cell) {
      return String(cell || "").trim() !== "";
    });
  });

  return rows.map(function (row) {
    var obj = {};
    for (var i = 0; i < headers.length; i++) {
      obj[headers[i]] = stringify_(row[i]);
    }
    return obj;
  });
}

function writeEntityRows_(config, entity, rows) {
  if (!Array.isArray(rows)) throw new Error("rows must be array");

  var headers = getHeaders_(entity);
  var sheet = ensureEntitySheet_(config, entity, headers);
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);

  try {
    var width = headers.length;
    sheet.getRange(1, 1, 1, width).setValues([headers]);
    if (sheet.getFrozenRows() < 1) sheet.setFrozenRows(1);

    var existingRows = Math.max(sheet.getLastRow() - 1, 0);
    if (existingRows > 0) {
      sheet.getRange(2, 1, existingRows, width).clearContent();
    }

    if (rows.length > 0) {
      var normalized = rows.map(function (row) {
        var obj = row && typeof row === "object" ? row : {};
        return headers.map(function (key) {
          return sanitizeCell_(obj[key]);
        });
      });
      sheet.getRange(2, 1, normalized.length, width).setValues(normalized);
    }
  } finally {
    lock.releaseLock();
  }
}

function ensureEntitySheet_(config, entity, headers) {
  var ss = getSpreadsheet_(config);
  var sheet = ss.getSheetByName(entity);
  if (!sheet) {
    sheet = ss.insertSheet(entity);
  }

  var same = false;
  if (sheet.getLastRow() >= 1) {
    var current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    same = current.length === headers.length;
    if (same) {
      for (var i = 0; i < headers.length; i++) {
        if (String(current[i] || "") !== headers[i]) {
          same = false;
          break;
        }
      }
    }
  }

  if (!same) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  return sheet;
}

function getHeaders_(entity) {
  var headers = ENTITY_HEADERS[entity];
  if (!headers) throw new Error("Unknown entity: " + entity);
  return headers;
}

function getConfig_() {
  var props = PropertiesService.getScriptProperties();
  return {
    spreadsheetId: readConfig_(props, "SPREADSHEET_ID", SPREADSHEET_ID),
    token: readConfig_(props, "TOKEN", TOKEN)
  };
}

function readConfig_(props, key, fallbackValue) {
  var fromProps = props.getProperty(key);
  if (fromProps !== null && String(fromProps).trim() !== "") {
    return String(fromProps).trim();
  }

  return String(fallbackValue || "").trim();
}

function getSpreadsheet_(config) {
  if (!config.spreadsheetId) {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (!active) {
      throw new Error("SPREADSHEET_ID is required");
    }
    return active;
  }

  var id = normalizeSpreadsheetId_(config.spreadsheetId);
  if (!id) throw new Error("Invalid SPREADSHEET_ID");
  return SpreadsheetApp.openById(id);
}

function normalizeSpreadsheetId_(value) {
  var raw = String(value || "").trim();
  if (!raw) return "";
  var match = raw.match(/[-\w]{25,}/);
  return match ? match[0] : "";
}

function guardToken_(incomingToken, expectedToken) {
  if (!expectedToken) return;
  if (String(incomingToken || "") !== expectedToken) {
    throw new Error("Unauthorized token");
  }
}

function sanitizeCell_(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function stringify_(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function parseJson_(text) {
  try {
    return JSON.parse(String(text || "{}"));
  } catch (error) {
    throw new Error("Invalid JSON");
  }
}

function json_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
