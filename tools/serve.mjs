// Servidor local para desenvolver e testar: node tools/serve.mjs [pasta] [--port 8080] [--isolated]
// Serve a pasta src/ (ou a que for indicada) com os tipos de arquivo certos.
// --isolated manda os cabeçalhos COOP/COEP, como o service worker faz no site publicado.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8', '.cs': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
};

export function serve({ root, port = 8080, isolated = false, quiet = false } = {}) {
  const base = path.resolve(root);
  const server = http.createServer((req, res) => {
    let url;
    try { url = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); res.end(); return; }
    if (url.endsWith('/')) url += 'index.html';
    const file = path.join(base, url);
    if (!file.startsWith(base)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('não encontrado'); return; }
      const headers = {
        'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-cache',
      };
      if (isolated) {
        headers['cross-origin-opener-policy'] = 'same-origin';
        headers['cross-origin-embedder-policy'] = 'require-corp';
        headers['cross-origin-resource-policy'] = 'same-origin';
      }
      res.writeHead(200, headers);
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(port, () => {
    if (!quiet) console.log(`C# Pocket em http://localhost:${port}/  (${base})`);
    resolve(server);
  }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const portIndex = args.indexOf('--port');
  const port = portIndex >= 0 ? Number(args[portIndex + 1]) : 8080;
  const folder = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--port') || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
  await serve({ root: folder, port, isolated: args.includes('--isolated') });
}
