const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { authenticateToken } = require("../middleware/auth");
const { asyncHandler, readAll, writeAll, toNumber, toBooleanInt, toDateTime } = require("./helpers");

const router = express.Router();

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");
    if (!username || !password) {
      return res.status(400).json({ ok: false, error: "Username and password are required" });
    }

    const users = await readAll("users");
    const user = users.find((item) => String(item.username) === username);

    if (!user || toBooleanInt(user.is_active) !== 1) {
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }

    const isValid = await bcrypt.compare(password, String(user.password_hash || ""));
    if (!isValid) {
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        id: toNumber(user.id),
        username: user.username,
        role: user.role || "nurse"
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "12h"
      }
    );

    res.json({
      ok: true,
      token,
      user: {
        id: toNumber(user.id),
        username: user.username,
        role: user.role || "nurse"
      }
    });
  })
);

router.get(
  "/me",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const users = await readAll("users");
    const user = users.find((item) => toNumber(item.id) === toNumber(req.user.id));
    if (!user) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    res.json({
      ok: true,
      user: {
        id: toNumber(user.id),
        username: user.username,
        role: user.role,
        is_active: toBooleanInt(user.is_active),
        created_at: user.created_at
      }
    });
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

    const users = await readAll("users");
    const index = users.findIndex((item) => toNumber(item.id) === toNumber(req.user.id));
    if (index < 0) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    const user = users[index];
    const isValid = await bcrypt.compare(currentPassword, String(user.password_hash || ""));
    if (!isValid) {
      return res.status(401).json({ ok: false, error: "Current password is incorrect" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    users[index] = {
      ...user,
      password_hash: passwordHash,
      updated_at: toDateTime()
    };

    await writeAll("users", users);
    res.json({ ok: true, message: "Password changed successfully" });
  })
);

module.exports = router;
