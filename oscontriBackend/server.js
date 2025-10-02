import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.js";
import profileRoutes from "./routes/profile.js";
import repositoryRoutes from "./routes/repositories.js";
import cors from "cors";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Debug middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Connect to MongoDB
async function connectToDatabase() {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/oscontributiontracker';
    await mongoose.connect(mongoURI);
    console.log("Connected to MongoDB successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    process.exit(1);
  }
}

// Routes
console.log("Loading auth routes...");
app.use("/api/auth", authRoutes);
console.log("Auth routes loaded");

console.log("Loading profile routes...");
app.use("/api/profile", profileRoutes);
console.log("Profile routes loaded");

console.log("Loading repository routes...");
app.use("/api/repositories", repositoryRoutes);
console.log("Repository routes loaded");

// Debug: Log available routes
console.log("Available routes:");
console.log("- /api/auth/*");
console.log("- /api/profile/*");
console.log("- /api/repositories/*");

app.get("/", (req, res) => {
  res.json({ message: "Authentication API is running!" });
});

// Test profile route directly
app.get("/api/profile/test", (req, res) => {
  console.log("Direct test route hit");
  res.json({ message: "Direct test route working!" });
});

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await connectToDatabase();
});

export default app;
