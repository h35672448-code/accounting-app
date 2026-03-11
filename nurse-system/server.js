require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { pingDatabase } = require("./database/db");
const { pullEntity, initializeDriveStoreIfEmpty } = require("./services/driveStore");

const app = express();
const rawPort = process.env.PORT || "4000";
const parsedPort = Number(rawPort);
const port = Number.isInteger(parsedPort) && parsedPort >= 0 && parsedPort <= 65535 ? parsedPort : 4000;
const provider = String(process.env.DATA_PROVIDER || "mysql").trim().toLowerCase();

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is required. Set it in .env before starting the server.");
}

if (port !== parsedPort) {
  console.warn(`Invalid PORT value ${JSON.stringify(rawPort)}; fallback to 4000`);
}

if (!["mysql", "drive"].includes(provider)) {
  throw new Error("DATA_PROVIDER must be either 'mysql' or 'drive'");
}

const routesPath = provider === "drive" ? "./routes-drive" : "./routes";
const authRoutes = require(`${routesPath}/auth`);
const studentsRoutes = require(`${routesPath}/students`);
const medicinesRoutes = require(`${routesPath}/medicines`);
const visitsRoutes = require(`${routesPath}/visits`);
const newsRoutes = require(`${routesPath}/news`);
const feedbackRoutes = require(`${routesPath}/feedback`);
const dashboardRoutes = require(`${routesPath}/dashboard`);

const uploadDir = path.join(process.cwd(), process.env.UPLOAD_DIR || "public/uploads");
fs.mkdirSync(uploadDir, { recursive: true });

app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : true,
    credentials: true
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

app.use("/uploads", express.static(uploadDir));

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    message: "Nurse API is running",
    provider,
    endpoints: {
      health: "/api/health",
      auth: "/api/auth/login",
      students: "/api/students",
      visits: "/api/visits",
      medicines: "/api/medicines"
    }
  });
});

app.get("/health", (_req, res) => {
  res.redirect(302, "/api/health");
});

app.get("/api/health", async (_req, res, next) => {
  try {
    if (provider === "mysql") {
      await pingDatabase();
      return res.json({
        ok: true,
        message: "Nurse API is running",
        provider,
        database: "connected"
      });
    }

    await pullEntity("users");
    return res.json({
      ok: true,
      message: "Nurse API is running",
      provider,
      database: "connected"
    });
  } catch (error) {
    return next(error);
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/students", studentsRoutes);
app.use("/api/medicines", medicinesRoutes);
app.use("/api/visits", visitsRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.use((_req, res) => {
  res.status(404).json({ ok: false, error: "Not found" });
});

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  res.status(status).json({
    ok: false,
    error: error.message || "Internal server error"
  });
});

function bootstrap() {
  const server = app.listen(port, () => {
    console.log(`Nurse API listening on http://localhost:${port}`);
    console.log(`Data provider: ${provider}`);

    if (provider === "drive" && process.env.DRIVE_AUTO_SEED !== "0") {
      console.log("Initializing Drive seed data in background...");
      initializeDriveStoreIfEmpty(__dirname)
        .then(() => {
          console.log("Drive seed initialization completed.");
        })
        .catch((error) => {
          console.error("Drive seed initialization failed:", error.message || error);
        });
    }
  });

  server.on("error", (error) => {
    if (error && error.code === "EADDRINUSE") {
      console.error(`Failed to start server: port ${port} is already in use.`);
      console.error(`Close the existing process or run with another PORT, e.g. PORT=${port + 1} npm start`);
      process.exit(1);
    }

    console.error("Failed to start server:", error.message || error);
    process.exit(1);
  });
}

bootstrap();
