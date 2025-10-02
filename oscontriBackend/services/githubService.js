import axios from 'axios';

class GitHubService {
  constructor() {
    this.baseURL = 'https://api.github.com';
    this.headers = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'OSContributionTracker'
    };
    
    // Add GitHub token if available (optional, for higher rate limits)
    if (process.env.GITHUB_TOKEN) {
      this.headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
    }
  }

  // Calculate points based on contribution type and repository
  calculatePoints(contribution) {
    let points = 0;
    
    // Base points for different contribution types
    const contributionTypes = {
      'commit': 10,
      'pull_request': 25,
      'issue': 15,
      'review': 20,
      'star': 5,
      'fork': 8
    };

    // Repository type multipliers
    const repoMultipliers = {
      'popular': 1.5,      // 1000+ stars
      'medium': 1.2,       // 100-999 stars
      'small': 1.0,        // <100 stars
      'personal': 0.8      // Personal projects
    };

    // Get base points for contribution type
    points = contributionTypes[contribution.type] || 5;

    // Apply repository multiplier
    const stars = contribution.repository?.stargazers_count || 0;
    let multiplier = repoMultipliers.personal;
    
    if (stars >= 1000) multiplier = repoMultipliers.popular;
    else if (stars >= 100) multiplier = repoMultipliers.medium;
    else if (stars >= 10) multiplier = repoMultipliers.small;

    return Math.round(points * multiplier);
  }

  // Fetch user's repositories
  async getUserRepositories(username) {
    try {
      const response = await axios.get(
        `${this.baseURL}/users/${username}/repos?sort=updated&per_page=100`,
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching repositories:', error.message);
      throw new Error('Failed to fetch repositories');
    }
  }

  // Fetch user's contribution events
  async getUserEvents(username) {
    try {
      const response = await axios.get(
        `${this.baseURL}/users/${username}/events/public?per_page=100`,
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching events:', error.message);
      throw new Error('Failed to fetch user events');
    }
  }

  // Fetch user's pull requests and issues via search API
  async getUserContributionsViaSearch(username) {
    try {
      const [prResponse, issueResponse] = await Promise.all([
        axios.get(
          `${this.baseURL}/search/issues?q=type:pr+author:${username}&sort=updated&per_page=100`,
          { headers: this.headers }
        ),
        axios.get(
          `${this.baseURL}/search/issues?q=type:issue+author:${username}&sort=updated&per_page=100`,
          { headers: this.headers }
        )
      ]);
      
      return [...prResponse.data.items, ...issueResponse.data.items];
    } catch (error) {
      console.error('Error fetching contributions via search:', error.message);
      return []; // Return empty array on error instead of throwing
    }
  }

  // Analyze contributions and calculate points
  async analyzeContributions(username) {
    try {
      console.log(`Analyzing contributions for: ${username}`);
      
      const [repositories, events, searchContributions] = await Promise.all([
        this.getUserRepositories(username),
        this.getUserEvents(username),
        this.getUserContributionsViaSearch(username)
      ]);

      console.log(`Fetched ${events.length} events and ${searchContributions.length} search results`);

      const contributionMap = new Map();
      let totalPoints = 0;

      // Process events to extract contributions (ONLY to other users' repos)
      let eventCount = 0;
      events.forEach(event => {
        const repo = event.repo;
        if (!repo || !repo.name) return;
        
        // GitHub Events API returns repo.name as "owner/reponame"
        const repoKey = repo.name;
        const [repoOwner, repoName] = repoKey.split('/');
        
        // Skip if this is the user's own repository
        if (!repoOwner || repoOwner.toLowerCase() === username.toLowerCase()) {
          return;
        }
        
        eventCount++;
        
        if (!contributionMap.has(repoKey)) {
          const repoData = repositories.find(r => r.full_name === repoKey);
          contributionMap.set(repoKey, {
            name: repoName || repoKey,
            owner: repoOwner,
            url: repoData?.html_url || `https://github.com/${repoKey}`,
            contributions: 0,
            points: 0,
            lastContribution: null,
            stargazers_count: repoData?.stargazers_count || 0
          });
        }

        const repoContributions = contributionMap.get(repoKey);
        repoContributions.contributions += 1;

        // Calculate points based on event type
        const eventType = event.type;
        let points = 0;
        const repoData = repositories.find(r => r.full_name === repoKey);

        switch (eventType) {
          case 'PushEvent':
            points = this.calculatePoints({ type: 'commit', repository: repoData });
            break;
          case 'PullRequestEvent':
            points = this.calculatePoints({ type: 'pull_request', repository: repoData });
            break;
          case 'IssuesEvent':
            points = this.calculatePoints({ type: 'issue', repository: repoData });
            break;
          case 'WatchEvent':
            points = this.calculatePoints({ type: 'star', repository: repoData });
            break;
          case 'ForkEvent':
            points = this.calculatePoints({ type: 'fork', repository: repoData });
            break;
          default:
            points = 2; // Default points for other events
        }

        repoContributions.points += points;
        totalPoints += points;

        // Update last contribution date
        const eventDate = new Date(event.created_at);
        if (!repoContributions.lastContribution || eventDate > repoContributions.lastContribution) {
          repoContributions.lastContribution = eventDate;
        }
      });

      // Process search results (PRs and Issues) - filter out user's own repos
      let searchCount = 0;
      searchContributions.forEach(item => {
        const repoUrl = item.repository_url;
        if (!repoUrl) return;
        
        const urlParts = repoUrl.split('/');
        const repoOwner = urlParts[urlParts.length - 2];
        const repoName = urlParts[urlParts.length - 1];
        const repoKey = `${repoOwner}/${repoName}`;
        
        // Skip if this is the user's own repository
        if (repoOwner.toLowerCase() === username.toLowerCase()) {
          return;
        }
        
        searchCount++;
        
        if (!contributionMap.has(repoKey)) {
          const repoData = repositories.find(r => r.full_name === repoKey);
          contributionMap.set(repoKey, {
            name: repoName,
            owner: repoOwner,
            url: `https://github.com/${repoKey}`,
            contributions: 0,
            points: 0,
            lastContribution: null,
            stargazers_count: repoData?.stargazers_count || 0
          });
        }

        const repoContributions = contributionMap.get(repoKey);
        repoContributions.contributions += 1;

        // Calculate points
        const isPR = !!item.pull_request;
        const points = isPR ? 
          this.calculatePoints({ type: 'pull_request', repository: repositories.find(r => r.full_name === repoKey) }) :
          this.calculatePoints({ type: 'issue', repository: repositories.find(r => r.full_name === repoKey) });

        repoContributions.points += points;
        totalPoints += points;

        // Update last contribution date
        const itemDate = new Date(item.updated_at || item.created_at);
        if (!repoContributions.lastContribution || itemDate > repoContributions.lastContribution) {
          repoContributions.lastContribution = itemDate;
        }
      });

      console.log(`Processed ${eventCount} external events and ${searchCount} search contributions`);
      console.log(`Found ${contributionMap.size} unique repositories`);

      // Convert map to array and sort by points
      const repositoriesArray = Array.from(contributionMap.values())
        .sort((a, b) => b.points - a.points);

      return {
        totalPoints,
        repositories: repositoriesArray.map(repo => ({
          name: repo.name,
          owner: repo.owner,
          url: repo.url,
          contributions: repo.contributions,
          points: repo.points,
          lastContribution: repo.lastContribution
        })),
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('Error analyzing contributions:', error.message);
      throw new Error('Failed to analyze contributions');
    }
  }

  // Verify GitHub username exists
  async verifyUsername(username) {
    try {
      const response = await axios.get(
        `${this.baseURL}/users/${username}`,
        { headers: this.headers }
      );
      return {
        exists: true,
        data: {
          login: response.data.login,
          name: response.data.name,
          avatar_url: response.data.avatar_url,
          public_repos: response.data.public_repos,
          followers: response.data.followers,
          following: response.data.following
        }
      };
    } catch (error) {
      if (error.response?.status === 404) {
        return { exists: false };
      }
      throw new Error('Failed to verify GitHub username');
    }
  }
}

export default new GitHubService();
