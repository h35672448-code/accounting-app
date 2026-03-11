const { pool } = require("./db");

async function logAudit({ userId = null, action, entity, entityId = null, before = null, after = null, connection = null }) {
  if (!action || !entity) return;

  const runner = connection || pool;
  await runner.execute(
    `
      INSERT INTO audit_logs (user_id, action, entity, entity_id, before_json, after_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      userId,
      action,
      entity,
      entityId,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null
    ]
  );
}

module.exports = {
  logAudit
};
