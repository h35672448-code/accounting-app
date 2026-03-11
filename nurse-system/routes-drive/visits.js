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
const severityLevels = ["ปกติ", "ปานกลาง", "หนัก"];

router.use(authenticateToken);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || "").trim().toLowerCase();
    const severity = String(req.query.severity || "").trim();
    const status = String(req.query.status || "").trim();
    const dateFrom = String(req.query.date_from || "").trim();
    const dateTo = String(req.query.date_to || "").trim();

    const [visits, students, users] = await Promise.all([readAll("visits"), readAll("students"), readAll("users")]);

    const studentMap = new Map(students.map((student) => [toNumber(student.id), student]));
    const userMap = new Map(users.map((user) => [toNumber(user.id), user]));

    let data = visits.map((visit) => {
      const student = studentMap.get(toNumber(visit.student_id));
      const nurse = userMap.get(toNumber(visit.nurse_id));
      return {
        ...visit,
        student_code: student?.student_code || "",
        student_name: student ? `${student.first_name} ${student.last_name}` : "",
        nurse_name: nurse?.username || null
      };
    });

    if (q) {
      data = data.filter((visit) => {
        const blob = `${visit.student_code} ${visit.student_name} ${visit.symptom} ${visit.severity} ${visit.triage_status}`.toLowerCase();
        return blob.includes(q);
      });
    }

    if (severity && severityLevels.includes(severity)) {
      data = data.filter((visit) => String(visit.severity) === severity);
    }

    if (status) {
      data = data.filter((visit) => String(visit.triage_status) === status);
    }

    if (dateFrom) {
      const from = new Date(`${dateFrom}T00:00:00`);
      if (!Number.isNaN(from.getTime())) {
        data = data.filter((visit) => new Date(visit.visit_at).getTime() >= from.getTime());
      }
    }

    if (dateTo) {
      const to = new Date(`${dateTo}T23:59:59`);
      if (!Number.isNaN(to.getTime())) {
        data = data.filter((visit) => new Date(visit.visit_at).getTime() <= to.getTime());
      }
    }

    data.sort((a, b) => new Date(b.visit_at).getTime() - new Date(a.visit_at).getTime());
    res.json({ ok: true, data });
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
    const visitAt = toDateTime(req.body.visit_at);

    if (!symptom || !severityLevels.includes(severity) || !visitAt) {
      return res.status(400).json({ ok: false, error: "student_id or student_code, symptom, severity, visit_at are required" });
    }

    const students = await readAll("students");
    let student = null;

    if (studentId) {
      student = students.find((item) => toNumber(item.id) === studentId);
    } else if (studentCode) {
      student = students.find((item) => String(item.student_code) === studentCode);
    }

    if (!student) {
      return res.status(404).json({ ok: false, error: "Student not found" });
    }

    const triageStatus = String(req.body.triage_status || "").trim() || (severity === "หนัก" ? "ส่งโรงพยาบาล" : "รอคัดกรอง");

    const inserted = await insertRow("visits", {
      student_id: toNumber(student.id),
      symptom,
      severity,
      triage_status: triageStatus,
      nurse_id: req.user.id,
      visit_at: visitAt,
      parent_notified: 0,
      event_note: ""
    });

    if (severity === "หนัก") {
      await insertRow("alerts", {
        alert_type: "severity",
        status: "open",
        message: `อาการหนัก: ${student.first_name} ${student.last_name} ต้องส่งต่อโรงพยาบาล`,
        visit_id: inserted.id,
        medicine_id: "",
        resolved_at: ""
      });
    }

    await appendAudit({
      userId: req.user.id,
      action: "create",
      entity: "visits",
      entityId: inserted.id,
      after: inserted
    });

    res.status(201).json({ ok: true, id: inserted.id });
  })
);

router.put(
  "/:id",
  authorizeRoles("admin", "nurse"),
  asyncHandler(async (req, res) => {
    const id = parseIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid visit id" });

    const updated = await updateRowById("visits", id, (current) => {
      const nextSeverity = req.body.severity !== undefined ? String(req.body.severity).trim() : current.severity;
      if (!severityLevels.includes(nextSeverity)) {
        throw new Error("Invalid severity");
      }

      return {
        ...current,
        symptom: req.body.symptom !== undefined ? String(req.body.symptom || "").trim() : current.symptom,
        severity: nextSeverity,
        triage_status: req.body.triage_status !== undefined ? String(req.body.triage_status || "").trim() : current.triage_status,
        visit_at: req.body.visit_at !== undefined ? toDateTime(req.body.visit_at) : current.visit_at,
        event_note: req.body.event_note !== undefined ? String(req.body.event_note || "").trim() : current.event_note
      };
    });

    if (!updated) {
      return res.status(404).json({ ok: false, error: "Visit not found" });
    }

    await appendAudit({
      userId: req.user.id,
      action: "update",
      entity: "visits",
      entityId: id,
      before: updated.before,
      after: updated.after
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

    const updated = await updateRowById("visits", id, (current) => ({
      ...current,
      triage_status: "ส่งโรงพยาบาล",
      severity: "หนัก",
      event_note: current.event_note ? `${current.event_note} | ${note}` : note
    }));

    if (!updated) {
      return res.status(404).json({ ok: false, error: "Visit not found" });
    }

    await insertRow("alerts", {
      alert_type: "severity",
      status: "open",
      message: `ส่งต่อโรงพยาบาล: visit#${id}`,
      visit_id: id,
      medicine_id: "",
      resolved_at: ""
    });

    await appendAudit({
      userId: req.user.id,
      action: "dispatch",
      entity: "visits",
      entityId: id,
      before: updated.before,
      after: updated.after
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

    const updated = await updateRowById("visits", id, (current) => ({
      ...current,
      parent_notified: 1
    }));

    if (!updated) {
      return res.status(404).json({ ok: false, error: "Visit not found" });
    }

    await appendAudit({
      userId: req.user.id,
      action: "notify_parent",
      entity: "visits",
      entityId: id,
      after: { parent_notified: 1 }
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

    const updated = await updateRowById("visits", id, (current) => ({
      ...current,
      event_note: current.event_note ? `${current.event_note} | ${note}` : note
    }));

    if (!updated) {
      return res.status(404).json({ ok: false, error: "Visit not found" });
    }

    await appendAudit({
      userId: req.user.id,
      action: "append_note",
      entity: "visits",
      entityId: id,
      after: { event_note: updated.after.event_note }
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

    const removed = await deleteRowById("visits", id);
    if (!removed) {
      return res.status(404).json({ ok: false, error: "Visit not found" });
    }

    await appendAudit({
      userId: req.user.id,
      action: "delete",
      entity: "visits",
      entityId: id,
      before: removed
    });

    res.json({ ok: true, message: "Visit deleted" });
  })
);

module.exports = router;
