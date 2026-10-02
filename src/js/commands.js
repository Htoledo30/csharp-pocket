// Comandos de edição por linha: duplicar, apagar, mover, comentar, recuar, ir para a linha e renomear.
// Tudo passa pelo navegador (execCommand), então "desfazer" funciona em cada um.
import { bus, toast } from './util.js';
import { code, replaceRange, setCursor, setCode, lineStartOf, lineEndOf, posToLineCol, lineColToPos, jumpTo, insert } from './editor.js';
import { TOKEN, KEYWORDS } from './highlight.js';
import { askText } from './dialog.js';
import { currentProject, projectFiles } from './projects.js';

const IND = '    ';

// As linhas tocadas pela seleção (uma seleção que termina no começo de uma linha não conta essa linha).
function linesRange() {
  const src = code.value;
  let a = code.selectionStart, b = code.selectionEnd;
  if (b > a && src[b - 1] === '\n') b--;
  const from = lineStartOf(a, src);
  const to = lineEndOf(Math.max(a, b), src);
  return { src, a: code.selectionStart, b: code.selectionEnd, from, to };
}

export function duplicateLines() {
  const { src, a, b, from, to } = linesRange();
  const block = src.slice(from, to);
  const shift = to + 1 - from;
  replaceRange(to, to, '\n' + block, a + shift, b + shift);
}

export function deleteLines() {
  const { src, from, to } = linesRange();
  const hasNext = to < src.length;
  const start = hasNext ? from : Math.max(0, from - 1);
  const end = hasNext ? to + 1 : to;
  replaceRange(start, end, '', Math.min(start, src.length));
  const pos = lineStartOf(Math.min(start, code.value.length), code.value);
  setCursor(pos);
}

export function moveLines(direction) {
  const { src, a, b, from, to } = linesRange();
  if (direction < 0) {
    if (from === 0) return;
    const prevFrom = lineStartOf(from - 1, src);
    const prev = src.slice(prevFrom, from - 1);
    const block = src.slice(from, to);
    const shift = -(prev.length + 1);
    replaceRange(prevFrom, to, block + '\n' + prev, a + shift, b + shift);
  } else {
    if (to >= src.length) return;
    const nextTo = lineEndOf(to + 1, src);
    const next = src.slice(to + 1, nextTo);
    const block = src.slice(from, to);
    const shift = next.length + 1;
    replaceRange(from, nextTo, next + '\n' + block, a + shift, b + shift);
  }
}

export function toggleComment() {
  const { src, a, b, from, to } = linesRange();
  const lines = src.slice(from, to).split('\n');
  const used = lines.filter((l) => l.trim());
  const allCommented = used.length > 0 && used.every((l) => /^\s*\/\//.test(l));
  const indent = used.length ? Math.min(...used.map((l) => /^ */.exec(l)[0].length)) : 0;
  const next = lines.map((l) => {
    if (!l.trim()) return l;
    if (allCommented) return l.replace(/^(\s*)\/\/ ?/, '$1');
    return l.slice(0, indent) + '// ' + l.slice(indent);
  });
  const text = next.join('\n');
  if (a !== b) { replaceRange(from, to, text, from, from + text.length); return; }
  // sem seleção: o cursor acompanha a mudança da linha dele
  const caretLine = src.slice(from, a).split('\n').length - 1;
  const delta = next[caretLine].length - lines[caretLine].length;
  replaceRange(from, to, text, Math.max(from, a + delta));
}

// Tab: com várias linhas escolhidas recua todas; sem seleção, coloca 4 espaços.
export function indentLines(outdent) {
  const { src, a, b, from, to } = linesRange();
  const multi = src.slice(a, b).includes('\n');
  if (!outdent && !multi) { insert(IND); return; }
  const lines = src.slice(from, to).split('\n');
  const next = lines.map((l) => (outdent ? l.replace(/^ {1,4}/, '') : (l.trim() ? IND + l : l)));
  const text = next.join('\n');
  if (text === src.slice(from, to)) return;
  if (multi) replaceRange(from, to, text, from, from + text.length);
  else {
    const removed = lines[0].length - next[0].length;
    replaceRange(from, to, text, Math.max(from, a - removed));
  }
}

export function selectLine() {
  const { from, to } = linesRange();
  setCursor(from, Math.min(to + 1, code.value.length));
}

// Início inteligente: primeiro vai ao primeiro caractere da linha; de novo, ao começo.
export function smartHome(select = false) {
  const src = code.value, pos = code.selectionEnd;
  const start = lineStartOf(pos, src);
  const firstChar = start + /^ */.exec(src.slice(start))[0].length;
  const target = pos === firstChar ? start : firstChar;
  setCursor(select ? code.selectionStart : target, select ? target : target);
}
export function lineEnd(select = false) {
  const end = lineEndOf(code.selectionEnd);
  setCursor(select ? code.selectionStart : end, end);
}

export function moveCaret(dx, dy) {
  const src = code.value;
  const { line, col } = posToLineCol(code.selectionStart, src);
  let pos;
  if (dy) pos = lineColToPos(Math.max(1, line + dy), col, src);
  else pos = Math.max(0, Math.min(src.length, code.selectionStart + dx));
  setCursor(pos);
}

export async function gotoLine() {
  const total = code.value.split('\n').length;
  const answer = await askText({
    title: 'Ir para a linha', label: 'Número da linha (1 a ' + total + ')', ok: 'Ir',
    check: (v) => (/^\d+$/.test(v) && +v >= 1 && +v <= total ? '' : 'Digite um número entre 1 e ' + total + '.'),
  });
  if (answer) jumpTo(Number(answer), 1);
}

// ---------------------------------------------------------------- renomear
// Troca um nome em todo o código dos arquivos do programa, menos dentro de textos e comentários
// (nos textos com $"..." só dentro das chaves {}).
export function renameInSource(src, oldName, newName) {
  const swapWords = (text) => text.replace(new RegExp('\\b' + oldName + '\\b', 'g'), newName);
  let out = '', last = 0, m;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(src))) {
    out += src.slice(last, m.index);
    if (m[1]) out += m[0];
    else if (m[2]) {
      out += m[0].startsWith('$') ? m[0].replace(/(?<!\{)\{(?!\{)[^{}]*\}/g, (inner) => swapWords(inner)) : m[0];
    } else if (m[3]) out += m[0];
    else out += m[4] === oldName ? newName : m[0];
    last = TOKEN.lastIndex;
    if (m[0] === '') TOKEN.lastIndex++;
  }
  return out + src.slice(last);
}

export function wordAtCaret() {
  const v = code.value;
  let a = code.selectionStart, b = code.selectionEnd;
  if (a === b) {
    while (a > 0 && /\w/.test(v[a - 1])) a--;
    while (b < v.length && /\w/.test(v[b])) b++;
  }
  const word = v.slice(a, b);
  return /^[A-Za-z_]\w*$/.test(word) && !KEYWORDS.has(word) ? word : '';
}

export async function renameSymbol() {
  const word = wordAtCaret();
  if (!word) { toast('Toque em um nome (variável, método ou classe) e tente de novo'); return; }
  const next = await askText({
    title: 'Renomear', label: 'Novo nome para "' + word + '" (em todos os arquivos)', value: word, ok: 'Renomear',
    check: (v) => (/^[A-Za-z_]\w*$/.test(v) && !KEYWORDS.has(v) ? '' : 'Use letras, números e _, começando por uma letra, e não uma palavra do C#.'),
  });
  if (!next || next === word) return;
  const p = currentProject();
  let changed = 0;
  p.files.forEach((f, i) => {
    if (i === p.active) return;
    const text = renameInSource(f.code, word, next);
    if (text !== f.code) { f.code = text; changed++; }
  });
  const here = renameInSource(code.value, word, next);
  if (here !== code.value) { setCode(here, true); changed++; }
  bus.emit('projects:changed', p.id);
  bus.emit('problem:fixed');
  toast(changed ? '"' + word + '" virou "' + next + '"' : 'Nada para trocar');
}

export const filesSnapshot = () => projectFiles();
