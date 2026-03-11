const express = require("express");
const path = require("path");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const { createUploader } = require("../middleware/upload");
const {
  asyncHandler,
  parseIntOrNull,
  readAll,
  insertRow,
  updateRowById,
  deleteRowById,
  appendAudit,
  toNumber,
  toDateTime
} = require("./helpers");

const router = express.Router();
const upload = createUploader("news");

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const [news, users] = await Promise.all([readAll("news"), readAll("users")]);
    const usersMap = new Map(users.map((user) => [toNumber(user.id), user.username]));

    const data = news
      .map((item) => ({
        ...item,
        author_name: usersMap.get(toNumber(item.author_id)) || null
      }))
      .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());

    res.json({ ok: true, data });
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
    const publishedAt = toDateTime(req.body.published_at) || toDateTime();

    if (!title || !detail) {
      return res.status(400).json({ ok: false, error: "title and detail are required" });
    }

    const inserted = await insertRow("news", {
      title,
      detail,
      image_url: req.file
        ? `/uploads/news/${path.basename(req.file.path)}`
        : String(req.body.image_url || "").trim(),
      published_at: publishedAt,
      author_id: req.user.id
    });

    await appendAudit({
      userId: req.user.id,
      action: "create",
      entity: "news",
      entityId: inserted.id,
      after: inserted
    });

    res.status(201).json({ ok: true, id: inserted.id });
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

    const updated = await updateRowById("news", id, (current) => ({
      ...current,
      title: req.body.title !== undefined ? String(req.body.title || "").trim() : current.title,
      detail: req.body.detail !== undefined ? String(req.body.detail || "").trim() : current.detail,
      image_url: req.file
        ? `/uploads/news/${path.basename(req.file.path)}`
        : req.body.image_url !== undefined
          ? String(req.body.image_url || "").trim()
          : current.image_url,
      published_at: req.body.published_at !== undefined ? toDateTime(req.body.published_at) : current.published_at
    }));

    if (!updated) {
      return res.status(404).json({ ok: false, error: "News not found" });
    }

    await appendAudit({
      userId: req.user.id,
      action: "update",
      entity: "news",
      entityId: id,
      before: updated.before,
      after: updated.after
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

    const removed = await deleteRowById("news", id);
    if (!removed) {
      return res.status(404).json({ ok: false, error: "News not found" });
    }

    await appendAudit({
      userId: req.user.id,
      action: "delete",
      entity: "news",
      entityId: id,
      before: removed
    });

    res.json({ ok: true, message: "News deleted" });
  })
);

module.exports = router;
