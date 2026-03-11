const express = require("express");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const { asyncHandler, parseIntOrNull, readAll, insertRow, deleteRowById, appendAudit, toNumber, toDateTime } = require("./helpers");

const router = express.Router();
const moods = ["ดีมาก", "ดี", "ปานกลาง", "แย่"];

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const studentId = parseIntOrNull(req.body.student_id);
    const visitId = parseIntOrNull(req.body.visit_id);
    const mood = String(req.body.mood || "").trim();
    const comment = String(req.body.comment || "").trim();

    if (!studentId || !moods.includes(mood)) {
      return res.status(400).json({ ok: false, error: "student_id and valid mood are required" });
    }

    const students = await readAll("students");
    if (!students.some((student) => toNumber(student.id) === studentId)) {
      return res.status(404).json({ ok: false, error: "Student not found" });
    }

    if (visitId) {
      const visits = await readAll("visits");
      if (!visits.some((visit) => toNumber(visit.id) === visitId)) {
        return res.status(404).json({ ok: false, error: "Visit not found" });
      }
    }

    const inserted = await insertRow("feedback", {
      student_id: studentId,
      visit_id: visitId || "",
      mood,
      comment,
      created_at: toDateTime()
    });

    res.status(201).json({ ok: true, id: inserted.id });
  })
);

router.get(
  "/",
  authenticateToken,
  authorizeRoles("admin", "nurse", "viewer"),
  asyncHandler(async (_req, res) => {
    const [feedbackRows, students] = await Promise.all([readAll("feedback"), readAll("students")]);
    const studentMap = new Map(students.map((student) => [toNumber(student.id), student]));

    const data = feedbackRows
      .map((item) => {
        const student = studentMap.get(toNumber(item.student_id));
        return {
          ...item,
          student_code: student?.student_code || "",
          student_name: student ? `${student.first_name} ${student.last_name}` : ""
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    res.json({ ok: true, data });
  })
);

router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles("admin"),
  asyncHandler(async (req, res) => {
    const id = parseIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid feedback id" });

    const removed = await deleteRowById("feedback", id);
    if (!removed) {
      return res.status(404).json({ ok: false, error: "Feedback not found" });
    }

    await appendAudit({
      userId: req.user.id,
      action: "delete",
      entity: "feedback",
      entityId: id,
      before: removed
    });

    res.json({ ok: true, message: "Feedback deleted" });
  })
);

module.exports = router;
