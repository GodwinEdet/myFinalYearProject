import mongoose from "mongoose";

const resultSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    label: { type: String, enum: ["Parasitized", "Uninfected"], required: true },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    metrics: {
      accuracy: Number,
      precision: Number,
      recall: Number,
      f1_score: Number,
      specificity: Number,
    },
    processingMs: Number,
    ip: String,
  },
  { timestamps: true }
);

// Index for fast history queries
resultSchema.index({ createdAt: -1 });

const Result = mongoose.model("Result", resultSchema);
export default Result;
