// Atalhos de teclado (para quem usa o iPad com teclado ou o computador).
import { bus } from './util.js';
import { addKeyHook } from './editor.js';

export function initShortcuts() {
  // No editor, antes das outras regras de tecla.
  addKeyHook((e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === 'Enter' && mod) { e.preventDefault(); bus.emit('run:toggle'); return true; }
    if ((e.key === 'F' || e.key === 'f') && e.shiftKey && e.altKey) { e.preventDefault(); bus.emit('format'); return true; }
    return false;
  });
  // Fora do editor (por exemplo, com o foco no terminal).
  document.addEventListener('keydown', (e) => {
    if (e.target && e.target.id === 'code') return;
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); bus.emit('run:toggle'); }
  });
}
