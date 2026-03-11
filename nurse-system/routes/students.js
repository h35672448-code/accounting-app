const express = require("express");
const { pool } = require("../database/db");
const { logAudit } = require("../database/audit");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const { asyncHandler, parseIntOrNull } = require("./helpers");

const router = express.Router();

router.use(authenticateToken);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || "").trim();

    let sql = `
      SELECT id, student_code, first_name, last_name, department, class_room, allergy_note, chronic_note, created_at, updated_at
      FROM students
    `;
    const params = [];

    if (q) {
      sql += ` WHERE student_code LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR department LIKE ? OR class_room LIKE ?`;
      const like = `%${q}%`;
      params.push(like, like, like, like, like);
    }

    sql += " ORDER BY id DESC";
    const [rows] = await pool.execute(sql, params);
    res.json({ ok: true, data: rows });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid student id" });

    const [rows] = await pool.execute(
      `
        SELECT id, student_code, first_name, last_name, department, class_room, allergy_note, chronic_note, created_at, updated_at
        FROM students
        WHERE id = ?
        LIMIT 1
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Student not found" });
    }

    res.json({ ok: true, data: rows[0] });
  })
);

router.get(
  "/:id/visits",
  asyncHandler(async (req, res) => {
    const id = parseIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid student id" });

    const [rows] = await pool.execute(
      `
        SELECT v.id, v.symptom, v.severity, v.triage_status, v.visit_at, u.username AS nurse_name
        FROM visits v
        LEFT JOIN users u ON u.id = v.nurse_id
        WHERE v.student_id = ?
        ORDER BY v.visit_at DESC
      `,
      [id]
    );

    res.json({ ok: true, data: rows });
  })
);

router.post(
  "/",
  authorizeRoles("admin", "nurse"),
  asyncHandler(async (req, res) => {
    const studentCode = String(req.body.student_code || "").trim();
    const firstName = String(req.body.first_name || "").trim();
    const lastName = String(req.body.last_name || "").trim();
    const department = String(req.body.department || "").trim();
    const classRoom = String(req.body.class_room || "").trim();
    const allergyNote = String(req.body.allergy_note || "").trim() || null;
    const chronicNote = String(req.body.chronic_note || "").trim() || null;

    if (!studentCode || !firstName || !lastName || !department || !classRoom) {
      return res.status(400).json({ ok: false, error: "student_code, first_name, last_name, department, class_room are required" });
    }

    const [result] = await pool.execute(
      `
        INSERT INTO students (student_code, first_name, last_name, department, class_room, allergy_note, chronic_note)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [studentCode, firstName, lastName, department, classRoom, allergyNote, chronicNote]
    );

    await logAudit({
      userId: req.user.id,
      action: "create",
      entity: "students",
      entityId: result.insertId,
      after: {
        student_code: studentCode,
        first_name: firstName,
        last_name: lastName,
        department,
        class_room: classRoom
      }
    });

    res.status(201).json({ ok: true, id: result.insertId });
  })
);

router.put(
  "/:id",
  authorizeRoles("admin", "nurse"),
  asyncHandler(async (req, res) => {
    const id = parseIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid student id" });

    const [currentRows] = await pool.execute("SELECT * FROM students WHERE id = ? LIMIT 1", [id]);
    if (currentRows.length === 0) {
      return res.status(404).json({ ok: false, error: "Student not found" });
    }

    const current = currentRows[0];
    const payload = {
      student_code: String(req.body.student_code || current.student_code).trim(),
      first_name: String(req.body.first_name || current.first_name).trim(),
      last_name: String(req.body.last_name || current.last_name).trim(),
      department: String(req.body.department || current.department).trim(),
      class_room: String(req.body.class_room || current.class_room).trim(),
      allergy_note: req.body.allergy_note !== undefined ? String(req.body.allergy_note || "").trim() || null : current.allergy_note,
      chronic_note: req.body.chronic_note !== undefined ? String(req.body.chronic_note || "").trim() || null : current.chronic_note
    };

    await pool.execute(
      `
        UPDATE students
        SET student_code = ?, first_name = ?, last_name = ?, department = ?, class_room = ?, allergy_note = ?, chronic_note = ?
        WHERE id = ?
      `,
      [
        payload.student_code,
        payload.first_name,
        payload.last_name,
        payload.department,
        payload.class_room,
        payload.allergy_note,
        payload.chronic_note,
        id
      ]
    );

    await logAudit({
      userId: req.user.id,
      action: "update",
      entity: "students",
      entityId: id,
      before: current,
      after: payload
    });

    res.json({ ok: true, message: "Student updated" });
  })
);

router.delete(
  "/:id",
  authorizeRoles("admin"),
  asyncHandler(async (req, res) => {
    const id = parseIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid student id" });

    const [rows] = await pool.execute("SELECT * FROM students WHERE id = ? LIMIT 1", [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Student not found" });
    }

    await pool.execute("DELETE FROM students WHERE id = ?", [id]);

    await logAudit({
      userId: req.user.id,
      action: "delete",
      entity: "students",
      entityId: id,
      before: rows[0]
    });

    res.json({ ok: true, message: "Student deleted" });
  })
);

module.exports = router;
