// O motor: um Web Worker que carrega o .NET e o compilador do C# (Roslyn) e roda o programa.
// Aqui só se cuida do ciclo de vida do worker; quem usa o motor (run.js, steps.js) conversa por mensagens.
import { bus, esc } from './util.js';
import { engineState, setStatus, idleStatus, isBusy } from './status.js';
import { note } from './terminal.js';

let worker = null;
let runCounter = 0;
export const nextRun = () => ++runCounter;
export const hasWorker = () => worker !== null;

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
    if (!isBusy()) setStatus('loading', 'Preparando o compilador…');
  } else if (m.type === 'ready') {
    engineState.ready = true;
    if (!isBusy()) idleStatus();
    bus.emit('engine:ready');
  } else if (m.type === 'fatal') {
    failed(m.detail);
  } else {
    bus.emit('engine:message', m);
  }
}
