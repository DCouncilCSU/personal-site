import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPostStore, PostStoreError } from "./post-store.mjs";


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
const ADMIN_DIR = path.join(__dirname, "admin");
const POSTS_FILE = path.join(PUBLIC_DIR, "content", "posts.json");
const PORT = process.env.PORT || 8080;
const postStore = createPostStore(POSTS_FILE);

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

const server = http.createServer(async (req, res) => {
  // Strip query strings and hash
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  if (await handlePostApi(req, res, pathname)) return;

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
        const posts = postStore.list();

        // Map existing post URLs & titles
        const existingSoundCloudUrls = new Set();
        const existingTitles = new Set();

        for (const post of posts) {
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

        // Keep SoundCloud imports on the same persistence path as CRUD.
        const savedAddedPosts = postStore.append(addedPosts);

        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({
          success: true,
          totalFetched: tracksList.length,
          last30DaysCount: recentTracks.length,
          addedCount: addedPosts.length,
          addedPosts: savedAddedPosts
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

async function handlePostApi(req, res, pathname) {
  const isCollectionPath = pathname === "/api/posts";
  const postMatch = pathname.match(/^\/api\/posts\/([^/]+)$/);
  if (!isCollectionPath && !postMatch && !pathname.startsWith("/api/posts/")) {
    return false;
  }

  try {
    if (isCollectionPath && req.method === "GET") {
      sendJson(res, 200, postStore.list());
      return true;
    }
    if (isCollectionPath && req.method === "POST") {
      const post = postStore.create(await readJsonBody(req));
      sendJson(res, 201, { success: true, post });
      return true;
    }
    if (postMatch && req.method === "PUT") {
      const post = postStore.update(postMatch[1], await readJsonBody(req));
      sendJson(res, 200, { success: true, post });
      return true;
    }
    if (postMatch && req.method === "DELETE") {
      const removedPost = postStore.remove(postMatch[1]);
      sendJson(res, 200, { success: true, removedPost });
      return true;
    }
    sendJson(res, 405, { error: "Method not allowed" });
    return true;
  } catch (error) {
    if (error.statusCode === 400 || error.statusCode === 404 || error.statusCode === 413) {
      sendJson(res, error.statusCode, { error: error.message });
      return true;
    }
    if (error instanceof PostStoreError && error.statusCode < 500) {
      sendJson(res, error.statusCode, { error: error.message });
      return true;
    }
    console.error("Post API error:", error);
    sendJson(res, 500, { error: "Internal server error handling post request" });
    return true;
  }
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  let tooLarge = false;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > 2e6) {
      tooLarge = true;
    } else if (!tooLarge) {
      chunks.push(chunk);
    }
  }

  if (tooLarge) {
    const error = new Error("Request body is too large");
    error.statusCode = 413;
    throw error;
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
  } catch {
    const error = new Error("Request body must contain valid JSON");
    error.statusCode = 400;
    throw error;
  }
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-cache"
  });
  res.end(JSON.stringify(data));
}

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
