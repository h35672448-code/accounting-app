const fs = require("fs");
const path = require("path");

const DEFAULT_ENTITIES = [
  "users",
  "students",
  "medicines",
  "visits",
  "visit_medicines",
  "medicine_stock_logs",
  "news",
  "feedback",
  "alerts",
  "audit_logs"
];

const requiredEnv = ["DRIVE_SCRIPT_URL"];

function assertDriveConfig() {
  const missing = requiredEnv.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing env for drive mode: ${missing.join(", ")}`);
  }
}

async function callDriveApi({ method = "GET", action, entity, rows }) {
  assertDriveConfig();

  const token = process.env.DRIVE_TOKEN || "";
  if (method === "GET") {
    const url = new URL(process.env.DRIVE_SCRIPT_URL);
    url.searchParams.set("action", action);
    if (token) url.searchParams.set("token", token);
    if (entity) url.searchParams.set("entity", entity);

    const response = await fetch(url, { method: "GET" });
    if (!response.ok) {
      throw new Error(`Drive API failed (${response.status})`);
    }

    const data = await response.json();
    if (!data.ok) {
      throw new Error(data.error || "Drive API error");
    }

    return data;
  }

  const payload = { action, entity, rows, token };
  const response = await fetch(process.env.DRIVE_SCRIPT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Drive API failed (${response.status})`);
  }

  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.error || "Drive API error");
  }

  return data;
}

async function pullEntity(entity) {
  const data = await callDriveApi({ method: "GET", action: "pullEntity", entity });
  return Array.isArray(data.rows) ? data.rows : [];
}

async function pushEntity(entity, rows) {
  await callDriveApi({ method: "POST", action: "pushEntity", entity, rows });
}

function toNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function toBooleanInt(value) {
  if (value === true || value === 1 || value === "1") return 1;
  return 0;
}

function toDateTime(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function nextId(rows) {
  return rows.reduce((max, row) => {
    const id = toNumber(row.id, 0);
    return id > max ? id : max;
  }, 0) + 1;
}

function ensureSeedData(basePath) {
  const seedPath = path.join(basePath, "sql", "drive-seed.json");
  if (!fs.existsSync(seedPath)) return null;
  const raw = fs.readFileSync(seedPath, "utf8");
  return JSON.parse(raw);
}

async function initializeDriveStoreIfEmpty(basePath) {
  const seed = ensureSeedData(basePath);
  if (!seed) return;

  for (const entity of DEFAULT_ENTITIES) {
    const currentRows = await pullEntity(entity);
    if (currentRows.length === 0 && Array.isArray(seed[entity])) {
      await pushEntity(entity, seed[entity]);
    }
  }
}

module.exports = {
  DEFAULT_ENTITIES,
  pullEntity,
  pushEntity,
  toNumber,
  toBooleanInt,
  toDateTime,
  nextId,
  initializeDriveStoreIfEmpty
};
