// Executar o programa: compila, mostra erros, roda, pede o que o programa precisa digitar.
//
// Dois modos de rodar, escolhidos sozinhos:
//  - ao vivo: o programa fica esperando de verdade pelo que você digita (precisa da página "isolada");
//  - reexecutar: a cada entrada o programa roda de novo desde o começo, repetindo as respostas já dadas.
import { $, esc, bus, narrow, toast } from './util.js';
import { code, jumpTo } from './editor.js';
import { term, notes, note, termSize, scrollEnd, screen } from './terminal.js';
const screenText = () => screen.innerText;
import { showTab, termVisible } from './tabs.js';
import { engineState, setStatus, idleStatus, setBusyProbe } from './status.js';
import { nextRun, post, restartWorker, hasWorker, spawn, liveSupported, createChannel, setEngineBusy, whenReady } from './engine.js';
import { explain, explainRuntime, refine } from './data/errors.js';
import { currentProject, projectFiles } from './projects.js';
import { setDiagnostics, clearDiagnostics } from './diagnostics.js';
import { switchFile } from './filetabs.js';
import { loadFs, saveFs, fsBytes } from './fsstore.js';

export const FILE_STRIDE = 1000000;
// O motor numera as linhas como arquivo * 1.000.000 + linha.
export const decodeLine = (n) => ({ file: Math.floor(n / FILE_STRIDE), line: n % FILE_STRIDE });

export let session = null;
let watchdog = 0;
let channel = null;
setBusyProbe(() => !!(session && session.active));
export const isRunning = () => !!(session && session.active);

// Abre o arquivo e leva o cursor até a linha.
export function goTo(file, line, col) {
  const p = currentProject();
  if (p && file >= 0 && file !== p.active && p.files[file]) switchFile(file, { keepCaret: true });
  jumpTo(line, col);
}

const fileLabel = (files, index) => (files && files.length > 1 && files[index] ? files[index].name + ' · ' : '');

// Os erros e avisos do compilador: marcam as linhas e viram uma lista tocável no terminal.
export function onCompiled(result, files = projectFiles()) {
  setDiagnostics(result.diagnostics, files);
  result.diagnostics = result.diagnostics.map((d) => refine(d, files[d.file] ? files[d.file].code : ''));
  if (!result.diagnostics.length) return;
  const errors = result.diagnostics.filter((d) => d.severity === 'error').length;
  // Um engano costuma gerar várias mensagens na mesma linha: mostrar a primeira de cada linha.
  const shownLines = new Set();
  const list = result.diagnostics.filter((d) => {
    if (errors && d.severity !== 'error') return false;
    const key = d.severity === 'tip' ? d.file + ':' + d.line + ':' + d.message : d.file + ':' + d.line;
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
    b.innerHTML = '<span class="where">' + esc(fileLabel(files, d.file)) + (d.line ? 'Linha ' + d.line + (d.severity === 'tip' ? '' : ', coluna ' + d.col) : 'Projeto') + tag + '</span>' +
      esc(plain || d.message) + (d.severity === 'tip' ? '' : '<span class="raw">' + esc(d.id + (plain ? ': ' + d.message : '')) + '</span>');
    if (d.line) b.addEventListener('click', () => goTo(d.file, d.line, d.col));
    notes.appendChild(b);
  }
  scrollEnd();
}

function onMessage(m) {
  if (!session || m.run !== session.run) return;
  if (m.type === 'compiled') onCompiled(m.result, session.files);
  else if (m.type === 'out') {
    session.received += m.data.length;
    term.write(m.data);
    if (narrow() && !termVisible()) $('pip').hidden = false;
  } else if (m.type === 'need') {
    if (session.live) { if (!session.stopping) askInput(m.kind); return; }
    session.pendingNeed = m.kind;
    clearTimeout(watchdog);
    // Um programa que engole todas as exceções nunca devolveria o controle: dar um instante e reiniciar o motor.
    watchdog = setTimeout(() => { if (session && session.pendingNeed) { restartWorker(); askInput(session.pendingNeed); } }, 2500);
  } else if (m.type === 'want') {
    // O programa fica olhando se há tecla (Console.KeyAvailable): deixar as setas sempre à mão.
    if (session.live && !session.stopping) { session.keyMode = true; showInputBox('key', { focus: false }); }
  } else if (m.type === 'end') onEnd(m);
}

// Os arquivos que o programa gravou ficam guardados para a próxima execução.
function keepFiles(m) {
  if (!m.fs || !m.fs.changed || !session) return;
  if (m.fs.truncated) { toast('Os arquivos do programa passaram do limite e não foram guardados'); return; }
  saveFs(session.projectId, m.fs.files);
  bus.emit('fs:changed', session.projectId, fsBytes(m.fs.files));
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
  keepFiles(m);
  if (m.status === 'aborted') {
    finish();
    return;
  }
  if (m.status === 'done') {
    note('', 'Programa encerrado' + timing(m));
  } else if (m.status === 'error') {
    const cut = m.detail.indexOf(':');
    const where = decodeLine(Number(m.detail.slice(0, cut)) || 0);
    const lines = m.detail.slice(cut + 1).split('\n');
    const plain = explainRuntime(lines[0]);
    const label = where.line ? (s.files.length > 1 && s.files[where.file] ? s.files[where.file].name + ', ' : '') + 'linha ' + where.line : '';
    const el = note('error', 'Erro durante a execução' + (where.line ? ' em <button class="jump">' + esc(label) + '</button>' : '') + '\n' + esc(plain || lines[0]) +
      (plain ? '<span class="raw">' + esc(lines[0]) + '</span>' : '') + (lines.length > 1 ? (plain ? '' : '\n') + '<span class="where">' + esc(lines.slice(1).join('\n')) + '</span>' : ''));
    if (where.line) {
      el.querySelector('.jump').addEventListener('click', () => goTo(where.file, where.line, 1));
      if (JSON.stringify(projectFiles()) === s.key) setDiagnostics([{ severity: 'error', id: 'RUN', message: lines[0], file: where.file, line: where.line, col: 0 }]);
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
  if (kind === 'key') s.keyMode = true;
  setStatus('busy', kind === 'key' ? 'Esperando uma tecla' : 'Esperando você digitar');
  $('termState').textContent = kind === 'key' ? 'aperte uma tecla' : 'esperando entrada';
  showInputBox(kind);
}

// Abre a caixa de resposta do terminal (uma linha de texto ou uma tecla) e leva o foco para ela.
export function showInputBox(kind, { focus = true } = {}) {
  $('ask').hidden = false;
  $('lineForm').hidden = kind !== 'line';
  $('keyForm').hidden = kind !== 'key';
  if (!focus) return;
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
  if (!s || !s.active) return;
  if (s.live) {
    // Ao vivo, as teclas podem chegar a qualquer hora (jogos em tempo real); o programa lê quando quiser.
    if (!s.waiting && !s.keyMode) return;
    if (!channel.push(item.replace(/\u0001/g, ''))) toast('Teclas demais de uma vez');
    if (s.waiting) {
      s.waiting = null;
      $('termState').textContent = 'executando';
      setStatus('busy', 'Executando…');
      if (!s.keyMode) $('ask').hidden = true;
    }
    return;
  }
  if (!s.waiting) return;
  s.waiting = null;
  s.inputs.push(item.replace(/\u0001/g, ''));
  $('termState').textContent = 'executando';
  setStatus('busy', 'Executando…');
  postRun(s);
}

function postRun(s) {
  const size = termSize();
  const message = { type: 'run', run: s.run, files: s.files, inputs: s.inputs, skip: s.received, cols: size.cols, rows: size.rows, seed: s.seed, fs: s.fs };
  if (s.live) { message.live = true; message.sab = channel.sab; }
  post(message);
}

export async function start() {
  bus.emit('run:starting');
  term.reset();
  notes.textContent = '';
  clearDiagnostics();
  const files = projectFiles();
  session = { run: nextRun(), files, key: JSON.stringify(files), projectId: currentProject().id, inputs: [], received: 0, seed: (Math.random() * 0x7fffffff) | 0, active: true, waiting: null, pendingNeed: null, live: false, keyMode: false, stopping: false, fs: {} };
  const mine = session;
  $('run').dataset.mode = 'stop';
  $('runLabel').textContent = 'Parar';
  $('runIcon').setAttribute('d', 'M2 2h8v8H2z');
  bus.emit('run:state', true);
  $('termState').textContent = engineState.ready ? 'executando' : 'aguardando o .NET';
  setStatus('busy', engineState.ready ? 'Executando…' : 'Carregando o .NET…');
  if (narrow()) showTab('term');
  if (!hasWorker()) spawn();
  // Só depois que o motor está pronto dá para saber se o console ao vivo funciona neste navegador.
  const [stored] = await Promise.all([loadFs(mine.projectId), whenReady()]);
  if (session !== mine || !mine.active || mine.run < 0) return;     // apertou Parar (ou deu erro) enquanto esperava
  mine.fs = stored;
  mine.live = liveSupported();
  $('app').dataset.live = mine.live ? '1' : '0';      // só para conferência nos testes
  if (mine.live) { channel = createChannel(); channel.reset(); setEngineBusy(true); }
  postRun(mine);
}

export function finish() {
  if (session) { session.active = false; session.waiting = null; }
  setEngineBusy(false);
  clearTimeout(watchdog);
  $('run').dataset.mode = 'run';
  $('runLabel').textContent = 'Executar';
  $('runIcon').setAttribute('d', 'M2 1l9 5-9 5z');
  bus.emit('run:state', false);
  $('termState').textContent = '';
  $('ask').hidden = true;
  idleStatus();
}

export function stop() {
  if (!session || !session.active) return;
  if (session.live && !session.stopping) {
    // Pede ao programa que pare por conta própria; se ele estiver preso numa conta longa, o motor é reiniciado.
    const s = session;
    s.stopping = true;
    channel.abort();
    note('', 'Interrompido');
    setStatus('busy', 'Parando…');
    watchdog = setTimeout(() => { if (session === s && s.active) { s.run = -1; restartWorker(); finish(); } }, 1500);
    return;
  }
  const waiting = session.waiting;
  session.run = -1;
  note('', 'Interrompido');
  if (!waiting && engineState.ready) restartWorker();   // o programa está ocupado: a única forma de parar é reiniciar o motor
  finish();
}

export function toggleRun() { if (isRunning()) stop(); else start(); }

// Teclado de verdade (computador, iPad com teclado): vale como as teclas do terminal enquanto o programa espera uma tecla.
function physicalKey(e) {
  const s = session;
  if (!s || !s.active || s.stopping) return;
  if (s.live ? !s.keyMode : s.waiting !== 'key') return;
  const t = e.target;
  if (t && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && t.id !== 'keyInput'))) return;
  if (e.ctrlKey || e.metaKey || e.altKey || ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) return;
  if (t && t.id === 'keyInput') return;      // o próprio campo já cuida
  e.preventDefault();
  give('K' + e.key);
}

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
  document.addEventListener('keydown', physicalKey);
  $('clear').addEventListener('click', () => { term.reset(); notes.textContent = ''; });
  $('copyTerm').addEventListener('click', async () => {
    const text = (screenText() + '\n' + notes.innerText).trim();
    try { await navigator.clipboard.writeText(text); toast('Terminal copiado'); } catch (e) { toast('Não consegui copiar: segure o dedo no texto do terminal'); }
  });
}
