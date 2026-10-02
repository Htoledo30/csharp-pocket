// A barra de teclas embaixo do editor: símbolos difíceis de digitar no celular e atalhos.
import { $, bus } from './util.js';
import { code, insert, reveal } from './editor.js';
import { setFontSize, fontSize } from './editor.js';
import { settings, saveSettings } from './settings.js';
import { toast } from './util.js';

function changeFont(delta) {
  const px = setFontSize(fontSize() + delta);
  settings.font = px;
  saveSettings();
  toast('Tamanho da letra: ' + px);
}

export function initKeybar() {
  const keys = $('keys');
  // Tocar numa tecla não pode tirar o foco do editor (senão o teclado do celular fecha).
  keys.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
  keys.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const a = code.selectionStart, z = code.selectionEnd;
    if (b.dataset.ins) insert(b.dataset.ins);
    else if (b.dataset.pair) {
      const inner = code.value.slice(a, z);
      insert(b.dataset.pair[0] + inner + b.dataset.pair[1], 1, 1 + inner.length);
    } else if (b.dataset.snip) {
      const at = b.dataset.snip.indexOf('|');
      insert(b.dataset.snip.replace('|', ''), at);
    } else if (b.dataset.act === 'tab') insert('    ');
    else if (b.dataset.act === 'left') { code.focus({ preventScroll: true }); code.setSelectionRange(Math.max(0, a - 1), Math.max(0, a - 1)); reveal(); }
    else if (b.dataset.act === 'right') { code.focus({ preventScroll: true }); code.setSelectionRange(z + 1, z + 1); reveal(); }
    else if (b.dataset.act === 'undo') { code.focus({ preventScroll: true }); try { document.execCommand('undo'); } catch (err) { /* não disponível aqui */ } }
  });
  $('fontDown').addEventListener('click', () => changeFont(-1));
  $('fontUp').addEventListener('click', () => changeFont(1));
}
