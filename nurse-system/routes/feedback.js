const express = require("express");
const { pool } = require("../database/db");
const { logAudit } = require("../database/audit");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const { asyncHandler, parseIntOrNull } = require("./helpers");

const router = express.Router();
const moods = ["ดีมาก", "ดี", "ปานกลาง", "แย่"];

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const studentId = parseIntOrNull(req.body.student_id);
    const visitId = parseIntOrNull(req.body.visit_id);
    const mood = String(req.body.mood || "").trim();
    const comment = String(req.body.comment || "").trim() || null;

    if (!studentId || !moods.includes(mood)) {
      return res.status(400).json({ ok: false, error: "student_id and valid mood are required" });
    }

    const [studentRows] = await pool.execute("SELECT id FROM students WHERE id = ? LIMIT 1", [studentId]);
    if (studentRows.length === 0) {
      return res.status(404).json({ ok: false, error: "Student not found" });
    }

    if (visitId) {
      const [visitRows] = await pool.execute("SELECT id FROM visits WHERE id = ? LIMIT 1", [visitId]);
      if (visitRows.length === 0) {
        return res.status(404).json({ ok: false, error: "Visit not found" });
      }
    }

    const [result] = await pool.execute(
      `
        INSERT INTO feedback (student_id, visit_id, mood, comment)
        VALUES (?, ?, ?, ?)
      `,
      [studentId, visitId, mood, comment]
    );

    res.status(201).json({ ok: true, id: result.insertId });
  })
);

router.get(
  "/",
  authenticateToken,
  authorizeRoles("admin", "nurse", "viewer"),
  asyncHandler(async (req, res) => {
    const [rows] = await pool.execute(
      `
        SELECT
          f.id,
          f.student_id,
          s.student_code,
          CONCAT(s.first_name, ' ', s.last_name) AS student_name,
          f.visit_id,
          f.mood,
          f.comment,
          f.created_at
        FROM feedback f
        INNER JOIN students s ON s.id = f.student_id
        ORDER BY f.created_at DESC
      `
    );

    res.json({ ok: true, data: rows });
  })
);

router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles("admin"),
  asyncHandler(async (req, res) => {
    const id = parseIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid feedback id" });

    const [rows] = await pool.execute("SELECT * FROM feedback WHERE id = ? LIMIT 1", [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Feedback not found" });
    }

    await pool.execute("DELETE FROM feedback WHERE id = ?", [id]);

    await logAudit({
      userId: req.user.id,
      action: "delete",
      entity: "feedback",
      entityId: id,
      before: rows[0]
    });

    res.json({ ok: true, message: "Feedback deleted" });
  })
);

module.exports = router;
