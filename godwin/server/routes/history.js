import express from "express";
import Result from "../models/Result.js";

const router = express.Router();

// GET /api/history — paginated result history
router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const [results, total] = await Promise.all([
      Result.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("-ip"), // don't expose IP addresses
      Result.countDocuments(),
    ]);

    res.json({
      results,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/history/stats — aggregate stats
router.get("/stats", async (req, res, next) => {
  try {
    const stats = await Result.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          parasitized: {
            $sum: { $cond: [{ $eq: ["$label", "Parasitized"] }, 1, 0] },
          },
          uninfected: {
            $sum: { $cond: [{ $eq: ["$label", "Uninfected"] }, 1, 0] },
          },
          avgConfidence: { $avg: "$confidence" },
          avgProcessingMs: { $avg: "$processingMs" },
        },
      },
    ]);

    res.json(stats[0] || { total: 0, parasitized: 0, uninfected: 0 });
  } catch (err) {
    next(err);
  }
});

export default router;
