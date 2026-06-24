import express from "express";
import multer from "multer";
import FormData from "form-data";
import fetch from "node-fetch";
import Result from "../models/Result.js";

const router = express.Router();

// Store in memory (don't write to disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/tiff", "image/bmp"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only JPEG, PNG, TIFF and BMP images are accepted."));
    }
    cb(null, true);
  },
});

router.post("/", upload.single("image"), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ message: "No image file provided." });
  }

  const ML_API_URL = process.env.ML_API_URL;
  if (!ML_API_URL) {
    return res.status(503).json({ message: "ML service URL not configured." });
  }

  const startTime = Date.now();

  try {
    // Forward image to Python FastAPI service
    const form = new FormData();
    form.append("file", req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    const mlResponse = await fetch(`${ML_API_URL}/predict`, {
      method: "POST",
      body: form,
      headers: form.getHeaders(),
      timeout: 60000, // 60s timeout for inference
    });

    if (!mlResponse.ok) {
      const errBody = await mlResponse.text();
      console.error("ML service error:", errBody);
      return res.status(502).json({ message: "ML service returned an error." });
    }

    const data = await mlResponse.json();
    const processingMs = Date.now() - startTime;

    // Log to MongoDB (fire-and-forget — don't block the response)
    Result.create({
      filename: req.file.originalname,
      label: data.label,
      confidence: data.confidence,
      metrics: data.metrics,
      processingMs,
      ip: req.ip,
      // Omit heatmap from DB to save space (it's large base64)
    }).catch((err) => console.error("DB log error:", err.message));

    return res.json({ ...data, processingMs });
  } catch (err) {
    if (err.type === "request-timeout") {
      return res
        .status(504)
        .json({ message: "ML service timed out. Try again." });
    }
    next(err);
  }
});

export default router;
