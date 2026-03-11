const { pullEntity, pushEntity, nextId, toDateTime, toNumber, toBooleanInt } = require("../services/driveStore");

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function parseIntOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null;
  return parsed;
}

async function readAll(entity) {
  return pullEntity(entity);
}

async function writeAll(entity, rows) {
  await pushEntity(entity, rows);
}

async function insertRow(entity, row) {
  const rows = await readAll(entity);
  const id = nextId(rows);
  const now = toDateTime();
  const created = { ...row, id, created_at: row.created_at || now, updated_at: row.updated_at || now };
  rows.push(created);
  await writeAll(entity, rows);
  return created;
}

async function updateRowById(entity, id, updater) {
  const rows = await readAll(entity);
  const index = rows.findIndex((row) => toNumber(row.id) === id);
  if (index < 0) return null;

  const current = rows[index];
  const next = updater(current);
  rows[index] = { ...next, id: current.id, updated_at: toDateTime() };
  await writeAll(entity, rows);
  return { before: current, after: rows[index] };
}

async function deleteRowById(entity, id) {
  const rows = await readAll(entity);
  const index = rows.findIndex((row) => toNumber(row.id) === id);
  if (index < 0) return null;

  const [removed] = rows.splice(index, 1);
  await writeAll(entity, rows);
  return removed;
}

async function appendAudit({ userId = null, action, entity, entityId = null, before = null, after = null }) {
  const logs = await readAll("audit_logs");
  const id = nextId(logs);
  logs.push({
    id,
    user_id: userId,
    action,
    entity,
    entity_id: entityId,
    before_json: before ? JSON.stringify(before) : "",
    after_json: after ? JSON.stringify(after) : "",
    created_at: toDateTime()
  });
  await writeAll("audit_logs", logs);
}

function withNames(rows, usersById) {
  return rows.map((row) => ({
    ...row,
    nurse_name: usersById[toNumber(row.nurse_id)]?.username || null,
    author_name: usersById[toNumber(row.author_id)]?.username || null
  }));
}

module.exports = {
  asyncHandler,
  parseIntOrNull,
  readAll,
  writeAll,
  insertRow,
  updateRowById,
  deleteRowById,
  appendAudit,
  toDateTime,
  toNumber,
  toBooleanInt,
  withNames
};
