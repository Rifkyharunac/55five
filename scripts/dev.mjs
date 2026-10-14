import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import api from '../api/index.js';
import history from '../api/history.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(await readFile(resolve(root, 'vercel.json'), 'utf8'));
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};
const port = Number(process.env.PORT || 3000);
createServer(async (req, res) => {
  for (const rule of config.headers || [])
    for (const header of rule.headers) res.setHeader(header.key, header.value);
  const pathname = new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '') || '/';
  if (pathname === '/api' || pathname === '/api/history') {
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (body) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(body));
    };
    return (pathname === '/api' ? api : history)(req, res);
  }
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end();
  }
  const file = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!(
    file === 'index.html' ||
    file === 'favicon.svg' ||
    file === 'data/riwayat.json' ||
    /^src\/[a-z-]+\.(js|css)$/.test(file)
  )) {
    res.writeHead(404);
    return res.end('Not found');
  }
  const target = resolve(root, file);
  if (!target.startsWith(root.endsWith(sep) ? root : root + sep)) {
    res.writeHead(403);
    return res.end();
  }
  try {
    const body = await readFile(target);
    res.writeHead(200, { 'Content-Type': types[extname(target)], 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`55FIVE ready at http://127.0.0.1:${port}`));
