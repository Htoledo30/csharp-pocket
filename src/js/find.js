// Buscar e trocar dentro do arquivo aberto.
import { $, bus, narrow, toast } from './util.js';
import { code, setFinds, posToLineCol, replaceRange, setCode, reveal, scrollToLine } from './editor.js';

const bar = $('findbar'), input = $('findInput'), replaceInput = $('replaceInput');
let matches = [], current = -1, ignoreCase = true;

export const isOpen = () => !bar.hidden;

function compute() {
  matches = [];
  const needle = input.value;
  if (needle) {
    const hay = ignoreCase ? code.value.toLowerCase() : code.value;
    const find = ignoreCase ? needle.toLowerCase() : needle;
    for (let i = hay.indexOf(find); i !== -1 && matches.length < 2000; i = hay.indexOf(find, i + Math.max(1, find.length))) {
      const { line, col } = posToLineCol(i);
      matches.push({ index: i, len: needle.length, line, col });
    }
  }
  if (current >= matches.length) current = matches.length - 1;
  draw();
}

function draw() {
  setFinds(matches, current);
  $('findCount').textContent = input.value ? (matches.length ? (current + 1) + ' de ' + matches.length : 'nada') : '';
  $('findCount').classList.toggle('none', !!input.value && !matches.length);
}

// Vai para o achado `i` e seleciona.
function select(i) {
  if (!matches.length) return;
  current = (i + matches.length) % matches.length;
  const m = matches[current];
  code.setSelectionRange(m.index, m.index + m.len);
  scrollToLine(m.line);
  reveal(true);
  draw();
}

function nextFrom(position, backwards) {
  if (!matches.length) return;
  if (backwards) {
    let i = matches.length - 1;
    while (i >= 0 && matches[i].index >= position) i--;
    select(i < 0 ? matches.length - 1 : i);
  } else {
    let i = matches.findIndex((m) => m.index >= position);
    select(i < 0 ? 0 : i);
  }
}

export const next = () => select(current < 0 ? 0 : current + 1);
export const previous = () => select(current <= 0 ? matches.length - 1 : current - 1);

export function openFind({ replace = false } = {}) {
  bar.hidden = false;
  $('replaceRow').hidden = !replace;
  const selected = code.value.slice(code.selectionStart, code.selectionEnd);
  if (selected && !selected.includes('\n')) input.value = selected;
  compute();
  input.focus();
  input.select();
}

export function closeFind() {
  bar.hidden = true;
  matches = []; current = -1;
  setFinds([], -1);
  code.focus();
}

function replaceOne() {
  if (!matches.length) return;
  const selected = code.value.slice(code.selectionStart, code.selectionEnd);
  const same = ignoreCase ? selected.toLowerCase() === input.value.toLowerCase() : selected === input.value;
  if (!same) { next(); return; }
  const from = code.selectionStart;
  replaceRange(from, from + selected.length, replaceInput.value, from + replaceInput.value.length);
  compute();
  nextFrom(from + replaceInput.value.length, false);
  replaceInput.focus();
}

function replaceAll() {
  if (!matches.length) return;
  const needle = input.value;
  const re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), ignoreCase ? 'gi' : 'g');
  const count = matches.length;
  setCode(code.value.replace(re, () => replaceInput.value), true);
  compute();
  toast(count + (count === 1 ? ' troca feita' : ' trocas feitas'));
}

export function initFind() {
  input.addEventListener('input', () => { current = -1; compute(); if (matches.length) { const i = matches.findIndex((m) => m.index >= code.selectionStart); current = i < 0 ? 0 : i; draw(); } });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); if (e.shiftKey) previous(); else next(); input.focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); closeFind(); }
  });
  replaceInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); replaceOne(); }
    else if (e.key === 'Escape') { e.preventDefault(); closeFind(); }
  });
  $('findNext').addEventListener('click', () => { next(); });
  $('findPrev').addEventListener('click', () => { previous(); });
  $('findClose').addEventListener('click', closeFind);
  $('findCase').addEventListener('click', () => {
    ignoreCase = !ignoreCase;
    $('findCase').setAttribute('aria-pressed', String(!ignoreCase));
    compute();
  });
  $('findReplaceToggle').addEventListener('click', () => { $('replaceRow').hidden = !$('replaceRow').hidden; });
  $('replaceOne').addEventListener('click', replaceOne);
  $('replaceAll').addEventListener('click', replaceAll);
  // Os destaques acompanham o texto quando ele muda.
  bus.on('edit', () => { if (isOpen()) compute(); });
  bus.on('code:set', () => { if (isOpen()) compute(); });
  // No celular, o editor continua com a tela toda enquanto se digita na busca.
  for (const field of [input, replaceInput]) {
    field.addEventListener('focus', () => { if (narrow()) $('app').classList.add('typing'); });
    field.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== code && document.activeElement !== input && document.activeElement !== replaceInput) $('app').classList.remove('typing'); }, 300));
  }
}
