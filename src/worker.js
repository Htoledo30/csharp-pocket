// C# Pocket: roda o .NET e o compilador do C# (Roslyn) dentro deste worker.
//
// Mensagens da página:  run, trace, analyze, complete, signature
// Mensagens para a página: progress, booted, ready, fatal, compiled, out, need, want, end, traced, analyzed, completed, signatured
//
// Console real: quando a página está "isolada" (crossOriginIsolated), ela cria um SharedArrayBuffer e o programa
// espera de verdade pelo que o usuário digita (Atomics.wait), sem precisar ser executado de novo a cada entrada.
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

let tracing = null;   // gravando um passo a passo: a saída fica guardada aqui em vez de aparecer

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

// ---------------------------------------------------------------- console real
// O SharedArrayBuffer: 16 bytes de cabeçalho (4 inteiros) e depois uma fila circular de registros [tamanho(2 bytes)][texto UTF-8].
//   inteiro 0: quanto a página já escreveu · 1: quanto o programa já leu · 2: pedido de parar
const WRITE = 0, READ = 1, ABORT = 2, DATA = 16;
let ring = null, bytes = null, wantSent = false;
const decoder = new TextDecoder();

function setupRing(sab) {
  ring = new Int32Array(sab, 0, 4);
  bytes = new Uint8Array(sab);
  wantSent = false;
}

const capacity = () => bytes.length - DATA;
const at = (index) => bytes[DATA + (index % capacity())];

// Pega o próximo registro da fila, ou null se não há nenhum.
function takeItem(write) {
  const read = Atomics.load(ring, READ);
  if (read === write) return null;
  const size = at(read) | (at(read + 1) << 8);
  const data = new Uint8Array(size);
  for (let i = 0; i < size; i++) data[i] = at(read + 2 + i);
  Atomics.store(ring, READ, read + 2 + size);
  return decoder.decode(data);
}

function read(kind) {
  flush();
  postMessage({ type: 'need', run: runId, kind, live: true });
  for (;;) {
    const write = Atomics.load(ring, WRITE);      // lido antes de olhar a fila: não perde um aviso que chegue no meio
    const item = takeItem(write);
    if (item !== null) return item;
    if (Atomics.load(ring, ABORT) !== 0) return '\u0000';
    Atomics.wait(ring, WRITE, write, 250);
  }
}

// Tem uma tecla esperando? (Console.KeyAvailable)
function poll() {
  flush();
  if (!wantSent) { wantSent = true; postMessage({ type: 'want', run: runId, kind: 'key' }); }
  const write = Atomics.load(ring, WRITE), read = Atomics.load(ring, READ);
  return write !== read && at(read + 2) === 75;     // 75 = "K"
}

function sleep(ms) {
  flush();
  Atomics.wait(ring, ABORT, 0, ms);
  return Atomics.load(ring, ABORT) !== 0;
}

const aborted = () => ring !== null && Atomics.load(ring, ABORT) !== 0;

// ---------------------------------------------------------------- inicialização
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
  runtime.setModuleImports('pocket', { out, need, read, poll, sleep, aborted });
  const exports = await runtime.getAssemblyExports('Pocket.dll');
  host = exports.Pocket.Host;
  const failed = [];
  for (const [name, data] of images) {
    if (!host.AddReference(name, data)) failed.push(name);
  }
  images.clear();
  const info = JSON.parse(host.Init());
  info.failed = failed;
  postMessage({ type: 'booted', info, ms: Math.round(performance.now() - t0), live: typeof SharedArrayBuffer === 'function' && self.crossOriginIsolated === true });
  // Esquenta o compilador para a primeira execução e as primeiras sugestões saírem rápido.
  const t1 = performance.now();
  const warm = pack([{ name: 'Program.cs', code: 'var x = "oi";\nConsole.WriteLine(x.Length);\n' }]);
  host.Compile(warm);
  postMessage({ type: 'ready', ms: Math.round(performance.now() - t1) });
  try {
    host.Analyze(warm);
    host.Complete(warm, 0, 38);
  } catch (e) { /* o esquenta é só uma ajuda */ }
}

// Os arquivos viajam como um texto só: "nome\u0002código" separados por \u0001.
function pack(files) {
  return files.map((f) => f.name + '\u0002' + String(f.code).replace(/[\u0001\u0002]/g, '')).join('\u0001');
}

// ---------------------------------------------------------------- executar
function compileIfNeeded(msg) {
  const packed = pack(msg.files);
  if (host.IsCompiled(packed)) return { packed, compileMs: 0, ok: true };
  const result = JSON.parse(host.Compile(packed));
  postMessage({ type: 'compiled', run: runId, result });
  return { packed, compileMs: result.ms, ok: result.ok };
}

async function run(msg) {
  runId = msg.run;
  const c = compileIfNeeded(msg);
  if (!c.ok) {
    postMessage({ type: 'end', run: runId, status: 'compile' });
    return;
  }
  const live = !!(msg.live && msg.sab);
  if (live) setupRing(msg.sab); else ring = null;
  host.FsLoad(JSON.stringify(msg.fs || {}));
  const t0 = performance.now();
  let status;
  try {
    status = await host.Run(msg.inputs.join('\u0001'), msg.skip, msg.cols, msg.rows, msg.seed, live);
  } catch (e) {
    flush();
    postMessage({ type: 'end', run: runId, status: 'crash', detail: String((e && e.message) || e) });
    return;
  }
  flush();
  const cut = status.indexOf(':');
  const state = status.slice(0, cut);
  const reply = {
    type: 'end', run: runId, status: state, detail: status.slice(cut + 1),
    compileMs: c.compileMs, runMs: Math.round(performance.now() - t0),
  };
  if (state !== 'need') {
    try { reply.fs = JSON.parse(host.FsDump()); } catch (e) { /* sem arquivos para guardar */ }
  }
  postMessage(reply);
}

async function trace(msg) {
  runId = msg.run;
  const c = compileIfNeeded(msg);
  if (!c.ok) {
    postMessage({ type: 'traced', run: runId, status: 'compile' });
    return;
  }
  ring = null;
  host.FsLoad(JSON.stringify(msg.fs || {}));
  tracing = [];
  let status;
  try {
    status = await host.Trace(msg.inputs.join('\u0001'), msg.cols, msg.rows, msg.seed);
  } catch (e) {
    tracing = null;
    postMessage({ type: 'traced', run: runId, status: 'crash', detail: String((e && e.message) || e) });
    return;
  }
  const output = tracing.join('');
  tracing = null;
  const cut = status.indexOf(':');
  postMessage({ type: 'traced', run: runId, status: status.slice(0, cut), detail: status.slice(cut + 1), output, trace: host.TakeTrace() });
}

// ---------------------------------------------------------------- ajuda ao digitar
// Só a última pergunta de cada tipo interessa: se o usuário já digitou mais, as antigas são puladas.
const latest = { analyze: 0, complete: 0, signature: 0 };

const REPLY = { analyze: 'analyzed', complete: 'completed', signature: 'signatured' };

function language(msg) {
  if (msg.id !== latest[msg.type]) return;
  const packed = pack(msg.files);
  try {
    const text = msg.type === 'analyze' ? host.Analyze(packed)
      : msg.type === 'complete' ? host.Complete(packed, msg.file, msg.pos)
      : host.Signature(packed, msg.file, msg.pos);
    postMessage({ type: REPLY[msg.type], id: msg.id, result: JSON.parse(text) });
  } catch (e) {
    postMessage({ type: REPLY[msg.type], id: msg.id, error: String((e && e.message) || e) });
  }
}

let chain = boot().catch((e) => {
  postMessage({ type: 'fatal', detail: String((e && e.message) || e) });
  throw e;
});

onmessage = (ev) => {
  const msg = ev.data;
  if (msg.type === 'run') {
    chain = chain.then(() => run(msg)).catch((e) => {
      postMessage({ type: 'end', run: msg.run, status: 'crash', detail: String((e && e.message) || e) });
    });
  } else if (msg.type === 'trace') {
    chain = chain.then(() => trace(msg)).catch((e) => {
      tracing = null;
      postMessage({ type: 'traced', run: msg.run, status: 'crash', detail: String((e && e.message) || e) });
    });
  } else if (msg.type === 'analyze' || msg.type === 'complete' || msg.type === 'signature') {
    latest[msg.type] = msg.id;
    chain = chain.then(() => language(msg)).catch(() => {});
  }
};
