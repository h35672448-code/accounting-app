const express = require("express");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const {
  asyncHandler,
  parseIntOrNull,
  readAll,
  writeAll,
  insertRow,
  updateRowById,
  deleteRowById,
  appendAudit,
  toNumber,
  toDateTime
} = require("./helpers");

const router = express.Router();

router.use(authenticateToken);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || "").trim().toLowerCase();
    const students = await readAll("students");

    const data = q
      ? students.filter((student) => {
          const blob = `${student.student_code} ${student.first_name} ${student.last_name} ${student.department} ${student.class_room}`.toLowerCase();
          return blob.includes(q);
        })
      : students;

    data.sort((a, b) => toNumber(b.id) - toNumber(a.id));
    res.json({ ok: true, data });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid student id" });

    const students = await readAll("students");
    const student = students.find((item) => toNumber(item.id) === id);
    if (!student) return res.status(404).json({ ok: false, error: "Student not found" });

    res.json({ ok: true, data: student });
  })
);

router.get(
  "/:id/visits",
  asyncHandler(async (req, res) => {
    const id = parseIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid student id" });

    const visits = await readAll("visits");
    const users = await readAll("users");
    const usersMap = new Map(users.map((user) => [toNumber(user.id), user.username]));

    const data = visits
      .filter((visit) => toNumber(visit.student_id) === id)
      .map((visit) => ({
        ...visit,
        nurse_name: usersMap.get(toNumber(visit.nurse_id)) || null
      }))
      .sort((a, b) => new Date(b.visit_at).getTime() - new Date(a.visit_at).getTime());

    res.json({ ok: true, data });
  })
);

router.post(
  "/",
  authorizeRoles("admin", "nurse"),
  asyncHandler(async (req, res) => {
    const payload = {
      student_code: String(req.body.student_code || "").trim(),
      first_name: String(req.body.first_name || "").trim(),
      last_name: String(req.body.last_name || "").trim(),
      department: String(req.body.department || "").trim(),
      class_room: String(req.body.class_room || "").trim(),
      allergy_note: String(req.body.allergy_note || "").trim(),
      chronic_note: String(req.body.chronic_note || "").trim()
    };

    if (!payload.student_code || !payload.first_name || !payload.last_name || !payload.department || !payload.class_room) {
      return res.status(400).json({ ok: false, error: "student_code, first_name, last_name, department, class_room are required" });
    }

    const students = await readAll("students");
    const duplicated = students.some((student) => String(student.student_code) === payload.student_code);
    if (duplicated) {
      return res.status(400).json({ ok: false, error: "student_code already exists" });
    }

    const inserted = await insertRow("students", payload);
    await appendAudit({
      userId: req.user.id,
      action: "create",
      entity: "students",
      entityId: inserted.id,
      after: payload
    });

    res.status(201).json({ ok: true, id: inserted.id });
  })
);

router.put(
  "/:id",
  authorizeRoles("admin", "nurse"),
  asyncHandler(async (req, res) => {
    const id = parseIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid student id" });

    const updates = {
      student_code: req.body.student_code,
      first_name: req.body.first_name,
      last_name: req.body.last_name,
      department: req.body.department,
      class_room: req.body.class_room,
      allergy_note: req.body.allergy_note,
      chronic_note: req.body.chronic_note
    };

    const students = await readAll("students");
    const duplicated = students.some(
      (student) => toNumber(student.id) !== id && updates.student_code && String(student.student_code) === String(updates.student_code)
    );

    if (duplicated) {
      return res.status(400).json({ ok: false, error: "student_code already exists" });
    }

    const updated = await updateRowById("students", id, (current) => ({
      ...current,
      student_code: updates.student_code !== undefined ? String(updates.student_code).trim() : current.student_code,
      first_name: updates.first_name !== undefined ? String(updates.first_name).trim() : current.first_name,
      last_name: updates.last_name !== undefined ? String(updates.last_name).trim() : current.last_name,
      department: updates.department !== undefined ? String(updates.department).trim() : current.department,
      class_room: updates.class_room !== undefined ? String(updates.class_room).trim() : current.class_room,
      allergy_note: updates.allergy_note !== undefined ? String(updates.allergy_note || "").trim() : current.allergy_note,
      chronic_note: updates.chronic_note !== undefined ? String(updates.chronic_note || "").trim() : current.chronic_note,
      updated_at: toDateTime()
    }));

    if (!updated) {
      return res.status(404).json({ ok: false, error: "Student not found" });
    }

    await appendAudit({
      userId: req.user.id,
      action: "update",
      entity: "students",
      entityId: id,
      before: updated.before,
      after: updated.after
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

    const removed = await deleteRowById("students", id);
    if (!removed) {
      return res.status(404).json({ ok: false, error: "Student not found" });
    }

    const visits = await readAll("visits");
    const nextVisits = visits.filter((visit) => toNumber(visit.student_id) !== id);
    if (nextVisits.length !== visits.length) {
      await writeAll("visits", nextVisits);
    }

    await appendAudit({
      userId: req.user.id,
      action: "delete",
      entity: "students",
      entityId: id,
      before: removed
    });

    res.json({ ok: true, message: "Student deleted" });
  })
);

module.exports = router;
