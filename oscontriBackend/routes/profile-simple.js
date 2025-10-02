import express from "express";
import User from "../models/User.js";
import authenticateToken from "../middleware/auth.js";

const router = express.Router();

// Test route
router.get("/test", (req, res) => {
  res.json({ message: "Simple profile router working!" });
});

// Very simple test for POST
router.post("/test-post", authenticateToken, (req, res) => {
  console.log("Test POST route hit");
  res.json({ 
    message: "POST route working!", 
    userId: req.userId,
    body: req.body 
  });
});

// Test without authentication
router.post("/test-no-auth", (req, res) => {
  console.log("Test POST route hit (no auth)");
  res.json({ 
    message: "POST route working without auth!", 
    body: req.body 
  });
});

// Simple GitHub update - NO AUTH, NO DATABASE OPERATIONS
router.post("/update-github", (req, res) => {
  try {
    console.log("=== GitHub update request started (NO AUTH, NO DB) ===");
    const { githubUsername } = req.body;
    
    console.log("Request data:", { githubUsername, body: req.body });

    if (!githubUsername) {
      console.log("No GitHub username provided");
      return res.status(400).json({ error: "GitHub username is required" });
    }

    console.log("Sending success response (NO AUTH, NO DB SAVE)");
    res.json({
      message: "GitHub profile updated successfully! (Test mode - no auth, no database save)",
      user: {
        id: "test-id",
        username: "testuser",
        githubUsername: githubUsername,
        profileUrl: `profile-test-${Date.now()}`,
        contributions: {
          totalPoints: 0,
          repositories: [],
          lastUpdated: new Date()
        }
      }
    });
    console.log("=== GitHub update request completed successfully (NO AUTH, NO DB) ===");
  } catch (error) {
    console.error("=== ERROR IN GITHUB UPDATE (NO AUTH, NO DB) ===");
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    console.error("Error name:", error.name);
    console.error("=== END ERROR ===");
    res.status(500).json({ 
      error: "Internal server error",
      details: error.message 
    });
  }
});

export default router;
