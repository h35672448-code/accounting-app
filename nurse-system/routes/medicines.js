const express = require("express");
const path = require("path");
const { pool } = require("../database/db");
const { logAudit } = require("../database/audit");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const { createUploader } = require("../middleware/upload");
const { asyncHandler, parseIntOrNull } = require("./helpers");

const router = express.Router();
const upload = createUploader("medicines");

router.use(authenticateToken);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || "").trim();
    const lowStock = String(req.query.low_stock || "") === "1";

    let sql = `
      SELECT id, medicine_code, name, image_url, stock_qty, reorder_level, expire_date, created_at, updated_at
      FROM medicines
      WHERE 1=1
    `;
    const params = [];

    if (q) {
      sql += " AND (medicine_code LIKE ? OR name LIKE ?)";
      const like = `%${q}%`;
      params.push(like, like);
    }

    if (lowStock) {
      sql += " AND stock_qty <= reorder_level";
    }

    sql += " ORDER BY stock_qty ASC, name ASC";

    const [rows] = await pool.execute(sql, params);
    res.json({ ok: true, data: rows });
  })
);

router.get(
  "/alerts/low-stock",
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.execute(
      `
        SELECT id, medicine_code, name, stock_qty, reorder_level
        FROM medicines
        WHERE stock_qty <= reorder_level
        ORDER BY stock_qty ASC
      `
    );

    res.json({ ok: true, data: rows });
  })
);

router.post(
  "/",
  authorizeRoles("admin", "nurse"),
  upload.single("image"),
  asyncHandler(async (req, res) => {
    const medicineCode = String(req.body.medicine_code || "").trim();
    const name = String(req.body.name || "").trim();
    const stockQty = Number(req.body.stock_qty ?? 0);
    const reorderLevel = Number(req.body.reorder_level ?? 10);
    const expireDate = String(req.body.expire_date || "").trim() || null;

    if (!medicineCode || !name || Number.isNaN(stockQty) || Number.isNaN(reorderLevel)) {
      return res.status(400).json({ ok: false, error: "medicine_code, name, stock_qty, reorder_level are required" });
    }

    const imageUrl = req.file ? `/uploads/medicines/${path.basename(req.file.path)}` : String(req.body.image_url || "").trim() || null;

    const [result] = await pool.execute(
      `
        INSERT INTO medicines (medicine_code, name, image_url, stock_qty, reorder_level, expire_date)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [medicineCode, name, imageUrl, stockQty, reorderLevel, expireDate]
    );

    await logAudit({
      userId: req.user.id,
      action: "create",
      entity: "medicines",
      entityId: result.insertId,
      after: {
        medicine_code: medicineCode,
        name,
        stock_qty: stockQty,
        reorder_level: reorderLevel,
        expire_date: expireDate
      }
    });

    res.status(201).json({ ok: true, id: result.insertId });
  })
);

router.put(
  "/:id",
  authorizeRoles("admin", "nurse"),
  upload.single("image"),
  asyncHandler(async (req, res) => {
    const id = parseIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid medicine id" });

    const [rows] = await pool.execute("SELECT * FROM medicines WHERE id = ? LIMIT 1", [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Medicine not found" });
    }

    const current = rows[0];
    const payload = {
      medicine_code: String(req.body.medicine_code || current.medicine_code).trim(),
      name: String(req.body.name || current.name).trim(),
      image_url: req.file
        ? `/uploads/medicines/${path.basename(req.file.path)}`
        : req.body.image_url !== undefined
          ? String(req.body.image_url || "").trim() || null
          : current.image_url,
      stock_qty: req.body.stock_qty !== undefined ? Number(req.body.stock_qty) : current.stock_qty,
      reorder_level: req.body.reorder_level !== undefined ? Number(req.body.reorder_level) : current.reorder_level,
      expire_date: req.body.expire_date !== undefined ? String(req.body.expire_date || "").trim() || null : current.expire_date
    };

    if (Number.isNaN(payload.stock_qty) || Number.isNaN(payload.reorder_level)) {
      return res.status(400).json({ ok: false, error: "Invalid stock_qty or reorder_level" });
    }

    await pool.execute(
      `
        UPDATE medicines
        SET medicine_code = ?, name = ?, image_url = ?, stock_qty = ?, reorder_level = ?, expire_date = ?
        WHERE id = ?
      `,
      [
        payload.medicine_code,
        payload.name,
        payload.image_url,
        payload.stock_qty,
        payload.reorder_level,
        payload.expire_date,
        id
      ]
    );

    await logAudit({
      userId: req.user.id,
      action: "update",
      entity: "medicines",
      entityId: id,
      before: current,
      after: payload
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

    const note = String(req.body.note || "").trim() || null;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [rows] = await connection.execute("SELECT * FROM medicines WHERE id = ? FOR UPDATE", [id]);
      if (rows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ ok: false, error: "Medicine not found" });
      }

      const medicine = rows[0];
      if (medicine.stock_qty < qty) {
        await connection.rollback();
        return res.status(400).json({ ok: false, error: "Not enough stock" });
      }

      const beforeQty = medicine.stock_qty;
      const afterQty = medicine.stock_qty - qty;

      await connection.execute("UPDATE medicines SET stock_qty = ? WHERE id = ?", [afterQty, id]);
      await connection.execute(
        `
          INSERT INTO medicine_stock_logs (medicine_id, actor_id, action_type, qty_before, qty_change, qty_after, note)
          VALUES (?, ?, 'issue', ?, ?, ?, ?)
        `,
        [id, req.user.id, beforeQty, -qty, afterQty, note]
      );

      if (afterQty <= medicine.reorder_level) {
        await connection.execute(
          `
            INSERT INTO alerts (alert_type, status, message, medicine_id)
            VALUES ('stock', 'open', ?, ?)
          `,
          [`ยาใกล้หมด: ${medicine.name} คงเหลือ ${afterQty}`, id]
        );
      }

      await logAudit({
        userId: req.user.id,
        action: "issue",
        entity: "medicines",
        entityId: id,
        before: { stock_qty: beforeQty },
        after: { stock_qty: afterQty },
        connection
      });

      await connection.commit();
      res.json({ ok: true, stock_qty: afterQty });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

router.delete(
  "/:id",
  authorizeRoles("admin"),
  asyncHandler(async (req, res) => {
    const id = parseIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid medicine id" });

    const [rows] = await pool.execute("SELECT * FROM medicines WHERE id = ? LIMIT 1", [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Medicine not found" });
    }

    await pool.execute("DELETE FROM medicines WHERE id = ?", [id]);

    await logAudit({
      userId: req.user.id,
      action: "delete",
      entity: "medicines",
      entityId: id,
      before: rows[0]
    });

    res.json({ ok: true, message: "Medicine deleted" });
  })
);

module.exports = router;
