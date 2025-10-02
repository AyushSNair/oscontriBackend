import express from "express";
import User from "../models/User.js";
import authenticateToken from "../middleware/auth.js";
import githubService from "../services/githubService.js";

const router = express.Router();

// Test route
router.get("/test", (req, res) => {
  console.log("Test route hit");
  res.json({ message: "Profile router is working!" });
});

// Test update-github route without auth for debugging
router.post("/test-update-github", (req, res) => {
  console.log("Test update-github route hit");
  res.json({ message: "update-github route is accessible", body: req.body });
});

// Simple test for update-github
router.post("/test-github", authenticateToken, async (req, res) => {
  try {
    console.log("Test GitHub route hit");
    const { githubUsername } = req.body;
    const userId = req.userId;
    
    console.log("Test data:", { githubUsername, userId });
    
    res.json({ 
      message: "Test successful", 
      data: { githubUsername, userId } 
    });
  } catch (error) {
    console.error("Test error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get current user's profile (protected) - MUST come before /:profileUrl
router.get("/", authenticateToken, async (req, res) => {
  console.log("Profile route hit - GET /");
  try {
    const userId = req.userId;
    console.log("User ID:", userId);
    const user = await User.findById(userId);
    
    if (!user) {
      console.log("User not found");
      return res.status(404).json({ error: "User not found" });
    }

    console.log("User found:", user.username);
    res.json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        githubUsername: user.githubUsername,
        profileUrl: user.profileUrl,
        contributions: user.contributions,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error("Profile fetch error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// One-time GitHub connect: verify username, save once, fetch contributions
router.post("/update-github", authenticateToken, async (req, res) => {
  try {
    console.log("Update GitHub request received");
    const { githubUsername } = req.body;
    const userId = req.userId;
    
    console.log("Request data:", { githubUsername, userId });

    if (!githubUsername) {
      console.log("No GitHub username provided");
      return res.status(400).json({ error: "GitHub username is required" });
    }

    // Load user document
    console.log("Finding user with ID:", userId);
    const user = await User.findById(userId);
    if (!user) {
      console.log("User not found");
      return res.status(404).json({ error: "User not found" });
    }

    console.log("User found:", user.username);

    // Enforce one-time connect
    if (user.githubUsername) {
      return res.status(409).json({ error: "GitHub is already connected for this account" });
    }

    // Verify GitHub username exists
    const verification = await githubService.verifyUsername(githubUsername.trim());
    if (!verification.exists) {
      return res.status(404).json({ error: "GitHub username not found" });
    }

    // Set username and profile url
    user.githubUsername = githubUsername.trim();
    if (!user.profileUrl) {
      user.profileUrl = `profile-${user._id.toString().slice(-8)}`;
    }
    user.githubConnectedAt = new Date();

    // Fetch initial contributions
    let contributions = { totalPoints: 0, repositories: [], lastUpdated: new Date() };
    try {
      contributions = await githubService.analyzeContributions(user.githubUsername);
    } catch (e) {
      console.warn("Failed to fetch contributions on connect:", e.message);
    }

    user.contributions = contributions;
    await user.save();

    res.json({
      message: "GitHub connected successfully",
      user: {
        id: user._id,
        username: user.username,
        githubUsername: user.githubUsername,
        profileUrl: user.profileUrl,
        contributions: user.contributions
      }
    });
  } catch (error) {
    console.error("GitHub update error:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ 
      error: "Internal server error",
      details: error.message 
    });
  }
});

// Refresh contributions (protected)
router.post("/refresh-contributions", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.githubUsername) {
      return res.status(400).json({ error: "GitHub username not set" });
    }

    // Fetch fresh contribution data
    const contributions = await githubService.analyzeContributions(user.githubUsername);
    
    // Update contributions directly
    user.contributions = {
      ...contributions,
      lastUpdated: new Date()
    };
    await user.save();

    res.json({
      message: "Contributions refreshed successfully",
      contributions: user.contributions
    });
  } catch (error) {
    console.error("Contribution refresh error:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ 
      error: "Internal server error",
      details: error.message 
    });
  }
});

// Get user profile by profile URL (public) - MUST come after other routes
router.get("/:profileUrl", async (req, res) => {
  try {
    const { profileUrl } = req.params;
    
    const user = await User.findOne({ profileUrl });
    if (!user) {
      return res.status(404).json({ error: "Profile not found" });
    }

    res.json({
      user: {
        id: user._id,
        username: user.username,
        githubUsername: user.githubUsername,
        profileUrl: user.profileUrl,
        contributions: user.contributions,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error("Profile fetch error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
