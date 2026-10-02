// Executar o programa: compila, mostra erros, roda, pede o que o programa precisa digitar.
import { $, esc, bus, narrow } from './util.js';
import { code, setLineMarks, jumpTo } from './editor.js';
import { term, notes, note, termScroll, termSize, scrollEnd } from './terminal.js';
import { showTab, termVisible } from './tabs.js';
import { engineState, setStatus, idleStatus, setBusyProbe } from './status.js';
import { nextRun, post, restartWorker, hasWorker, spawn } from './engine.js';
import { explain, explainRuntime } from './data/errors.js';

export let session = null;
let watchdog = 0;
setBusyProbe(() => !!(session && session.active));
export const isRunning = () => !!(session && session.active);

// Os erros e avisos do compilador: marcam as linhas e viram uma lista tocável no terminal.
export function onCompiled(result) {
  const marks = new Map();
  for (const d of result.diagnostics) {
    if (d.line && (d.severity === 'error' || !marks.has(d.line))) marks.set(d.line, d.severity === 'error' ? 'error' : 'warning');
  }
  setLineMarks(marks);
  if (!result.diagnostics.length) return;
  const errors = result.diagnostics.filter((d) => d.severity === 'error').length;
  // Um engano costuma gerar várias mensagens na mesma linha: mostrar a primeira de cada linha.
  const shownLines = new Set();
  const list = result.diagnostics.filter((d) => {
    if (errors && d.severity !== 'error') return false;
    const key = d.severity === 'tip' ? d.line + ':' + d.message : d.line;
    if (d.line && shownLines.has(key)) return false;
    shownLines.add(key);
    return true;
  });
  if (errors) note('error', list.length === 1 ? 'O código tem um erro e não foi executado.' : 'O código tem erros em ' + list.length + ' lugares e não foi executado. Comece pelo primeiro: consertar um costuma resolver os seguintes.');
  for (const d of list) {
    const b = document.createElement('button');
    b.className = 'diag ' + d.severity;
    const plain = explain(d);
    const tag = d.severity === 'warning' ? ' <span class="id">· aviso</span>' : d.severity === 'tip' ? ' <span class="id">· dica</span>' : '';
    b.innerHTML = '<span class="where">' + (d.line ? 'Linha ' + d.line + (d.severity === 'tip' ? '' : ', coluna ' + d.col) : 'Projeto') + tag + '</span>' +
      esc(plain || d.message) + (d.severity === 'tip' ? '' : '<span class="raw">' + esc(d.id + (plain ? ': ' + d.message : '')) + '</span>');
    if (d.line) b.addEventListener('click', () => jumpTo(d.line, d.col));
    notes.appendChild(b);
  }
  scrollEnd();
}

function onMessage(m) {
  if (!session || m.run !== session.run) return;
  if (m.type === 'compiled') onCompiled(m.result);
  else if (m.type === 'out') {
    session.received += m.data.length;
    term.write(m.data);
    if (narrow() && !termVisible()) $('pip').hidden = false;
  } else if (m.type === 'need') {
    session.pendingNeed = m.kind;
    clearTimeout(watchdog);
    // Um programa que engole todas as exceções nunca devolveria o controle: dar um instante e reiniciar o motor.
    watchdog = setTimeout(() => { if (session && session.pendingNeed) { restartWorker(); askInput(session.pendingNeed); } }, 2500);
  } else if (m.type === 'end') onEnd(m);
}

function onEnd(m) {
  clearTimeout(watchdog);
  const s = session;
  if (m.status === 'need') {
    const cut = m.detail.indexOf(':');
    s.pendingNeed = null;
    s.received = Number(m.detail.slice(cut + 1)) || s.received;
    askInput(m.detail.slice(0, cut));
    return;
  }
  s.pendingNeed = null;
  if (m.status === 'done') {
    note('', 'Programa encerrado' + timing(m));
  } else if (m.status === 'error') {
    const cut = m.detail.indexOf(':');
    const line = Number(m.detail.slice(0, cut)) || 0;
    const lines = m.detail.slice(cut + 1).split('\n');
    const plain = explainRuntime(lines[0]);
    const el = note('error', 'Erro durante a execução' + (line ? ' na <button class="jump">linha ' + line + '</button>' : '') + '\n' + esc(plain || lines[0]) +
      (plain ? '<span class="raw">' + esc(lines[0]) + '</span>' : '') + (lines.length > 1 ? (plain ? '' : '\n') + '<span class="where">' + esc(lines.slice(1).join('\n')) + '</span>' : ''));
    if (line) {
      el.querySelector('.jump').addEventListener('click', () => jumpTo(line, 1));
      if (code.value === s.source) setLineMarks(new Map([[line, 'error']]));
    }
  } else if (m.status === 'limit') {
    note('error', 'O programa escreveu texto demais e foi interrompido. Há um laço que não termina?');
  } else if (m.status === 'crash') {
    const exit = /exit\((-?\d+)\)/.exec(m.detail || '');
    if (exit) note('', 'Programa encerrado com Environment.Exit(' + exit[1] + ')');
    else note('error', 'A execução foi interrompida.\n<span class="where">' + esc(m.detail || '') + '</span>');
    restartWorker();
  }
  finish();
}

function timing(m) {
  const parts = [];
  if (m.compileMs) parts.push('compilou em ' + m.compileMs + ' ms');
  return parts.length ? ' · ' + parts.join(' · ') : '';
}

export function askInput(kind) {
  const s = session;
  if (!s) return;
  s.pendingNeed = null;
  s.waiting = kind;
  setStatus('busy', kind === 'key' ? 'Esperando uma tecla' : 'Esperando você digitar');
  $('termState').textContent = kind === 'key' ? 'aperte uma tecla' : 'esperando entrada';
  showInputBox(kind);
}

// Abre a caixa de resposta do terminal (uma linha de texto ou uma tecla) e leva o foco para ela.
export function showInputBox(kind) {
  $('ask').hidden = false;
  $('lineForm').hidden = kind !== 'line';
  $('keyForm').hidden = kind !== 'key';
  showTab('term');
  scrollEnd();
  const field = kind === 'key' ? $('keyInput') : $('lineInput');
  field.value = '';
  field.focus({ preventScroll: true });
}

export function give(item) {
  const taken = { handled: false };
  bus.emit('input:give', item, taken);
  if (taken.handled) return;
  const s = session;
  if (!s || !s.waiting) return;
  s.waiting = null;
  s.inputs.push(item.replace(/\u0001/g, ''));
  $('termState').textContent = 'executando';
  setStatus('busy', 'Executando…');
  postRun(s);
}

function postRun(s) {
  const size = termSize();
  post({ type: 'run', run: s.run, source: s.source, inputs: s.inputs, skip: s.received, cols: size.cols, rows: size.rows, seed: s.seed });
}

export function start() {
  bus.emit('run:starting');
  term.reset();
  notes.textContent = '';
  setLineMarks(new Map());
  session = { run: nextRun(), source: code.value, inputs: [], received: 0, seed: (Math.random() * 0x7fffffff) | 0, active: true, waiting: null, pendingNeed: null };
  $('run').dataset.mode = 'stop';
  $('runLabel').textContent = 'Parar';
  $('runIcon').setAttribute('d', 'M2 2h8v8H2z');
  $('termState').textContent = engineState.ready ? 'executando' : 'aguardando o .NET';
  setStatus('busy', engineState.ready ? 'Executando…' : 'Carregando o .NET…');
  if (narrow()) showTab('term');
  if (!hasWorker()) spawn();
  postRun(session);
}

export function finish() {
  if (session) { session.active = false; session.waiting = null; }
  clearTimeout(watchdog);
  $('run').dataset.mode = 'run';
  $('runLabel').textContent = 'Executar';
  $('runIcon').setAttribute('d', 'M2 1l9 5-9 5z');
  $('termState').textContent = '';
  $('ask').hidden = true;
  idleStatus();
}

export function stop() {
  if (!session || !session.active) return;
  const waiting = session.waiting;
  session.run = -1;
  note('', 'Interrompido');
  if (!waiting) restartWorker();   // o programa está ocupado: a única forma de parar é reiniciar o motor
  finish();
}

export function toggleRun() { if (isRunning()) stop(); else start(); }

export function initRun() {
  bus.on('engine:message', onMessage);
  bus.on('engine:failed', () => { if (isRunning()) finish(); });
  bus.on('steps:starting', () => { if (isRunning()) stop(); });
  bus.on('run:toggle', toggleRun);
  bus.on('project:before-open', () => { if (isRunning()) stop(); });

  $('run').addEventListener('click', toggleRun);
  $('lineForm').addEventListener('submit', (e) => { e.preventDefault(); const v = $('lineInput').value; $('lineInput').value = ''; give('L' + v); });
  $('keyForm').addEventListener('pointerdown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
  $('keyForm').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) give('K' + b.dataset.key); });
  $('keyInput').addEventListener('keydown', (e) => {
    if (e.key === 'Unidentified' || e.key === 'Process' || e.isComposing) return;   // teclado do celular: tratado no evento input
    if (e.ctrlKey || e.metaKey || ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) return;
    e.preventDefault();
    give('K' + e.key);
  });
  $('keyInput').addEventListener('input', () => {
    const v = $('keyInput').value;
    $('keyInput').value = '';
    if (v) give('K' + Array.from(v)[0]);
  });
  $('clear').addEventListener('click', () => { term.reset(); notes.textContent = ''; });
}
