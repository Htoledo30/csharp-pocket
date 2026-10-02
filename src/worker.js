// C# Pocket: roda o .NET e o compilador do C# (Roslyn) dentro deste worker.
import { dotnet } from './framework/dotnet.js';

// Os assemblies que o programa do usuário pode usar como referência: todos do .NET, menos o próprio Roslyn.
const isReference = (logical) => !logical.startsWith('Microsoft.');
const images = new Map();

let host = null;
let runId = 0;
const pending = [];
let lastFlush = 0, windowStart = 0, burst = 0;

function flush() {
  if (pending.length) {
    postMessage({ type: 'out', run: runId, data: pending.join('') });
    pending.length = 0;
  }
  lastFlush = performance.now();
}

let tracing = null;   // while recording a step-by-step run, output is kept here instead of being shown

function out(s) {
  if (tracing) { tracing.push(s); return; }
  pending.push(s);
  const now = performance.now();
  if (now - windowStart > 50) { windowStart = now; burst = 0; }
  if (++burst <= 40 || now - lastFlush > 30) flush();
}

function need(kind) {
  if (tracing) return;
  flush();
  postMessage({ type: 'need', run: runId, kind });
}

async function boot() {
  const t0 = performance.now();
  // A página passa o idioma no nome do worker; os workers nem sempre informam o idioma sozinhos.
  const culture = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(self.name || '') ? self.name : 'pt-BR';
  const runtime = await dotnet
    .withApplicationCulture(culture)
    .withResourceLoader((type, name, defaultUri) => {
      if (type !== 'assembly') return undefined;     // o resto (wasm nativo, dados regionais) usa o carregamento padrão
      // Cada assembly é baixado uma vez e uma cópia fica guardada: o compilador precisa dos mesmos bytes como referência.
      return fetch(defaultUri).then(async (response) => {
        if (!response.ok) throw new Error('Falha ao baixar ' + name + ' (' + response.status + ')');
        const buffer = await response.arrayBuffer();
        const isDll = name === 'Pocket.dll';
        const logical = name.replace(/\.[a-z0-9]{10}\.wasm$/, '').replace(/\.(wasm|dll)$/, '');
        if (isDll || isReference(logical)) images.set(logical, new Uint8Array(buffer));
        return new Response(buffer, { headers: { 'content-type': isDll ? 'application/octet-stream' : 'application/wasm' } });
      });
    })
    .withModuleConfig({
      onDownloadResourceProgress: (loaded, total) => postMessage({ type: 'progress', loaded, total }),
    })
    .create();
  runtime.setModuleImports('pocket', { out, need });
  const exports = await runtime.getAssemblyExports('Pocket.dll');
  host = exports.Pocket.Host;
  const failed = [];
  for (const [name, bytes] of images) {
    if (!host.AddReference(name, bytes)) failed.push(name);
  }
  images.clear();
  const info = JSON.parse(host.Init());
  info.failed = failed;
  postMessage({ type: 'booted', info, ms: Math.round(performance.now() - t0) });
  // Warm the compiler up so the first real run is quick.
  const t1 = performance.now();
  host.Compile('Console.WriteLine("ok");');
  postMessage({ type: 'ready', ms: Math.round(performance.now() - t1) });
}

async function run(msg) {
  runId = msg.run;
  let compileMs = 0;
  if (!host.IsCompiled(msg.source)) {
    const result = JSON.parse(host.Compile(msg.source));
    compileMs = result.ms;
    postMessage({ type: 'compiled', run: runId, result });
    if (!result.ok) {
      postMessage({ type: 'end', run: runId, status: 'compile' });
      return;
    }
  }
  const t0 = performance.now();
  let status;
  try {
    status = await host.Run(msg.inputs.join('\u0001'), msg.skip, msg.cols, msg.rows, msg.seed);
  } catch (e) {
    flush();
    postMessage({ type: 'end', run: runId, status: 'crash', detail: String(e && e.message || e) });
    return;
  }
  flush();
  const cut = status.indexOf(':');
  postMessage({
    type: 'end', run: runId,
    status: status.slice(0, cut),
    detail: status.slice(cut + 1),
    compileMs, runMs: Math.round(performance.now() - t0),
  });
}

async function trace(msg) {
  runId = msg.run;
  if (!host.IsCompiled(msg.source)) {
    const result = JSON.parse(host.Compile(msg.source));
    postMessage({ type: 'compiled', run: runId, result });
    if (!result.ok) {
      postMessage({ type: 'traced', run: runId, status: 'compile' });
      return;
    }
  }
  tracing = [];
  let status;
  try {
    status = await host.Trace(msg.inputs.join('\u0001'), msg.cols, msg.rows, msg.seed);
  } catch (e) {
    tracing = null;
    postMessage({ type: 'traced', run: runId, status: 'crash', detail: String(e && e.message || e) });
    return;
  }
  const output = tracing.join('');
  tracing = null;
  const cut = status.indexOf(':');
  postMessage({ type: 'traced', run: runId, status: status.slice(0, cut), detail: status.slice(cut + 1), output, trace: host.TakeTrace() });
}

let chain = boot().catch((e) => {
  postMessage({ type: 'fatal', detail: String(e && e.message || e) });
  throw e;
});

onmessage = (ev) => {
  if (ev.data.type === 'run') {
    chain = chain.then(() => run(ev.data)).catch((e) => {
      postMessage({ type: 'end', run: ev.data.run, status: 'crash', detail: String(e && e.message || e) });
    });
  } else if (ev.data.type === 'trace') {
    chain = chain.then(() => trace(ev.data)).catch((e) => {
      tracing = null;
      postMessage({ type: 'traced', run: ev.data.run, status: 'crash', detail: String(e && e.message || e) });
    });
  }
};
