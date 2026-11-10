import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
const ADMIN_DIR = path.join(__dirname, "admin");
const POSTS_FILE = path.join(PUBLIC_DIR, "content", "posts.json");
const PORT = process.env.PORT || 8080;

// Auto-load .env if present
function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
          process.env[key] = val;
        }
      }
    } catch (e) {
      console.warn("Could not load .env file:", e.message);
    }
  }
}
loadEnv();

// In-memory token cache for SoundCloud Client Credentials
let scTokenCache = {
  accessToken: null,
  expiresAt: 0
};

// Central helper: sort descending by date, renumber post-1..post-N, and save
function saveAndNormalizePosts(posts) {
  // Sort chronologically descending (newest date first)
  posts.sort((a, b) => {
    const dateA = a.date || "";
    const dateB = b.date || "";
    return dateB.localeCompare(dateA);
  });

  // Renumber sequentially: post-1 at bottom, post-N at top
  const total = posts.length;
  posts.forEach((post, index) => {
    post.id = `post-${total - index}`;
  });

  fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2) + "\n", "utf-8");
  return posts;
}

async function getSoundCloudToken(clientId, clientSecret) {
  const now = Date.now();
  if (scTokenCache.accessToken && scTokenCache.expiresAt > now + 60000) {
    return scTokenCache.accessToken;
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch("https://secure.soundcloud.com/oauth/token", {
    method: "POST",
    headers: {
      "Accept": "application/json; charset=utf-8",
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${basicAuth}`
    },
    body: "grant_type=client_credentials"
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`SoundCloud OAuth token exchange failed (${res.status}): ${errText}`);
  }

  const tokenData = await res.json();
  scTokenCache.accessToken = tokenData.access_token;
  // expires_in is in seconds
  scTokenCache.expiresAt = now + (tokenData.expires_in || 3600) * 1000;
  return scTokenCache.accessToken;
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};

const server = http.createServer((req, res) => {
  // Strip query strings and hash
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // API endpoint to create a new post
  if (req.method === "POST" && pathname === "/api/posts") {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 2e6) {
        req.destroy();
      }
    });

    req.on("end", () => {
      try {
        const newPostData = JSON.parse(body);

        if (!newPostData.title || typeof newPostData.title !== "string") {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "Title is required" }));
        }

        const rawPosts = fs.readFileSync(POSTS_FILE, "utf-8");
        const posts = JSON.parse(rawPosts);

        const postEntry = {
          id: "", // Will be assigned during saveAndNormalizePosts
          title: newPostData.title.trim(),
          date: newPostData.date || new Date().toISOString().slice(0, 10),
          tags: Array.isArray(newPostData.tags)
            ? newPostData.tags
            : (newPostData.tags || "")
              .split(",")
              .map(t => t.trim().toLowerCase())
              .filter(Boolean),
          summary: (newPostData.summary || "").trim(),
          content: (newPostData.content || "").trim(),
          coverImage: newPostData.coverImage ? newPostData.coverImage.trim() : null,
          links: Array.isArray(newPostData.links) ? newPostData.links : []
        };

        posts.push(postEntry);
        saveAndNormalizePosts(posts);

        res.writeHead(201, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ success: true, post: postEntry }));
      } catch (err) {
        console.error("Failed to save post:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Internal server error saving post" }));
      }
    });
    return;
  }

  // API: Update an existing post
  if (req.method === "PUT" && pathname.startsWith("/api/posts/")) {
    const postId = pathname.replace("/api/posts/", "");
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 2e6) req.destroy();
    });

    req.on("end", () => {
      try {
        const updateData = JSON.parse(body);
        if (!updateData.title || typeof updateData.title !== "string") {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "Title is required" }));
        }

        const rawPosts = fs.readFileSync(POSTS_FILE, "utf-8");
        const posts = JSON.parse(rawPosts);
        const index = posts.findIndex(p => p.id === postId);

        if (index === -1) {
          res.writeHead(404, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: `Post with ID "${postId}" not found` }));
        }

        const updatedEntry = {
          id: postId,
          title: updateData.title.trim(),
          date: updateData.date || posts[index].date,
          tags: Array.isArray(updateData.tags)
            ? updateData.tags
            : (updateData.tags || "")
              .split(",")
              .map(t => t.trim().toLowerCase())
              .filter(Boolean),
          summary: (updateData.summary || "").trim(),
          content: (updateData.content || "").trim(),
          coverImage: updateData.coverImage ? updateData.coverImage.trim() : null,
          links: Array.isArray(updateData.links) ? updateData.links : []
        };

        posts[index] = updatedEntry;
        saveAndNormalizePosts(posts);

        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ success: true, post: updatedEntry }));
      } catch (err) {
        console.error("Failed to update post:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Internal server error updating post" }));
      }
    });
    return;
  }

  // API: Delete a post
  if (req.method === "DELETE" && pathname.startsWith("/api/posts/")) {
    const postId = pathname.replace("/api/posts/", "");
    try {
      const rawPosts = fs.readFileSync(POSTS_FILE, "utf-8");
      const posts = JSON.parse(rawPosts);
      const index = posts.findIndex(p => p.id === postId);

      if (index === -1) {
        res.writeHead(404, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: `Post with ID "${postId}" not found` }));
      }

      const removed = posts.splice(index, 1)[0];
      saveAndNormalizePosts(posts);

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ success: true, removedPost: removed }));
    } catch (err) {
      console.error("Failed to delete post:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Internal server error deleting post" }));
    }
  }

  // API: Sync tracks from SoundCloud profile
  if (req.method === "POST" && pathname === "/api/soundcloud/sync") {
    loadEnv(); // Re-read .env in case user just added credentials

    const clientId = process.env.SC_CLIENT_ID;
    const clientSecret = process.env.SC_CLIENT_SECRET;
    const profileUrl = process.env.SC_PROFILE_URI;

    if (!clientId || !clientSecret || !profileUrl) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({
        error: "Missing SoundCloud configuration in .env. Please ensure SC_CLIENT_ID, SC_CLIENT_SECRET, and SC_PROFILE_URI are defined."
      }));
    }

    (async () => {
      try {
        const token = await getSoundCloudToken(clientId, clientSecret);

        // 1. Resolve profile URL to user resource
        const resolveUrl = `https://api.soundcloud.com/resolve?url=${encodeURIComponent(profileUrl)}`;
        const resolveRes = await fetch(resolveUrl, {
          headers: {
            "Authorization": `OAuth ${token}`,
            "Accept": "application/json"
          }
        });

        if (!resolveRes.ok) {
          const resolveErr = await resolveRes.text();
          throw new Error(`Failed to resolve SC_PROFILE_URI (${resolveRes.status}): ${resolveErr}`);
        }

        const userObj = await resolveRes.json();
        const userUrn = userObj.urn || userObj.id;
        if (!userUrn) {
          throw new Error("Could not find user URN or ID from resolved profile.");
        }

        // 2. Fetch user tracks
        const tracksUrl = `https://api.soundcloud.com/users/${userUrn}/tracks?limit=50&access=playable`;
        const tracksRes = await fetch(tracksUrl, {
          headers: {
            "Authorization": `OAuth ${token}`,
            "Accept": "application/json"
          }
        });

        if (!tracksRes.ok) {
          const tracksErr = await tracksRes.text();
          throw new Error(`Failed to fetch user tracks (${tracksRes.status}): ${tracksErr}`);
        }

        const tracksData = await tracksRes.json();
        const tracksList = Array.isArray(tracksData)
          ? tracksData
          : (tracksData.collection || []);

        // 3. Filter for tracks created in the last 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const recentTracks = tracksList.filter(track => {
          if (!track.created_at) return false;
          const trackDate = new Date(track.created_at);
          return trackDate >= thirtyDaysAgo;
        });

        // 4. Check existing posts.json for duplicates
        const rawPosts = fs.readFileSync(POSTS_FILE, "utf-8");
        const posts = JSON.parse(rawPosts);

        // Map existing post URLs & titles
        const existingSoundCloudUrls = new Set();
        const existingTitles = new Set();
        let maxIndex = 0;

        for (const post of posts) {
          if (post.id && post.id.startsWith("post-")) {
            const num = parseInt(post.id.replace("post-", ""), 10);
            if (!isNaN(num) && num > maxIndex) {
              maxIndex = num;
            }
          }
          if (post.title) existingTitles.add(post.title.trim().toLowerCase());
          if (Array.isArray(post.links)) {
            for (const link of post.links) {
              if (link.url) existingSoundCloudUrls.add(link.url.trim().toLowerCase());
            }
          }
        }

        const addedPosts = [];

        for (const track of recentTracks) {
          const permalink = (track.permalink_url || "").trim().toLowerCase();
          const title = (track.title || "").trim();

          // Deduplication: skip if already linked or identical title exists
          if (permalink && existingSoundCloudUrls.has(permalink)) continue;
          if (title && existingTitles.has(title.toLowerCase())) continue;

          const dateStr = track.created_at ? new Date(track.created_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);

          // Parse tags
          const tags = ["audio", "soundcloud"];
          if (track.genre) tags.push(track.genre.toLowerCase());
          if (track.tag_list) {
            // SoundCloud tags often look like 'house "deep house" electronic'
            const matches = track.tag_list.match(/"[^"]+"|[^\s]+/g) || [];
            for (const t of matches) {
              const cleanTag = t.replace(/"/g, "").trim().toLowerCase();
              if (cleanTag && !tags.includes(cleanTag)) {
                tags.push(cleanTag);
              }
            }
          }

          // Artwork resolution
          let artwork = track.artwork_url || null;
          if (artwork && artwork.includes("-large.")) {
            // upgrade to 500x500 artwork for crisp banners
            artwork = artwork.replace("-large.", "-t500x500.");
          }

          const newPost = {
            id: "", // Will be assigned during chronological renumbering
            title: title || "SoundCloud Track",
            date: dateStr,
            tags: tags.slice(0, 5),
            summary: track.description
              ? (track.description.split("\n")[0].slice(0, 140) + (track.description.length > 140 ? "..." : ""))
              : `New release on SoundCloud: ${title}`,
            content: track.description ? track.description.split('\n').slice(0, 10).concat(['...']).join('\n') : `Listen to ${title} on SoundCloud.`,
            coverImage: artwork,
            links: [
              {
                type: "soundcloud",
                label: "Listen on SoundCloud",
                url: track.permalink_url || profileUrl
              }
            ]
          };

          posts.push(newPost);
          addedPosts.push(newPost);
          if (permalink) existingSoundCloudUrls.add(permalink);
          if (title) existingTitles.add(title.toLowerCase());
        }

        // Always sort and renumber on every sync, so new tracks land in the right chronological slot
        saveAndNormalizePosts(posts);

        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({
          success: true,
          totalFetched: tracksList.length,
          last30DaysCount: recentTracks.length,
          addedCount: addedPosts.length,
          addedPosts: addedPosts
        }));
      } catch (err) {
        console.error("SoundCloud sync error:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: err.message || "Failed to sync SoundCloud tracks" }));
      }
    })();
    return;
  }

  // Admin UI routes (local dev only, served from admin/ outside public/)
  if (pathname === "/admin" || pathname === "/admin/" || pathname === "/admin/index.html") {
    return serveFile(path.join(ADMIN_DIR, "index.html"), 200, res);
  }
  if (pathname === "/admin/admin.css") {
    return serveFile(path.join(ADMIN_DIR, "admin.css"), 200, res);
  }

  // Default to index.html
  if (pathname === "/" || pathname === "") {
    pathname = "/index.html";
  }

  let filePath = path.join(PUBLIC_DIR, pathname);

  // Security check: ensure path stays inside PUBLIC_DIR
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    return res.end("403 Forbidden");
  }

  // Check file stats
  fs.stat(filePath, (err, stats) => {
    if (err) {
      // SPA Fallback: serve index.html if static file not found
      const fallbackPath = path.join(PUBLIC_DIR, "index.html");
      return serveFile(fallbackPath, 200, res);
    }

    if (stats.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    serveFile(filePath, 200, res);
  });
});

function serveFile(filePath, statusCode, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("404 Not Found");
    }

    res.writeHead(statusCode, {
      "Content-Type": contentType,
      "Cache-Control": "no-cache"
    });
    res.end(data);
  });
}

server.listen(PORT, () => {
  console.log(`\n> Local preview running at: http://localhost:${PORT}`);
  console.log(`> Serving files from: ${PUBLIC_DIR}\n`);
});
