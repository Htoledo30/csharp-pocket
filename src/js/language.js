// O que o compilador faz por você enquanto digita: erros sublinhados e ajuda dos parâmetros.
// (As sugestões depois do ponto usam o mesmo motor: veja suggest.js.)
import { $, bus, debounce, esc } from './util.js';
import { code, posToLineCol, scroller, lineHeight, charWidth, gutter } from './editor.js';
import { ask, canAsk } from './engine.js';
import { currentProject, projectFiles } from './projects.js';
import { setDiagnostics } from './diagnostics.js';
import { ac } from './suggest.js';

let version = 0;                  // sobe a cada mudança no texto: respostas atrasadas são descartadas

const filesNow = () => projectFiles();
export const askSignature = (pos) => ask('signature', { files: filesNow(), file: currentProject().active, pos });

// ---------------------------------------------------------------- erros ao digitar
async function analyzeNow() {
  const v = version;
  const files = filesNow();
  const result = await ask('analyze', { files });
  if (!result || v !== version) return;
  setDiagnostics(result.diagnostics.filter((d) => d.line > 0), files);
}
const analyzeSoon = debounce(analyzeNow, 700);

// ---------------------------------------------------------------- ajuda dos parâmetros
const sig = $('sig');
let sigResult = null, sigPick = 0, sigSeq = 0;

// Dentro de parênteses abertos na mesma linha (ignorando textos)? Evita perguntar ao motor à toa.
function insideParens(text, pos) {
  const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
  const line = text.slice(lineStart, pos).replace(/"(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?/g, '""');
  let depth = 0;
  for (const ch of line) { if (ch === '(') depth++; else if (ch === ')') depth = Math.max(0, depth - 1); }
  return depth > 0;
}

function hideSignature() { sig.hidden = true; sigResult = null; }

async function showSignatureNow() {
  if (code.selectionStart !== code.selectionEnd || !canAsk() || !insideParens(code.value, code.selectionStart)) return hideSignature();
  const seq = ++sigSeq;
  const result = await askSignature(code.selectionStart);
  if (seq !== sigSeq || !result || !result.overloads || !result.overloads.length) { if (seq === sigSeq) hideSignature(); return; }
  if (!sigResult || sigResult.name !== result.name || sigResult.overloads.length !== result.overloads.length) sigPick = result.best;
  else sigPick = Math.min(sigPick, result.overloads.length - 1);
  sigResult = result;
  drawSignature();
}
const signatureSoon = debounce(showSignatureNow, 160);

function drawSignature() {
  const r = sigResult;
  if (!r || ac.open) { sig.hidden = true; return; }
  const o = r.overloads[sigPick];
  const params = o.params.map((p, i) => '<span class="sig-p' + (i === Math.min(r.active, o.params.length - 1) && o.params.length ? ' on' : '') + '">' + esc(p) + '</span>').join(', ');
  const more = r.overloads.length > 1 ? '<button class="sig-more" aria-label="Outra forma de chamar">' + (sigPick + 1) + '/' + r.overloads.length + '</button>' : '';
  sig.innerHTML = (o.ret ? '<span class="sig-ret">' + esc(o.ret) + '</span> ' : '') + '<b>' + esc(r.name) + '</b>(' + params + ')' + more;
  sig.hidden = false;
  const { line } = posToLineCol(code.selectionStart);
  const lh = lineHeight();
  const h = sig.offsetHeight;
  let top = 10 + (line - 1) * lh - h - 4;
  if (top < scroller.scrollTop) top = 10 + line * lh + 4;       // sem espaço em cima: vai para baixo da linha
  sig.style.top = top + 'px';
  sig.style.left = Math.max(4, scroller.scrollLeft + 4) + 'px';
  sig.style.maxWidth = Math.max(160, scroller.clientWidth - gutter.offsetWidth - 12) + 'px';
}

export function initLanguage() {
  bus.on('edit', () => { version++; analyzeSoon(); signatureSoon(); });
  bus.on('caret', () => signatureSoon());
  bus.on('engine:ready', () => { analyzeSoon(); });
  bus.on('project:opened', () => { version++; hideSignature(); analyzeSoon(); });
  bus.on('file:switched', () => { version++; hideSignature(); analyzeSoon(); });
  bus.on('problem:fixed', () => { version++; analyzeSoon(); });
  code.addEventListener('blur', () => setTimeout(hideSignature, 150));
  sig.addEventListener('pointerdown', (e) => e.preventDefault());
  sig.addEventListener('click', (e) => {
    if (!e.target.closest('.sig-more') || !sigResult) return;
    sigPick = (sigPick + 1) % sigResult.overloads.length;
    drawSignature();
  });
}

export const analyzeAgain = () => { version++; analyzeSoon(); };
