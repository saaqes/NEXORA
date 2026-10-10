// Servidor estático mínimo sin dependencias: node scripts/serve.mjs [puerto]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('..', import.meta.url))), port = Number(process.argv[2] || process.env.PORT || 8080);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
createServer(async (req, res) => {
  try {
    let p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    let f = join(root, p); if (!f.startsWith(root)) throw 0;
    if ((await stat(f).catch(() => null))?.isDirectory()) f = join(f, 'index.html');
    const data = await readFile(f);
    res.writeHead(200, { 'Content-Type': types[extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(data);
  } catch { res.writeHead(404); res.end('No encontrado'); }
}).listen(port, () => console.log(`NEXORA en http://localhost:${port}`));
