const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../database/db");
const { authenticateToken } = require("../middleware/auth");
const { asyncHandler } = require("./helpers");

const router = express.Router();

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");

    if (!username || !password) {
      return res.status(400).json({ ok: false, error: "Username and password are required" });
    }

    const [rows] = await pool.execute(
      `
        SELECT id, username, password_hash, role, is_active
        FROM users
        WHERE username = ?
        LIMIT 1
      `,
      [username]
    );

    if (rows.length === 0 || rows[0].is_active !== 1) {
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }

    const user = rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "12h"
      }
    );

    return res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  })
);

router.get(
  "/me",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const [rows] = await pool.execute(
      `
        SELECT id, username, role, is_active, created_at
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    return res.json({ ok: true, user: rows[0] });
  })
);

router.post(
  "/change-password",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const currentPassword = String(req.body.current_password || "");
    const newPassword = String(req.body.new_password || "");

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ ok: false, error: "current_password and new_password are required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ ok: false, error: "new_password must be at least 8 characters" });
    }

    const [rows] = await pool.execute("SELECT id, password_hash FROM users WHERE id = ? LIMIT 1", [req.user.id]);

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    const isValid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!isValid) {
      return res.status(401).json({ ok: false, error: "Current password is incorrect" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.execute("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, req.user.id]);

    return res.json({ ok: true, message: "Password changed successfully" });
  })
);

module.exports = router;
