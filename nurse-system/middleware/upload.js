const fs = require("fs");
const path = require("path");
const multer = require("multer");

const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function createUploader(subFolder) {
  const baseUploadDir = process.env.UPLOAD_DIR || "public/uploads";
  const targetDir = path.join(process.cwd(), baseUploadDir, subFolder);
  ensureDirectory(targetDir);

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, targetDir);
    },
    filename: (_req, file, cb) => {
      const extension = path.extname(file.originalname).toLowerCase();
      const safeBaseName = file.originalname
        .replace(extension, "")
        .replace(/[^a-zA-Z0-9-_]/g, "-")
        .slice(0, 40);
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
      cb(null, `${safeBaseName || "file"}-${unique}${extension}`);
    }
  });

  const fileFilter = (_req, file, cb) => {
    if (!IMAGE_MIME_TYPES.includes(file.mimetype)) {
      cb(new Error("Only JPEG, PNG, WEBP files are allowed"));
      return;
    }

    cb(null, true);
  };

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: MAX_FILE_SIZE }
  });
}

module.exports = {
  createUploader
};
