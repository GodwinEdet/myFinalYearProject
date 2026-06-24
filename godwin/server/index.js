import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import connectDB from "./db.js";
import predictRouter from "./routes/predict.js";
import historyRouter from "./routes/history.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(morgan("dev"));
app.use(express.json());

// API routes
app.use("/api/predict", predictRouter);
app.use("/api/history", historyRouter);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    ml_service: process.env.ML_API_URL,
    timestamp: new Date().toISOString(),
  });
});


// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || "Internal server error",
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`ML service → ${process.env.ML_API_URL}`);
});
