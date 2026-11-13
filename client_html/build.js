import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "dist");

// Defaults to "" so Vercel's /api/* edge rewrite in client_html/vercel.json
// proxies requests same-origin to https://terplink-backend.vercel.app/api/*
// without cross-origin CORS preflights. Can still be overridden via env vars.
const apiUrl = (
  process.env.TERPLINK_API_URL ||
  process.env.VITE_API_URL ||
  process.env.API_URL ||
  ""
)
  .trim()
  .replace(/\/+$/, "");

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

// Copy static directories and files into dist/
for (const dir of ["css", "js", "images"]) {
  fs.cpSync(path.join(__dirname, dir), path.join(distDir, dir), { recursive: true });
}
for (const file of ["favicon.svg", "manifest.webmanifest"]) {
  fs.copyFileSync(path.join(__dirname, file), path.join(distDir, file));
}

// Read index.html and inject the configured API URL into <meta name="terplink-api-url">
let indexHtml = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
indexHtml = indexHtml.replace(
  /<meta\s+name="terplink-api-url"\s+content="[^"]*"\s*\/>/,
  `<meta name="terplink-api-url" content="${apiUrl}" />`,
);
fs.writeFileSync(path.join(distDir, "index.html"), indexHtml, "utf8");

console.log(
  `[client_html] Built static bundle to dist/ (API mode: ${apiUrl || "same-origin /api rewrite"})`,
);
