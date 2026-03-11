const express = require("express");
const path = require("path");
const { pool } = require("../database/db");
const { logAudit } = require("../database/audit");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const { createUploader } = require("../middleware/upload");
const { asyncHandler, parseIntOrNull, toMysqlDateTime } = require("./helpers");

const router = express.Router();
const upload = createUploader("news");

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.execute(
      `
        SELECT n.id, n.title, n.detail, n.image_url, n.published_at, n.author_id, u.username AS author_name
        FROM news n
        LEFT JOIN users u ON u.id = n.author_id
        ORDER BY n.published_at DESC
      `
    );

    res.json({ ok: true, data: rows });
  })
);

router.post(
  "/",
  authenticateToken,
  authorizeRoles("admin", "nurse"),
  upload.single("image"),
  asyncHandler(async (req, res) => {
    const title = String(req.body.title || "").trim();
    const detail = String(req.body.detail || "").trim();
    const publishedAt = toMysqlDateTime(req.body.published_at) || toMysqlDateTime();
    const imageUrl = req.file ? `/uploads/news/${path.basename(req.file.path)}` : String(req.body.image_url || "").trim() || null;

    if (!title || !detail) {
      return res.status(400).json({ ok: false, error: "title and detail are required" });
    }

    const [result] = await pool.execute(
      `
        INSERT INTO news (title, detail, image_url, published_at, author_id)
        VALUES (?, ?, ?, ?, ?)
      `,
      [title, detail, imageUrl, publishedAt, req.user.id]
    );

    await logAudit({
      userId: req.user.id,
      action: "create",
      entity: "news",
      entityId: result.insertId,
      after: { title, published_at: publishedAt }
    });

    res.status(201).json({ ok: true, id: result.insertId });
  })
);

router.put(
  "/:id",
  authenticateToken,
  authorizeRoles("admin", "nurse"),
  upload.single("image"),
  asyncHandler(async (req, res) => {
    const id = parseIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid news id" });

    const [rows] = await pool.execute("SELECT * FROM news WHERE id = ? LIMIT 1", [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: "News not found" });
    }

    const current = rows[0];
    const payload = {
      title: req.body.title !== undefined ? String(req.body.title || "").trim() : current.title,
      detail: req.body.detail !== undefined ? String(req.body.detail || "").trim() : current.detail,
      image_url: req.file
        ? `/uploads/news/${path.basename(req.file.path)}`
        : req.body.image_url !== undefined
          ? String(req.body.image_url || "").trim() || null
          : current.image_url,
      published_at: req.body.published_at !== undefined ? toMysqlDateTime(req.body.published_at) : current.published_at
    };

    if (!payload.title || !payload.detail || !payload.published_at) {
      return res.status(400).json({ ok: false, error: "Invalid news payload" });
    }

    await pool.execute(
      `
        UPDATE news
        SET title = ?, detail = ?, image_url = ?, published_at = ?
        WHERE id = ?
      `,
      [payload.title, payload.detail, payload.image_url, payload.published_at, id]
    );

    await logAudit({
      userId: req.user.id,
      action: "update",
      entity: "news",
      entityId: id,
      before: current,
      after: payload
    });

    res.json({ ok: true, message: "News updated" });
  })
);

router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles("admin"),
  asyncHandler(async (req, res) => {
    const id = parseIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid news id" });

    const [rows] = await pool.execute("SELECT * FROM news WHERE id = ? LIMIT 1", [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: "News not found" });
    }

    await pool.execute("DELETE FROM news WHERE id = ?", [id]);

    await logAudit({
      userId: req.user.id,
      action: "delete",
      entity: "news",
      entityId: id,
      before: rows[0]
    });

    res.json({ ok: true, message: "News deleted" });
  })
);

module.exports = router;
