// A barra de teclas embaixo do editor: executar, símbolos difíceis de digitar no celular, setas e atalhos.
import { $, bus, toast } from './util.js';
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
  undo: () => { refocus(); try { document.execCommand('undo'); } catch (err) { /* não disponível aqui */ } },
  redo: () => { refocus(); try { document.execCommand('redo'); } catch (err) { /* não disponível aqui */ } },
};

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
    } else if (b.dataset.act && ACTIONS[b.dataset.act]) ACTIONS[b.dataset.act]();
  });
  $('keyRun').addEventListener('click', () => bus.emit('run:toggle'));
  $('fontDown').addEventListener('click', () => changeFont(-1));
  $('fontUp').addEventListener('click', () => changeFont(1));
  bus.on('run:state', (running) => {
    $('keyRun').textContent = running ? '■' : '▶';
    $('keyRun').setAttribute('aria-label', running ? 'Parar o programa' : 'Executar o programa');
    $('keyRun').classList.toggle('stop', running);
  });
}
