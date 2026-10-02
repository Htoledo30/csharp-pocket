// O motor: um Web Worker que carrega o .NET e o compilador do C# (Roslyn) e roda o programa.
// Aqui se cuida do ciclo de vida do worker, do canal do console real e das perguntas de sugestão e erros.
// Quem usa o motor (run.js, steps.js, language.js) conversa por mensagens.
import { bus, esc } from './util.js';
import { engineState, setStatus, idleStatus, isBusy } from './status.js';
import { note } from './terminal.js';

let worker = null;
let runCounter = 0;
export const nextRun = () => ++runCounter;
export const hasWorker = () => worker !== null;
export function whenReady() {
  if (engineState.ready) return Promise.resolve();
  return new Promise((resolve) => { const off = bus.on('engine:ready', () => { off(); resolve(); }); });
}

export function post(message) {
  if (!worker) spawn();
  worker.postMessage(message);
}

export function spawn() {
  engineState.ready = false;
  idleStatus();
  try {
    worker = new Worker('worker.js', { type: 'module', name: navigator.language || 'pt-BR' });
  } catch (e) {
    failed(String((e && e.message) || e));
    return;
  }
  const mine = worker;
  worker.onmessage = (ev) => { if (mine === worker) onMessage(ev.data); };
  worker.onerror = (ev) => { if (mine === worker) failed(ev.message || 'o arquivo do compilador não carregou'); };
}

export function restartWorker() {
  if (worker) { worker.onmessage = null; worker.onerror = null; worker.terminate(); }
  for (const slot of Object.values(asking)) { if (slot) slot.resolve(null); }
  for (const key of Object.keys(asking)) asking[key] = null;
  spawn();
}

function failed(detail) {
  engineState.ready = false;
  setStatus('failed', 'O .NET não iniciou');
  note('error', 'O compilador não pôde ser iniciado neste navegador.\n<span class="where">' + esc(detail) + '</span>');
  bus.emit('engine:failed', detail);
}

function onMessage(m) {
  if (m.type === 'progress') {
    if (!engineState.ready && m.total) setStatus('loading', 'Baixando o .NET… ' + Math.round(100 * m.loaded / m.total) + '%');
  } else if (m.type === 'booted') {
    engineState.version = 'C# ' + String(m.info.language).replace(/\.0$/, '') + ' · .NET ' + String(m.info.runtime).split('.')[0];
    engineState.live = !!m.live && typeof SharedArrayBuffer === 'function';
    if (!isBusy()) setStatus('loading', 'Preparando o compilador…');
  } else if (m.type === 'ready') {
    engineState.ready = true;
    if (!isBusy()) idleStatus();
    bus.emit('engine:ready');
  } else if (m.type === 'fatal') {
    failed(m.detail);
  } else if (m.type === 'analyzed' || m.type === 'completed' || m.type === 'signatured') {
    const kind = m.type === 'analyzed' ? 'analyze' : m.type === 'completed' ? 'complete' : 'signature';
    const slot = asking[kind];
    if (slot && slot.id === m.id) { asking[kind] = null; slot.resolve(m.error ? null : m.result); }
  } else {
    bus.emit('engine:message', m);
  }
}

// ---------------------------------------------------------------- perguntas ao compilador (sugestões, erros, parâmetros)
// Só a última pergunta de cada tipo vale: a anterior, se ainda não respondeu, recebe null.
const asking = { analyze: null, complete: null, signature: null };
let askId = 0;
let engineBusy = false;
export const setEngineBusy = (busy) => { engineBusy = busy; };
export const canAsk = () => engineState.ready && !engineBusy && worker !== null;

export function ask(type, payload) {
  if (!canAsk()) return Promise.resolve(null);
  if (asking[type]) asking[type].resolve(null);
  return new Promise((resolve) => {
    const id = ++askId;
    asking[type] = { id, resolve };
    worker.postMessage({ type, id, ...payload });
  });
}

// ---------------------------------------------------------------- console real (SharedArrayBuffer)
const WRITE = 0, READ = 1, ABORT = 2, DATA = 16, SIZE = 65536;
const encoder = new TextEncoder();

export function liveSupported() {
  try { return engineState.live === true && window.crossOriginIsolated === true && typeof Atomics !== 'undefined'; } catch (e) { return false; }
}

// A fila de entradas compartilhada com o programa. A página só escreve; o programa só lê.
export function createChannel() {
  const sab = new SharedArrayBuffer(SIZE);
  const i32 = new Int32Array(sab, 0, 4);
  const bytes = new Uint8Array(sab);
  const cap = SIZE - DATA;
  return {
    sab,
    reset() { Atomics.store(i32, WRITE, 0); Atomics.store(i32, READ, 0); Atomics.store(i32, ABORT, 0); },
    push(text) {
      let data = encoder.encode(text);
      if (data.length > 4000) data = data.slice(0, 4000);
      const w = Atomics.load(i32, WRITE), r = Atomics.load(i32, READ);
      if (w - r + 2 + data.length > cap) return false;
      const put = (index, value) => { bytes[DATA + (index % cap)] = value; };
      put(w, data.length & 255);
      put(w + 1, data.length >> 8);
      for (let i = 0; i < data.length; i++) put(w + 2 + i, data[i]);
      Atomics.store(i32, WRITE, w + 2 + data.length);
      Atomics.notify(i32, WRITE);
      return true;
    },
    abort() {
      Atomics.store(i32, ABORT, 1);
      Atomics.notify(i32, ABORT);
      Atomics.notify(i32, WRITE);
    },
  };
}
