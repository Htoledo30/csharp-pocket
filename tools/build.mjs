// Monta o app.
//   node tools/build.mjs engine   compila o motor C# (engine/) e coloca o Pocket.dll em src/framework/
//   node tools/build.mjs dist     faz o engine e monta a pasta dist/ pronta para publicar
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');
const dist = path.join(root, 'dist');
const what = process.argv[2] || 'dist';

function run(cmd, args, options = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: root, shell: process.platform === 'win32' && cmd === 'npm', ...options });
  if (r.status !== 0) { console.error(`falhou: ${cmd} ${args.join(' ')}`); process.exit(r.status || 1); }
}

function buildEngine() {
  run('dotnet', ['build', path.join('engine', 'Pocket.csproj'), '-c', 'Release', '-nologo', '-v:q', '-clp:NoSummary']);
  const dll = path.join(root, 'engine', 'bin', 'Release', 'net8.0', 'Pocket.dll');
  if (!fs.existsSync(dll)) { console.error('Pocket.dll não foi gerado'); process.exit(1); }
  fs.copyFileSync(dll, path.join(src, 'framework', 'Pocket.dll'));
  console.log('Pocket.dll -> src/framework/ (' + fs.statSync(dll).size + ' bytes)');
}

function walk(dir, base = dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full, base));
    else files.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return files.sort();
}

const sha = (...parts) => {
  const h = crypto.createHash('sha1');
  for (const p of parts) h.update(p);
  return h.digest('hex').slice(0, 10);
};

function buildDist() {
  fs.rmSync(dist, { recursive: true, force: true });
  fs.cpSync(src, dist, { recursive: true });
  fs.writeFileSync(path.join(dist, '.nojekyll'), '');

  const files = walk(dist);
  const isRuntime = (f) => f.startsWith('framework/') && f !== 'framework/Pocket.dll';
  const shell = files.filter((f) => f !== 'sw.js' && f !== '.nojekyll' && !isRuntime(f));
  const runtime = files.filter(isRuntime);

  const version = sha(...shell.map((f) => f + '\0' + fs.readFileSync(path.join(dist, f)).toString('base64')));
  // Os arquivos do .NET têm o hash no nome; só o dotnet.js e o blazor.boot.json não têm, então entram pelo conteúdo.
  const runtimeId = sha(...runtime.map((f) => f + ':' + (/\.[a-z0-9]{10}\./.test(f) ? '' : fs.readFileSync(path.join(dist, f)).toString('base64'))));

  const swPath = path.join(dist, 'sw.js');
  let sw = fs.readFileSync(swPath, 'utf8');
  sw = sw.replace('__VERSION__', version).replace('__RUNTIME__', runtimeId).replace('/*__SHELL__*/[]', JSON.stringify(shell));
  fs.writeFileSync(swPath, sw);
  fs.writeFileSync(path.join(dist, 'version.json'), JSON.stringify({ version, runtime: runtimeId, commit: process.env.GITHUB_SHA || '', built: new Date().toISOString() }, null, 2));

  const size = (list) => list.reduce((n, f) => n + fs.statSync(path.join(dist, f)).size, 0);
  console.log(`dist/ pronto: versão ${version}, runtime ${runtimeId}`);
  console.log(`  app: ${shell.length} arquivos, ${(size(shell) / 1024).toFixed(0)} KB · .NET: ${runtime.length} arquivos, ${(size(runtime) / 1048576).toFixed(1)} MB`);
}

if (what === 'engine') buildEngine();
else if (what === 'dist') { buildEngine(); buildDist(); }
else if (what === 'dist-only') buildDist();
else { console.error('uso: node tools/build.mjs [engine|dist]'); process.exit(1); }
