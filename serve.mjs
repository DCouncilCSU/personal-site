import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
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
