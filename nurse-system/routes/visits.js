const express = require("express");
const { pool } = require("../database/db");
const { logAudit } = require("../database/audit");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const { asyncHandler, toMysqlDateTime, parseIntOrNull } = require("./helpers");

const router = express.Router();
const severityLevels = ["ปกติ", "ปานกลาง", "หนัก"];

router.use(authenticateToken);

async function createSeverityAlertIfNeeded(connection, visitId, severity, studentName) {
  if (severity !== "หนัก") return;

  await connection.execute(
    `
      INSERT INTO alerts (alert_type, status, message, visit_id)
      VALUES ('severity', 'open', ?, ?)
    `,
    [`อาการหนัก: ${studentName} ต้องส่งต่อโรงพยาบาล`, visitId]
  );
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || "").trim();
    const severity = String(req.query.severity || "").trim();
    const status = String(req.query.status || "").trim();
    const dateFrom = String(req.query.date_from || "").trim();
    const dateTo = String(req.query.date_to || "").trim();

    let sql = `
      SELECT
        v.id,
        v.student_id,
        s.student_code,
        CONCAT(s.first_name, ' ', s.last_name) AS student_name,
        v.symptom,
        v.severity,
        v.triage_status,
        v.nurse_id,
        u.username AS nurse_name,
        v.parent_notified,
        v.event_note,
        v.visit_at,
        v.created_at,
        v.updated_at
      FROM visits v
      INNER JOIN students s ON s.id = v.student_id
      LEFT JOIN users u ON u.id = v.nurse_id
      WHERE 1=1
    `;

    const params = [];

    if (q) {
      sql += " AND (s.student_code LIKE ? OR s.first_name LIKE ? OR s.last_name LIKE ? OR v.symptom LIKE ?)";
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }

    if (severity && severityLevels.includes(severity)) {
      sql += " AND v.severity = ?";
      params.push(severity);
    }

    if (status) {
      sql += " AND v.triage_status = ?";
      params.push(status);
    }

    if (dateFrom) {
      const from = toMysqlDateTime(`${dateFrom}T00:00:00`);
      if (from) {
        sql += " AND v.visit_at >= ?";
        params.push(from);
      }
    }

    if (dateTo) {
      const to = toMysqlDateTime(`${dateTo}T23:59:59`);
      if (to) {
        sql += " AND v.visit_at <= ?";
        params.push(to);
      }
    }

    sql += " ORDER BY v.visit_at DESC";

    const [rows] = await pool.execute(sql, params);
    res.json({ ok: true, data: rows });
  })
);

router.post(
  "/",
  authorizeRoles("admin", "nurse"),
  asyncHandler(async (req, res) => {
    const studentId = parseIntOrNull(req.body.student_id);
    const studentCode = String(req.body.student_code || "").trim();
    const symptom = String(req.body.symptom || "").trim();
    const severity = String(req.body.severity || "ปกติ").trim();
    const triageStatus = String(req.body.triage_status || "").trim() || (severity === "หนัก" ? "ส่งโรงพยาบาล" : "รอคัดกรอง");
    const visitAt = toMysqlDateTime(req.body.visit_at);

    if (!symptom || !severityLevels.includes(severity) || !visitAt) {
      return res.status(400).json({ ok: false, error: "student_id or student_code, symptom, severity, visit_at are required" });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      let resolvedStudentId = studentId;
      let studentName = null;
      if (!resolvedStudentId && !studentCode) {
        await connection.rollback();
        return res.status(400).json({ ok: false, error: "student_id or student_code is required" });
      }

      if (resolvedStudentId) {
        const [studentRows] = await connection.execute(
          "SELECT id, first_name, last_name FROM students WHERE id = ? LIMIT 1",
          [resolvedStudentId]
        );
        if (studentRows.length === 0) {
          await connection.rollback();
          return res.status(404).json({ ok: false, error: "Student not found" });
        }
        studentName = `${studentRows[0].first_name} ${studentRows[0].last_name}`;
      } else {
        const [studentRows] = await connection.execute(
          "SELECT id, first_name, last_name FROM students WHERE student_code = ? LIMIT 1",
          [studentCode]
        );
        if (studentRows.length === 0) {
          await connection.rollback();
          return res.status(404).json({ ok: false, error: "Student not found" });
        }
        resolvedStudentId = studentRows[0].id;
        studentName = `${studentRows[0].first_name} ${studentRows[0].last_name}`;
      }

      const [result] = await connection.execute(
        `
          INSERT INTO visits (student_id, symptom, severity, triage_status, nurse_id, visit_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [resolvedStudentId, symptom, severity, triageStatus, req.user.id, visitAt]
      );

      await createSeverityAlertIfNeeded(connection, result.insertId, severity, studentName);

      await logAudit({
        userId: req.user.id,
        action: "create",
        entity: "visits",
        entityId: result.insertId,
        after: {
          student_id: resolvedStudentId,
          symptom,
          severity,
          triage_status: triageStatus,
          visit_at: visitAt
        },
        connection
      });

      await connection.commit();
      res.status(201).json({ ok: true, id: result.insertId });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

router.put(
  "/:id",
  authorizeRoles("admin", "nurse"),
  asyncHandler(async (req, res) => {
    const id = parseIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid visit id" });

    const [rows] = await pool.execute("SELECT * FROM visits WHERE id = ? LIMIT 1", [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Visit not found" });
    }

    const current = rows[0];
    const payload = {
      symptom: req.body.symptom !== undefined ? String(req.body.symptom || "").trim() : current.symptom,
      severity: req.body.severity !== undefined ? String(req.body.severity || "").trim() : current.severity,
      triage_status: req.body.triage_status !== undefined ? String(req.body.triage_status || "").trim() : current.triage_status,
      visit_at: req.body.visit_at !== undefined ? toMysqlDateTime(req.body.visit_at) : current.visit_at,
      event_note: req.body.event_note !== undefined ? String(req.body.event_note || "").trim() || null : current.event_note
    };

    if (!payload.symptom || !severityLevels.includes(payload.severity) || !payload.visit_at) {
      return res.status(400).json({ ok: false, error: "Invalid visit payload" });
    }

    await pool.execute(
      `
        UPDATE visits
        SET symptom = ?, severity = ?, triage_status = ?, visit_at = ?, event_note = ?
        WHERE id = ?
      `,
      [payload.symptom, payload.severity, payload.triage_status, payload.visit_at, payload.event_note, id]
    );

    await logAudit({
      userId: req.user.id,
      action: "update",
      entity: "visits",
      entityId: id,
      before: current,
      after: payload
    });

    res.json({ ok: true, message: "Visit updated" });
  })
);

router.post(
  "/:id/dispatch-hospital",
  authorizeRoles("admin", "nurse"),
  asyncHandler(async (req, res) => {
    const id = parseIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid visit id" });

    const note = String(req.body.note || "").trim() || "ส่งต่อโรงพยาบาล";
    const [rows] = await pool.execute("SELECT * FROM visits WHERE id = ? LIMIT 1", [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Visit not found" });
    }

    const current = rows[0];
    const nextNote = current.event_note ? `${current.event_note} | ${note}` : note;

    await pool.execute("UPDATE visits SET triage_status = 'ส่งโรงพยาบาล', severity = 'หนัก', event_note = ? WHERE id = ?", [nextNote, id]);

    await pool.execute(
      `
        INSERT INTO alerts (alert_type, status, message, visit_id)
        VALUES ('severity', 'open', ?, ?)
      `,
      [`ส่งต่อโรงพยาบาล: visit#${id}`, id]
    );

    await logAudit({
      userId: req.user.id,
      action: "dispatch",
      entity: "visits",
      entityId: id,
      before: current,
      after: { triage_status: "ส่งโรงพยาบาล", severity: "หนัก", event_note: nextNote }
    });

    res.json({ ok: true, message: "Visit dispatched to hospital" });
  })
);

router.post(
  "/:id/notify-parent",
  authorizeRoles("admin", "nurse"),
  asyncHandler(async (req, res) => {
    const id = parseIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid visit id" });

    const [result] = await pool.execute("UPDATE visits SET parent_notified = 1 WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, error: "Visit not found" });
    }

    await logAudit({
      userId: req.user.id,
      action: "notify_parent",
      entity: "visits",
      entityId: id,
      after: { parent_notified: true }
    });

    res.json({ ok: true, message: "Parent notified" });
  })
);

router.post(
  "/:id/event-note",
  authorizeRoles("admin", "nurse"),
  asyncHandler(async (req, res) => {
    const id = parseIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid visit id" });

    const note = String(req.body.note || "").trim();
    if (!note) {
      return res.status(400).json({ ok: false, error: "note is required" });
    }

    const [rows] = await pool.execute("SELECT event_note FROM visits WHERE id = ? LIMIT 1", [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Visit not found" });
    }

    const nextNote = rows[0].event_note ? `${rows[0].event_note} | ${note}` : note;
    await pool.execute("UPDATE visits SET event_note = ? WHERE id = ?", [nextNote, id]);

    await logAudit({
      userId: req.user.id,
      action: "append_note",
      entity: "visits",
      entityId: id,
      after: { event_note: nextNote }
    });

    res.json({ ok: true, message: "Event note appended" });
  })
);

router.delete(
  "/:id",
  authorizeRoles("admin"),
  asyncHandler(async (req, res) => {
    const id = parseIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid visit id" });

    const [rows] = await pool.execute("SELECT * FROM visits WHERE id = ? LIMIT 1", [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Visit not found" });
    }

    await pool.execute("DELETE FROM visits WHERE id = ?", [id]);

    await logAudit({
      userId: req.user.id,
      action: "delete",
      entity: "visits",
      entityId: id,
      before: rows[0]
    });

    res.json({ ok: true, message: "Visit deleted" });
  })
);

module.exports = router;
