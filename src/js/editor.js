// O editor: um <textarea> transparente por cima de um <pre> colorido, com números de linha,
// marcas de erro, fecho automático de ( { [ ", recuo automático e rolagem do cursor.
import { $, bus, narrow } from './util.js';
import { highlight } from './highlight.js';
import { showTab } from './tabs.js';

export const code = $('code');
export const gutter = $('gutter'), scroller = $('scroller');
const hl = $('hl'), marks = $('marks');

// O que está marcado por cima do código: linhas com erro, o passo atual, sublinhados e buscas.
const decor = { lines: new Map(), step: 0, squiggles: [], finds: [], findCurrent: -1 };
let lastGutter = '', lastMarks = '';

// ---------------------------------------------------------------- medidas
let metricsCache = null, lhCache = 0;
export function lineHeight() {
  if (!lhCache) lhCache = parseFloat(getComputedStyle(code).lineHeight) || 21;
  return lhCache;
}
export function charWidth() {
  if (!metricsCache) {
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:' + getComputedStyle(code).font;
    probe.textContent = 'M'.repeat(40);
    document.body.appendChild(probe);
    metricsCache = probe.getBoundingClientRect().width / 40 || 8.4;
    probe.remove();
  }
  return metricsCache;
}
export function resetMetrics() { metricsCache = null; lhCache = 0; }
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { resetMetrics(); paint(); });

// ---------------------------------------------------------------- desenho
export function paint() {
  const src = code.value;
  hl.innerHTML = highlight(src) + '\n';
  const count = src.split('\n').length;
  const lh = lineHeight();
  let g = '', mk = '';
  for (let i = 1; i <= count; i++) {
    const sev = decor.lines.get(i);
    if (i === decor.step) {
      g += '<span class="st">' + i + '</span>';
      mk += '<i class="s" style="top:' + (i - 1) * lh + 'px"></i>';
      continue;
    }
    g += sev ? '<span class="' + (sev === 'error' ? 'e' : 'w') + '">' + i + '</span>' : '<span>' + i + '</span>';
    if (sev) mk += '<i class="' + (sev === 'error' ? '' : 'w') + '" style="top:' + (i - 1) * lh + 'px"></i>';
  }
  for (const q of decor.squiggles) {
    mk += '<i class="sq ' + (q.sev === 'error' ? 'e' : q.sev === 'tip' ? 't' : 'w') + '" style="top:' + (q.line - 1) * lh + 'px;left:calc(10px + ' + (q.col - 1) + 'ch);width:' + Math.max(1, q.len) + 'ch"></i>';
  }
  decor.finds.forEach((f, idx) => {
    mk += '<i class="find' + (idx === decor.findCurrent ? ' now' : '') + '" style="top:' + (f.line - 1) * lh + 'px;left:calc(10px + ' + (f.col - 1) + 'ch);width:' + Math.max(1, f.len) + 'ch"></i>';
  });
  if (g !== lastGutter) { gutter.innerHTML = g; lastGutter = g; }
  if (mk !== lastMarks) { marks.innerHTML = mk; lastMarks = mk; }
}

export function setLineMarks(map) { decor.lines = map || new Map(); paint(); }
export function setStepLine(line) { decor.step = line || 0; paint(); }
export function setSquiggles(list) { decor.squiggles = list || []; paint(); }
export function setFinds(list, current = -1) { decor.finds = list || []; decor.findCurrent = current; paint(); }
export function hasLineMarks() { return decor.lines.size > 0; }

// ---------------------------------------------------------------- posições
// Índice do texto <-> linha e coluna (começam em 1).
export function posToLineCol(index, src = code.value) {
  let line = 1, last = -1;
  for (let i = src.indexOf('\n'); i !== -1 && i < index; i = src.indexOf('\n', i + 1)) { line++; last = i; }
  return { line, col: index - last };
}
export function lineColToPos(line, col = 1, src = code.value) {
  let pos = 0;
  for (let i = 1; i < line; i++) {
    const nl = src.indexOf('\n', pos);
    if (nl < 0) return src.length;
    pos = nl + 1;
  }
  const nl = src.indexOf('\n', pos);
  const lineEnd = nl < 0 ? src.length : nl;
  return Math.max(pos, Math.min(pos + Math.max(0, col - 1), lineEnd));
}
export const lineStartOf = (pos, src = code.value) => src.lastIndexOf('\n', pos - 1) + 1;
export function lineEndOf(pos, src = code.value) { const nl = src.indexOf('\n', pos); return nl < 0 ? src.length : nl; }

// O textarea nunca rola sozinho: o cursor é mantido à vista aqui.
export function reveal() {
  if (code.selectionStart !== code.selectionEnd) return;
  const { line, col } = posToLineCol(code.selectionStart);
  const lh = lineHeight(), cw = charWidth(), gw = gutter.offsetWidth;
  const top = 10 + (line - 1) * lh, left = 10 + (col - 1) * cw;
  if (top < scroller.scrollTop + 4) scroller.scrollTop = top - 4;
  else if (top + lh > scroller.scrollTop + scroller.clientHeight - 6) scroller.scrollTop = top + lh - scroller.clientHeight + 6;
  const viewW = scroller.clientWidth - gw;
  if (left < scroller.scrollLeft + 4) scroller.scrollLeft = Math.max(0, left - 24);
  else if (left + cw > scroller.scrollLeft + viewW - 8) scroller.scrollLeft = left + cw - viewW + 24;
}

export function scrollToLine(line, center = false) {
  const lh = lineHeight(), top = 10 + (line - 1) * lh;
  if (center || top < scroller.scrollTop + lh || top > scroller.scrollTop + scroller.clientHeight - 2 * lh) scroller.scrollTop = Math.max(0, top - scroller.clientHeight / 2);
}

// ---------------------------------------------------------------- edição
// Insere no cursor passando pelo navegador, para o "desfazer" funcionar.
export function insert(text, selStart, selEnd) {
  code.focus({ preventScroll: true });
  const start = code.selectionStart;
  let done = false;
  try { done = document.execCommand('insertText', false, text); } catch (e) { done = false; }
  if (!done) {
    code.setRangeText(text, start, code.selectionEnd, 'end');
    code.dispatchEvent(new Event('input'));
  }
  if (selStart !== undefined) code.setSelectionRange(start + selStart, start + (selEnd === undefined ? selStart : selEnd));
  reveal();
}

// Troca o trecho [from, to) por um texto novo, deixando o cursor em `caret` (posição já no texto novo).
export function replaceRange(from, to, text, caretFrom, caretTo) {
  code.focus({ preventScroll: true });
  code.setSelectionRange(from, to);
  insert(text);
  if (caretFrom !== undefined) code.setSelectionRange(caretFrom, caretTo === undefined ? caretFrom : caretTo);
  reveal();
}

export function setCursor(a, b = a) {
  code.focus({ preventScroll: true });
  code.setSelectionRange(a, b);
  reveal();
}

export function setCode(text, keepHistory) {
  text = text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
  if (keepHistory) {
    code.focus({ preventScroll: true });
    code.setSelectionRange(0, code.value.length);
    insert(text, 0);
  } else {
    code.value = text;
  }
  decor.lines = new Map(); decor.squiggles = []; decor.finds = []; decor.findCurrent = -1;
  paint();
  bus.emit('code:set', code.value);
}

export function jumpTo(line, col) {
  showTab('code');
  const pos = lineColToPos(line, col || 1);
  code.focus({ preventScroll: true });
  code.setSelectionRange(pos, pos);
  reveal();
}

// ---------------------------------------------------------------- tamanho da letra
export function setFontSize(px) {
  px = Math.max(10, Math.min(24, Math.round(px)));
  document.documentElement.style.setProperty('--code-size', px + 'px');
  document.documentElement.style.setProperty('--lh', Math.round(px * 1.5) + 'px');
  resetMetrics();
  paint();
  bus.emit('font', px);
  return px;
}
export const fontSize = () => parseFloat(getComputedStyle(code).fontSize) || 14;

// ---------------------------------------------------------------- ganchos de teclado
// Outros módulos (sugestões, por exemplo) podem tratar a tecla antes do editor.
const keyHooks = [], inputHooks = [];
export const addKeyHook = (fn) => keyHooks.push(fn);
export const addInputHook = (fn) => inputHooks.push(fn);

const CLOSERS = { '{': '}', '(': ')', '[': ']', '"': '"' };

function onBeforeInput(e) {
  for (const hook of inputHooks) if (hook(e)) return;
  const v = code.value, a = code.selectionStart, b = code.selectionEnd;
  if (e.inputType === 'insertLineBreak' || (e.inputType === 'insertText' && e.data === '\n')) {
    e.preventDefault();
    const lineStart = lineStartOf(a);
    const indent = /^[ \t]*/.exec(v.slice(lineStart, a))[0];
    const opens = v.slice(lineStart, a).trimEnd().endsWith('{');
    if (opens && v[b] === '}') insert('\n' + indent + '    \n' + indent, indent.length + 5);
    else insert('\n' + indent + (opens ? '    ' : ''));
    return;
  }
  // O "pontuação inteligente" do iOS troca -- por travessão e ... por reticências: manter o que foi digitado.
  if (e.inputType === 'insertReplacementText' && e.data && /^[—–…]+$/.test(e.data)) { e.preventDefault(); return; }
  if (e.inputType !== 'insertText' || !e.data) return;
  // ...e aspas retas em aspas curvas, que o C# não aceita.
  const straight = e.data.replace(/[“”„‟]/g, '"').replace(/[‘’‚‛]/g, "'");
  const forced = straight !== e.data;
  if (forced) e.preventDefault();
  if (straight.length !== 1) { if (forced) insert(straight); return; }
  const ch = straight, next = v[b] || '';
  if (a === b && (ch === '}' || ch === ')' || ch === ']' || ch === '"') && next === ch) {
    e.preventDefault();
    code.setSelectionRange(a + 1, a + 1);
    return;
  }
  if (ch === '}' && a === b) {
    const lead = v.slice(lineStartOf(a), a);
    if (/^ {4,}$/.test(lead)) {
      e.preventDefault();
      code.setSelectionRange(a - 4, a);
      insert('}');
      return;
    }
  }
  if (CLOSERS[ch] && (a !== b || next === '' || /[\s)\]};,]/.test(next)) && !(ch === '"' && a === b && /\w/.test(v[a - 1] || ''))) {
    e.preventDefault();
    const inner = v.slice(a, b);
    insert(ch + inner + CLOSERS[ch], 1, 1 + inner.length);
    return;
  }
  if (forced) insert(ch);
}

function onKeyDown(e) {
  for (const hook of keyHooks) if (hook(e)) return;
  if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    bus.emit('editor:tab', e.shiftKey);
    return;
  }
  if (e.key === 'Backspace' && code.selectionStart === code.selectionEnd) {
    const a = code.selectionStart, v = code.value;
    const pair = v.slice(a - 1, a + 1);
    if (pair === '{}' || pair === '()' || pair === '[]' || pair === '""') {
      e.preventDefault();
      code.setSelectionRange(a - 1, a + 1);
      insert('');
    }
  }
}

export function initEditor() {
  code.addEventListener('beforeinput', onBeforeInput);
  code.addEventListener('keydown', onKeyDown);
  code.addEventListener('input', () => {
    if (decor.lines.size || decor.squiggles.length) { decor.lines = new Map(); decor.squiggles = []; }
    paint();
    reveal();
    bus.emit('edit', code.value);
  });
  for (const type of ['keyup', 'click']) code.addEventListener(type, reveal);
  for (const type of ['keyup', 'click', 'focus']) code.addEventListener(type, () => bus.emit('caret'));
  // No celular, o editor ganha a tela toda enquanto o teclado está aberto.
  // Sair do modo é adiado um instante: o toque que tirou o foco precisa acontecer antes de o layout mexer.
  let typingTimer = 0;
  code.addEventListener('focus', () => { clearTimeout(typingTimer); if (narrow() && !code.readOnly) $('app').classList.add('typing'); });
  code.addEventListener('blur', () => { clearTimeout(typingTimer); typingTimer = setTimeout(() => $('app').classList.remove('typing'), 300); });
  paint();
}
