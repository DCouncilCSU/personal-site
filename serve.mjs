import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
const ADMIN_DIR = path.join(__dirname, "admin");
const POSTS_FILE = path.join(PUBLIC_DIR, "content", "posts.json");
const PORT = process.env.PORT || 8080;

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

        // Compute next post ID (e.g. post-4)
        let maxIndex = 0;
        for (const post of posts) {
          if (post.id && post.id.startsWith("post-")) {
            const num = parseInt(post.id.replace("post-", ""), 10);
            if (!isNaN(num) && num > maxIndex) {
              maxIndex = num;
            }
          }
        }
        const nextId = `post-${maxIndex + 1}`;

        const postEntry = {
          id: nextId,
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

        // Prepend new post
        posts.unshift(postEntry);

        fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2) + "\n", "utf-8");

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

  // Admin UI route (local dev only, served from admin/ outside public/)
  if (pathname === "/admin" || pathname === "/admin/" || pathname === "/admin/index.html") {
    return serveFile(path.join(ADMIN_DIR, "index.html"), 200, res);
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
