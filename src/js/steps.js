// Passo a passo. O motor roda o programa inteiro uma vez e anota cada comando: a linha, as variáveis
// naquele momento e quanto já tinha sido escrito no terminal. Andar pelos passos é só navegar nessa gravação.
import { $, esc, bus, narrow, toast } from './util.js';
import { code, setLineMarks, setStepLine, scrollToLine } from './editor.js';
import { hideSuggest } from './suggest.js';
import { clearHint } from './hints.js';
import { term, notes, note, termSize, scrollEnd } from './terminal.js';
import { showTab } from './tabs.js';
import { engineState, setStatus, idleStatus } from './status.js';
import { nextRun, post, restartWorker, hasWorker, spawn } from './engine.js';
import { onCompiled, showInputBox } from './run.js';
import { explainRuntime } from './data/errors.js';

export let stepper = null;
export const isStepping = () => stepper !== null;

export function startSteps() {
  bus.emit('steps:starting');
  if (stepper) endSteps();
  term.reset();
  notes.textContent = '';
  setLineMarks(new Map());
  stepper = { run: nextRun(), source: code.value, inputs: [], seed: (Math.random() * 0x7fffffff) | 0, index: 0, steps: null, strings: [], output: '', shown: 0, status: '', detail: '', waiting: false, resumed: false };
  code.readOnly = true;
  code.blur();
  hideSuggest();
  clearHint();
  $('keys').hidden = true;
  $('stepper').hidden = false;
  $('stepInfo').textContent = engineState.ready ? 'Preparando o passo a passo…' : 'Carregando o .NET…';
  $('stepMsg').textContent = '';
  $('stepVars').textContent = '';
  $('stepOut').hidden = true;
  $('stepBack').disabled = true; $('stepNext').disabled = true; $('stepRange').disabled = true;
  setStatus('busy', 'Passo a passo');
  showTab('code');
  setStepLine(0);
  if (!hasWorker()) spawn();
  postTrace();
}

function postTrace() {
  const size = termSize();
  post({ type: 'trace', run: stepper.run, source: stepper.source, inputs: stepper.inputs, cols: size.cols, rows: size.rows, seed: stepper.seed });
}

export function endSteps() {
  if (!stepper) return;
  const pending = !stepper.steps || stepper.resumed;
  stepper = null;
  code.readOnly = false;
  $('stepper').hidden = true;
  $('keys').hidden = false;
  $('ask').hidden = true;
  $('termState').textContent = '';
  setStepLine(0);
  if (pending && engineState.ready) restartWorker(); else idleStatus();
}

function onTraced(m) {
  const s = stepper;
  if (m.status === 'compile') { s.steps = []; endSteps(); if (narrow()) showTab('term'); return; }
  if (m.status === 'crash') {
    note('error', 'A execução foi interrompida.\n<span class="where">' + esc(m.detail || '') + '</span>');
    s.steps = s.steps || [];
    s.resumed = false;
    endSteps();
    restartWorker();
    return;
  }
  let data = null;
  try { data = JSON.parse(m.trace); } catch (e) { data = null; }
  if (m.status === 'nostep' || !data || !data.steps.length) {
    s.steps = []; s.resumed = false;
    endSteps();
    toast('Não foi possível preparar o passo a passo deste código');
    return;
  }
  const again = s.resumed;
  s.steps = data.steps; s.strings = data.strings; s.output = m.output.replace(/\x07/g, ''); s.status = m.status; s.detail = m.detail || '';
  s.resumed = false;
  if (again) s.index = Math.min(s.index + 1, s.steps.length - 1);
  else s.index = 0;
  notes.textContent = '';
  if (m.status === 'error') {
    const cut = s.detail.indexOf(':');
    const lines = s.detail.slice(cut + 1).split('\n');
    const plain = explainRuntime(lines[0]);
    s.errorText = plain || lines[0];
    note('error', 'Erro durante a execução na linha ' + (Number(s.detail.slice(0, cut)) || '?') + '\n' + esc(plain || lines[0]) + (plain ? '<span class="raw">' + esc(lines[0]) + '</span>' : ''));
  }
  $('stepRange').max = String(s.steps.length - 1);
  $('stepRange').disabled = false;
  s.shown = -1;
  showStep();
}

function varsOf(step, strings) {
  const map = new Map();
  for (let i = 3; i + 1 < step.length; i += 2) map.set(strings[step[i]], strings[step[i + 1]]);
  return map;
}

function showStep() {
  const s = stepper;
  const step = s.steps[s.index];
  const line = step[0], emitted = step[1], where = s.strings[step[2]];
  const last = s.index === s.steps.length - 1;

  // terminal: exatamente o que já tinha sido escrito quando esta linha foi alcançada
  if (s.shown < 0 || emitted < s.shown) { term.reset(); term.write(s.output.slice(0, emitted)); }
  else if (emitted > s.shown) term.write(s.output.slice(s.shown, emitted));
  s.shown = emitted;

  // variáveis, com o que mudou desde o passo anterior em destaque
  const now = varsOf(step, s.strings);
  const prevStep = s.index > 0 ? s.steps[s.index - 1] : null;
  const before = prevStep && s.strings[prevStep[2]] === where ? varsOf(prevStep, s.strings) : null;
  const box = $('stepVars');
  box.textContent = '';
  if (!now.size) {
    const empty = document.createElement('p');
    empty.textContent = line === 0 ? '' : 'Nenhuma variável criada até aqui.';
    box.append(empty);
  }
  for (const [name, value] of now) {
    const row = document.createElement('div');
    const changed = before && before.get(name) !== value;
    row.className = 'var' + (changed ? ' changed' : '');
    const n = document.createElement('b');
    n.textContent = name;
    const v = document.createElement('span');
    v.textContent = value;
    row.append(n, v);
    if (changed && before.has(name)) {
      const was = document.createElement('i');
      was.textContent = 'era ' + before.get(name);
      row.append(was);
    }
    box.append(row);
  }

  let msg = '';
  if (line === 0) msg = 'O programa chegou ao fim.';
  else if (last && s.status === 'need') msg = 'Esta linha espera você digitar. Toque em Próximo para responder.';
  else if (last && s.status === 'error') msg = 'O programa parou nesta linha: ' + s.errorText;
  else if (last && s.status === 'steplimit') msg = 'O passo a passo guarda até 30 000 passos, e este programa passou disso. Há um laço que não termina?';
  else if (last && s.status === 'limit') msg = 'O programa escreveu texto demais e foi interrompido.';
  else if (last) msg = 'Último passo do programa.';
  $('stepMsg').textContent = msg;
  $('stepMsg').className = 'step-msg' + (last && s.status === 'error' ? ' bad' : '');
  $('stepInfo').textContent = 'Passo ' + (s.index + 1) + ' de ' + s.steps.length + (line ? ' · vai executar a linha ' + line : '') + (where ? ' · dentro de ' + where : '');
  $('stepBack').disabled = s.index === 0;
  $('stepNext').disabled = last && s.status !== 'need';
  $('stepRange').value = String(s.index);

  // celular: o terminal está em outra aba, então mostrar aqui o fim da saída
  const visible = s.output.slice(0, emitted).split('\x1b[2J').pop().replace(/\x1b\[[0-9;?]*[@-~]|\x1b\][^\x07]*\x07/g, '');
  const tail = visible.split('\n').filter((l) => l.trim()).slice(-3).join('\n');
  $('stepOutText').textContent = tail;
  $('stepOut').hidden = !tail;

  setStepLine(line);
  if (line) scrollToLine(line);
}

function stepBy(delta) {
  const s = stepper;
  if (!s || !s.steps || s.waiting) return;
  if (delta > 0 && s.index === s.steps.length - 1) {
    if (s.status !== 'need') return;
    const kind = s.detail.split(':')[0];
    s.waiting = true;
    $('termState').textContent = kind === 'key' ? 'aperte uma tecla' : 'esperando entrada';
    showInputBox(kind);
    return;
  }
  s.index = Math.max(0, Math.min(s.steps.length - 1, s.index + delta));
  showStep();
}

function giveStep(item) {
  const s = stepper;
  s.waiting = false;
  s.resumed = true;
  s.inputs.push(item.replace(/\u0001/g, ''));
  $('ask').hidden = true;
  $('termState').textContent = '';
  $('stepInfo').textContent = 'Continuando…';
  $('stepNext').disabled = true; $('stepBack').disabled = true;
  showTab('code');
  postTrace();
}

export function initSteps() {
  bus.on('engine:message', (m) => {
    if (!stepper || m.run !== stepper.run) return;
    if (m.type === 'compiled') onCompiled(m.result);
    else if (m.type === 'traced') onTraced(m);
  });
  bus.on('engine:failed', () => { if (stepper) { stepper.steps = stepper.steps || []; stepper.resumed = false; endSteps(); } });
  bus.on('run:starting', () => { if (stepper) endSteps(); });
  bus.on('editor:will-change', () => { if (stepper) endSteps(); });
  bus.on('project:before-open', () => { if (stepper) endSteps(); });
  bus.on('input:give', (item, taken) => { if (stepper && stepper.waiting) { giveStep(item); taken.handled = true; } });
  bus.on('steps:toggle', () => { if (stepper) endSteps(); else startSteps(); });

  $('steps').addEventListener('click', () => { if (stepper) endSteps(); else startSteps(); });
  $('stepNext').addEventListener('click', () => stepBy(1));
  $('stepBack').addEventListener('click', () => stepBy(-1));
  $('stepExit').addEventListener('click', endSteps);
  $('stepRange').addEventListener('input', () => {
    if (!stepper || !stepper.steps || stepper.waiting) return;
    stepper.index = Number($('stepRange').value) || 0;
    showStep();
  });
  $('stepOutGo').addEventListener('click', () => showTab('term'));
  document.addEventListener('keydown', (e) => {
    if (!stepper || !stepper.steps || stepper.waiting || e.target.tagName === 'INPUT' || document.querySelector('.modal-back:not([hidden])')) return;
    if (e.key === 'ArrowRight' || e.key === 'F10') { e.preventDefault(); stepBy(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); stepBy(-1); }
    else if (e.key === 'Escape') endSteps();
  });
}
