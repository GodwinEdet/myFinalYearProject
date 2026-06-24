import mongoose from "mongoose";

let isConnected = false;

export default async function connectDB() {
  if (isConnected) return;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("MONGODB_URI not set — skipping DB connection.");
    return;
  }

  try {
    await mongoose.connect(uri, {
      dbName: "malaria_detection",
    });
    isConnected = true;
    console.log("MongoDB connected ✓");
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    // Don't crash the server — app can still run without history logging
  }
}
