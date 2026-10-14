// Serves dist/ on http://127.0.0.1:4173 for local viewing and the e2e tests. Static files only;
// /cluster/ and /api belong to the self-defending-portfolio deployment and answer 404 here.
//
//   node scripts/serve.mjs [--dir dist] [--port 4173] (the e2e tests use 4290)

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const arg = (n, d) => {
  const i = process.argv.indexOf(n);
  return i > 0 ? process.argv[i + 1] : d;
};
const dir = resolve(arg("--dir", "dist"));
const port = Number(arg("--port", "4173"));
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".txt": "text/plain", ".json": "application/json" };

createServer(async (req, res) => {
  let path = normalize(decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname));
  if (path.endsWith("/")) path += "index.html";
  const file = join(dir, path);
  try {
    if (!file.startsWith(dir) || !(await stat(file)).isFile()) throw new Error("not a file");
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found\n");
  }
}).listen(port, "127.0.0.1", () => console.log(`serving ${dir} on http://127.0.0.1:${port}`));
