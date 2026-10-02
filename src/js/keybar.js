// A barra de símbolos embaixo do editor: os sinais difíceis de digitar no celular e as setas.
// (Os botões importantes, como Executar e Formatar, ficam na barra de ações: veja actionbar.js.)
import { $, toast } from './util.js';
import { code, insert, setFontSize, fontSize } from './editor.js';
import { settings, saveSettings } from './settings.js';
import { indentLines, moveCaret, smartHome, lineEnd } from './commands.js';

export function changeFont(delta) {
  const px = setFontSize(fontSize() + delta);
  settings.font = px;
  saveSettings();
  toast('Tamanho da letra: ' + px);
  return px;
}

const refocus = () => code.focus({ preventScroll: true });

const ACTIONS = {
  tab: () => indentLines(false),
  left: () => { refocus(); moveCaret(-1, 0); },
  right: () => { refocus(); moveCaret(1, 0); },
  up: () => { refocus(); moveCaret(0, -1); },
  down: () => { refocus(); moveCaret(0, 1); },
  home: () => { refocus(); smartHome(); },
  end: () => { refocus(); lineEnd(); },
};
const REPEAT = new Set(['left', 'right', 'up', 'down']);

function press(b) {
  const a = code.selectionStart, z = code.selectionEnd;
  if (b.dataset.ins) insert(b.dataset.ins);
  else if (b.dataset.pair) {
    const inner = code.value.slice(a, z);
    insert(b.dataset.pair[0] + inner + b.dataset.pair[1], 1, 1 + inner.length);
  } else if (b.dataset.snip) {
    const at = b.dataset.snip.indexOf('|');
    insert(b.dataset.snip.replace('|', ''), at);
  } else if (b.dataset.act && ACTIONS[b.dataset.act]) ACTIONS[b.dataset.act]();
}

export function initKeybar() {
  const keys = $('keys');
  let delay = 0, timer = 0, handled = false;
  const stopRepeat = () => { clearTimeout(delay); clearInterval(timer); };

  // Tocar numa tecla não pode tirar o foco do editor (senão o teclado do celular fecha).
  keys.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    e.preventDefault();
    // As setas repetem enquanto o dedo está em cima: dá para andar longe sem tocar mil vezes.
    if (REPEAT.has(b.dataset.act)) {
      handled = true;
      press(b);
      stopRepeat();
      delay = setTimeout(() => { timer = setInterval(() => press(b), 55); }, 380);
    }
  });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) keys.addEventListener(type, () => { stopRepeat(); setTimeout(() => { handled = false; }, 60); });
  keys.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (handled && REPEAT.has(b.dataset.act)) { handled = false; return; }
    press(b);
  });
}
