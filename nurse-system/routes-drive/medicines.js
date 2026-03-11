const express = require("express");
const path = require("path");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const { createUploader } = require("../middleware/upload");
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
const upload = createUploader("medicines");

router.use(authenticateToken);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || "").trim().toLowerCase();
    const lowStock = String(req.query.low_stock || "") === "1";

    const rows = await readAll("medicines");
    let data = rows;

    if (q) {
      data = data.filter((medicine) => {
        const blob = `${medicine.medicine_code} ${medicine.name}`.toLowerCase();
        return blob.includes(q);
      });
    }

    if (lowStock) {
      data = data.filter((medicine) => toNumber(medicine.stock_qty) <= toNumber(medicine.reorder_level));
    }

    data.sort((a, b) => toNumber(a.stock_qty) - toNumber(b.stock_qty));
    res.json({ ok: true, data });
  })
);

router.get(
  "/alerts/low-stock",
  asyncHandler(async (_req, res) => {
    const medicines = await readAll("medicines");
    const data = medicines
      .filter((medicine) => toNumber(medicine.stock_qty) <= toNumber(medicine.reorder_level))
      .sort((a, b) => toNumber(a.stock_qty) - toNumber(b.stock_qty));

    res.json({ ok: true, data });
  })
);

router.post(
  "/",
  authorizeRoles("admin", "nurse"),
  upload.single("image"),
  asyncHandler(async (req, res) => {
    const payload = {
      medicine_code: String(req.body.medicine_code || "").trim(),
      name: String(req.body.name || "").trim(),
      image_url: req.file
        ? `/uploads/medicines/${path.basename(req.file.path)}`
        : String(req.body.image_url || "").trim(),
      stock_qty: Number(req.body.stock_qty ?? 0),
      reorder_level: Number(req.body.reorder_level ?? 10),
      expire_date: String(req.body.expire_date || "").trim()
    };

    if (!payload.medicine_code || !payload.name || Number.isNaN(payload.stock_qty) || Number.isNaN(payload.reorder_level)) {
      return res.status(400).json({ ok: false, error: "medicine_code, name, stock_qty, reorder_level are required" });
    }

    const medicines = await readAll("medicines");
    if (medicines.some((item) => String(item.medicine_code) === payload.medicine_code)) {
      return res.status(400).json({ ok: false, error: "medicine_code already exists" });
    }

    const inserted = await insertRow("medicines", payload);

    await appendAudit({
      userId: req.user.id,
      action: "create",
      entity: "medicines",
      entityId: inserted.id,
      after: inserted
    });

    res.status(201).json({ ok: true, id: inserted.id });
  })
);

router.put(
  "/:id",
  authorizeRoles("admin", "nurse"),
  upload.single("image"),
  asyncHandler(async (req, res) => {
    const id = parseIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid medicine id" });

    const medicines = await readAll("medicines");
    const updates = {
      medicine_code: req.body.medicine_code,
      name: req.body.name,
      image_url: req.file
        ? `/uploads/medicines/${path.basename(req.file.path)}`
        : req.body.image_url,
      stock_qty: req.body.stock_qty,
      reorder_level: req.body.reorder_level,
      expire_date: req.body.expire_date
    };

    const duplicated = medicines.some(
      (item) => toNumber(item.id) !== id && updates.medicine_code && String(item.medicine_code) === String(updates.medicine_code)
    );

    if (duplicated) {
      return res.status(400).json({ ok: false, error: "medicine_code already exists" });
    }

    const updated = await updateRowById("medicines", id, (current) => {
      const nextStock = updates.stock_qty !== undefined ? Number(updates.stock_qty) : toNumber(current.stock_qty);
      const nextReorder = updates.reorder_level !== undefined ? Number(updates.reorder_level) : toNumber(current.reorder_level);
      if (Number.isNaN(nextStock) || Number.isNaN(nextReorder)) {
        throw new Error("Invalid stock_qty or reorder_level");
      }

      return {
        ...current,
        medicine_code: updates.medicine_code !== undefined ? String(updates.medicine_code).trim() : current.medicine_code,
        name: updates.name !== undefined ? String(updates.name).trim() : current.name,
        image_url: updates.image_url !== undefined ? String(updates.image_url || "").trim() : current.image_url,
        stock_qty: nextStock,
        reorder_level: nextReorder,
        expire_date: updates.expire_date !== undefined ? String(updates.expire_date || "").trim() : current.expire_date,
        updated_at: toDateTime()
      };
    });

    if (!updated) {
      return res.status(404).json({ ok: false, error: "Medicine not found" });
    }

    await appendAudit({
      userId: req.user.id,
      action: "update",
      entity: "medicines",
      entityId: id,
      before: updated.before,
      after: updated.after
    });

    res.json({ ok: true, message: "Medicine updated" });
  })
);

router.post(
  "/:id/issue",
  authorizeRoles("admin", "nurse"),
  asyncHandler(async (req, res) => {
    const id = parseIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid medicine id" });

    const qty = Number(req.body.qty ?? 1);
    if (!Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({ ok: false, error: "qty must be a positive integer" });
    }

    const note = String(req.body.note || "").trim() || "";

    const medicines = await readAll("medicines");
    const medicineIndex = medicines.findIndex((medicine) => toNumber(medicine.id) === id);
    if (medicineIndex < 0) {
      return res.status(404).json({ ok: false, error: "Medicine not found" });
    }

    const medicine = medicines[medicineIndex];
    const beforeQty = toNumber(medicine.stock_qty);
    const reorderLevel = toNumber(medicine.reorder_level);

    if (beforeQty < qty) {
      return res.status(400).json({ ok: false, error: "Not enough stock" });
    }

    const afterQty = beforeQty - qty;
    medicines[medicineIndex] = {
      ...medicine,
      stock_qty: afterQty,
      updated_at: toDateTime()
    };
    await writeAll("medicines", medicines);

    const stockLogs = await readAll("medicine_stock_logs");
    const stockLogId = stockLogs.reduce((max, item) => Math.max(max, toNumber(item.id)), 0) + 1;
    stockLogs.push({
      id: stockLogId,
      medicine_id: id,
      actor_id: req.user.id,
      action_type: "issue",
      qty_before: beforeQty,
      qty_change: -qty,
      qty_after: afterQty,
      note,
      created_at: toDateTime()
    });
    await writeAll("medicine_stock_logs", stockLogs);

    if (afterQty <= reorderLevel) {
      const alerts = await readAll("alerts");
      const alertId = alerts.reduce((max, item) => Math.max(max, toNumber(item.id)), 0) + 1;
      alerts.push({
        id: alertId,
        alert_type: "stock",
        status: "open",
        message: `ยาใกล้หมด: ${medicine.name} คงเหลือ ${afterQty}`,
        visit_id: "",
        medicine_id: id,
        created_at: toDateTime(),
        resolved_at: ""
      });
      await writeAll("alerts", alerts);
    }

    await appendAudit({
      userId: req.user.id,
      action: "issue",
      entity: "medicines",
      entityId: id,
      before: { stock_qty: beforeQty },
      after: { stock_qty: afterQty }
    });

    res.json({ ok: true, stock_qty: afterQty });
  })
);

router.delete(
  "/:id",
  authorizeRoles("admin"),
  asyncHandler(async (req, res) => {
    const id = parseIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid medicine id" });

    const removed = await deleteRowById("medicines", id);
    if (!removed) {
      return res.status(404).json({ ok: false, error: "Medicine not found" });
    }

    await appendAudit({
      userId: req.user.id,
      action: "delete",
      entity: "medicines",
      entityId: id,
      before: removed
    });

    res.json({ ok: true, message: "Medicine deleted" });
  })
);

module.exports = router;
