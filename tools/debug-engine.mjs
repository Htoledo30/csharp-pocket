// Ferramenta de depuração (não é teste): mostra o que o motor responde. node tools/debug-engine.mjs <analyze|complete|signature> <arquivo.cs> [posição]
import fs from 'node:fs';
import { startServer, startBrowser, open, ready } from '../tests/lib.mjs';

const [kind = 'analyze', file, pos] = process.argv.slice(2);
const source = fs.readFileSync(file, 'utf8');
const server = await startServer();
const browser = await startBrowser();
const { page } = await open(browser, server.url);
await ready(page);
const result = await page.evaluate(async ([k, src, p]) => {
  const { ask } = await import('./js/engine.js');
  const t = performance.now();
  const r = await ask(k, { files: [{ name: 'Program.cs', code: src }], file: 0, pos: p === null ? src.length : Number(p) });
  return { ms: Math.round(performance.now() - t), r };
}, [kind, source, pos ?? null]);
console.log(JSON.stringify(result, null, 1));
await browser.close();
await server.close();
