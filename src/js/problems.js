// A faixa de problema embaixo do editor: mostra, em português, o erro da linha onde está o cursor,
// com botões de conserto quando dá para consertar com um toque.
import { $, esc, bus } from './util.js';
import { code, posToLineCol, replaceRange } from './editor.js';
import { diagnosticsOf } from './diagnostics.js';
import { explain } from './data/errors.js';
import { fixesFor } from './fixes.js';

const box = $('problem');
let shown = null;

// O erro que interessa agora: o da linha do cursor (o que cobre o cursor primeiro).
function pick() {
  const list = diagnosticsOf().filter((d) => d.line && d.severity !== 'tip');
  if (!list.length) return null;
  const { line, col } = posToLineCol(code.selectionStart);
  const onLine = list.filter((d) => d.line === line);
  if (!onLine.length) return null;
  const covering = onLine.find((d) => d.endLine === d.line && col >= d.col && col <= d.endCol);
  return covering || onLine.find((d) => d.severity === 'error') || onLine[0];
}

export function refreshProblem() {
  if (document.activeElement !== code && !box.contains(document.activeElement)) {
    // Sem foco no editor (por exemplo, rodando o programa): não mostrar.
    if (!shown) { box.hidden = true; return; }
  }
  const d = pick();
  if (!d) { shown = null; box.hidden = true; return; }
  if (shown !== d) box.classList.remove('open');
  shown = d;
  const plain = explain(d) || d.message;
  $('problemWhere').textContent = (d.severity === 'warning' ? 'Aviso · ' : '') + 'Linha ' + d.line;
  $('problemMsg').textContent = plain;
  const fixes = fixesFor(d, code.value);
  const holder = $('problemFixes');
  holder.textContent = '';
  for (const fix of fixes) {
    const b = document.createElement('button');
    b.className = 'mini strong';
    b.textContent = fix.label;
    b.addEventListener('click', () => {
      replaceRange(fix.from, fix.to, fix.text, fix.from + fix.text.length);
      bus.emit('problem:fixed');
    });
    holder.append(b);
  }
  box.hidden = false;
}

export function initProblems() {
  $('problemMsg').parentElement.addEventListener('click', () => box.classList.toggle('open'));
  // Tocar num botão da faixa não pode tirar o foco do editor (o teclado do celular fecharia).
  box.addEventListener('pointerdown', (e) => e.preventDefault());
  bus.on('diagnostics:changed', refreshProblem);
  bus.on('caret', refreshProblem);
  bus.on('edit', () => { shown = null; box.hidden = true; });
  code.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== code && !box.contains(document.activeElement)) box.hidden = true; }, 200));
  code.addEventListener('focus', refreshProblem);
}
