// Atalhos de teclado (para quem usa o iPad com teclado ou o computador).
import { bus, toast } from './util.js';
import { addKeyHook } from './editor.js';
import { openFind, isOpen, closeFind } from './find.js';
import { duplicateLines, deleteLines, moveLines, toggleComment, gotoLine } from './commands.js';
import { persist } from './projects.js';

// Devolve true se tratou o atalho.
function handle(e) {
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (key === 'Enter' && mod) { bus.emit('run:toggle'); return true; }
  if (key === 'f' && e.shiftKey && e.altKey) { bus.emit('format'); return true; }
  if (mod && !e.shiftKey && !e.altKey) {
    if (key === 'f') { openFind(); return true; }
    if (key === 'h') { openFind({ replace: true }); return true; }
    if (key === 'g') { gotoLine(); return true; }
    if (key === '/') { toggleComment(); return true; }
    if (key === 'd') { duplicateLines(); return true; }
    if (key === 's') { persist(true); toast('Guardado'); return true; }
  }
  if (mod && e.shiftKey && key === 'k') { deleteLines(); return true; }
  if (e.altKey && !mod && (key === 'ArrowUp' || key === 'ArrowDown')) { moveLines(key === 'ArrowUp' ? -1 : 1); return true; }
  if (key === 'Escape' && isOpen()) { closeFind(); return true; }
  return false;
}

export function initShortcuts() {
  // No editor, antes das outras regras de tecla.
  addKeyHook((e) => {
    if (!handle(e)) return false;
    e.preventDefault();
    return true;
  });
  // Fora do editor (por exemplo, com o foco no terminal).
  document.addEventListener('keydown', (e) => {
    if (e.target && e.target.id === 'code') return;
    const tag = e.target && e.target.tagName;
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); bus.emit('run:toggle'); return; }
    if ((tag === 'INPUT' || tag === 'TEXTAREA') && !(e.ctrlKey || e.metaKey)) return;
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') { e.preventDefault(); persist(true); toast('Guardado'); }
  });
}
