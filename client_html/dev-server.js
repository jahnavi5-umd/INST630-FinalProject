import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 5173;
const API_HOST = process.env.API_HOST || "localhost";
const API_PORT = Number(process.env.API_PORT) || 5000;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

function proxyApiRequest(req, res) {
  const proxyReq = http.request(
    {
      hostname: API_HOST,
      port: API_PORT,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: `${API_HOST}:${API_PORT}`,
      },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    },
  );

  proxyReq.on("error", (err) => {
    res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: `API proxy error: ${err.message}` }));
  });

  req.pipe(proxyReq, { end: true });
}

const server = http.createServer((req, res) => {
  const urlPath = (req.url || "/").split("?")[0];

  // Proxy /api requests to the Express backend (:5000)
  if (urlPath === "/api" || urlPath.startsWith("/api/")) {
    return proxyApiRequest(req, res);
  }

  // Required for Google Identity Services popup sign-in to return the credential
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");

  const safeRel = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.(\/|\\|$))+/, "");
  let filePath = path.join(__dirname, safeRel);

  // Prevent serving dev-server.js or package.json directly
  const baseName = path.basename(filePath);
  if (baseName === "dev-server.js" || baseName === "package.json") {
    filePath = path.join(__dirname, "index.html");
  }

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-cache" });
      fs.createReadStream(filePath).pipe(res);
    } else {
      // SPA fallback to index.html for routes (/login, /discover, /calendar, /groups, /profile, /admin)
      const indexPath = path.join(__dirname, "index.html");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
      fs.createReadStream(indexPath).pipe(res);
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n  TerpLink HTML/CSS/JS Client running at http://localhost:${PORT}`);
  console.log(`  Proxying /api -> http://${API_HOST}:${API_PORT}/api\n`);
});

