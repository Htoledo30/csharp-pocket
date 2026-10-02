// Mostra o par do parêntese, colchete ou chave que está ao lado do cursor.
import { bus } from './util.js';
import { code, setBrackets, posToLineCol } from './editor.js';
import { mask } from './highlight.js';

const OPEN = '([{', CLOSE = ')]}';

function find() {
  if (code.selectionStart !== code.selectionEnd) return [];
  const src = code.value, pos = code.selectionStart;
  let at = -1;
  if (pos > 0 && (OPEN.includes(src[pos - 1]) || CLOSE.includes(src[pos - 1]))) at = pos - 1;
  else if (OPEN.includes(src[pos]) || CLOSE.includes(src[pos])) at = pos;
  if (at < 0) return [];
  const flat = mask(src);
  const ch = flat[at];
  if (!OPEN.includes(ch) && !CLOSE.includes(ch)) return [];
  const opening = OPEN.includes(ch);
  const mate = opening ? CLOSE[OPEN.indexOf(ch)] : OPEN[CLOSE.indexOf(ch)];
  let depth = 0, found = -1;
  if (opening) {
    for (let i = at; i < flat.length; i++) {
      if (flat[i] === ch) depth++;
      else if (flat[i] === mate && --depth === 0) { found = i; break; }
    }
  } else {
    for (let i = at; i >= 0; i--) {
      if (flat[i] === ch) depth++;
      else if (flat[i] === mate && --depth === 0) { found = i; break; }
    }
  }
  if (found < 0) return [];
  return [at, found].map((i) => posToLineCol(i, src));
}

export function initBrackets() {
  const update = () => setBrackets(find());
  bus.on('caret', update);
  bus.on('edit', update);
  code.addEventListener('blur', () => setBrackets([]));
}
