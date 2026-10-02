// Roda todos os testes, um por vez: node tests/run.mjs [nome ...]
// Cada arquivo tests/*.mjs (menos lib, run e shots) é um teste que abre o app num navegador de verdade.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const skip = new Set(['lib.mjs', 'run.mjs', 'shots.mjs']);
const wanted = process.argv.slice(2);
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.mjs') && !skip.has(f) && (!wanted.length || wanted.some((w) => f.startsWith(w)))).sort();

let failed = 0;
for (const file of files) {
  console.log('\n━━ ' + file);
  const t = Date.now();
  const r = spawnSync(process.execPath, [path.join(dir, file)], { stdio: 'inherit', cwd: path.dirname(dir) });
  const secs = ((Date.now() - t) / 1000).toFixed(0);
  if (r.status !== 0) { failed++; console.log(`✗ ${file} falhou (${secs}s)`); } else console.log(`✓ ${file} (${secs}s)`);
}
console.log(failed ? `\n${failed} teste(s) com falha` : '\ntudo certo');
process.exit(failed ? 1 : 0);
