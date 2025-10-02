import express from "express";
import axios from "axios";

const router = express.Router();

// Search repositories endpoint
router.get("/search", async (req, res) => {
  try {
    const { q, sort = 'stars', order = 'desc', per_page = 30, page = 1 } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }

    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'OSContributionTracker'
    };

    // Add GitHub token if available
    if (process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
    }

    const response = await axios.get('https://api.github.com/search/repositories', {
      headers,
      params: {
        q,
        sort,
        order,
        per_page: Math.min(parseInt(per_page), 100), // GitHub API limit
        page: Math.max(parseInt(page), 1)
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error("GitHub API error:", error.message);
    
    if (error.response?.status === 401) {
      return res.status(401).json({ 
        error: "GitHub API authentication failed. Please add GITHUB_TOKEN to environment variables for higher rate limits." 
      });
    }
    
    if (error.response?.status === 403) {
      return res.status(403).json({ 
        error: "GitHub API rate limit exceeded. Please try again later." 
      });
    }

    res.status(500).json({ 
      error: "Failed to fetch repositories from GitHub API",
      details: error.message 
    });
  }
});

export default router;
