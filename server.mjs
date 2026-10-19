// Tiny static server for the Nook site. `node server.mjs` → http://localhost:3000
// Listens on all interfaces so a phone on the same Wi-Fi can open it too.
import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { networkInterfaces } from "node:os";

const root = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const port = Number(process.env.PORT) || 3000;
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mp4": "video/mp4",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (path.endsWith("/")) path += "index.html";
  const file = normalize(join(root, path));
  if (!file.startsWith(normalize(root))) return void res.writeHead(403).end();

  let stat;
  try {
    stat = statSync(file);
    if (!stat.isFile()) throw new Error();
  } catch {
    return void res.writeHead(404).end("Not found");
  }

  const headers = {
    "Content-Type": types[extname(file)] || "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-cache",
  };

  // Range requests: Safari will not play an mp4 without them.
  const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Number(range[2]) : stat.size - 1;
    res.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Content-Length": end - start + 1 });
    return void createReadStream(file, { start, end }).pipe(res);
  }

  res.writeHead(200, { ...headers, "Content-Length": stat.size });
  createReadStream(file).pipe(res);
}).listen(port, "0.0.0.0", () => {
  console.log(`Nook is running at http://localhost:${port}`);
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === "IPv4" && !net.internal) console.log(`On your phone (same Wi-Fi): http://${net.address}:${port}`);
    }
  }
});
