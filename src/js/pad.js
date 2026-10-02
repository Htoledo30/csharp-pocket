// As teclas na tela do terminal (para ReadKey e jogos) e o modo jogo: terminal em tela cheia.
// Quais teclas aparecem é escolhido nos Ajustes.
import { $, bus } from './util.js';
import { settings, saveSettings } from './settings.js';

export const PAD_GROUPS = [
  ['arrows', 'Setas', [['ArrowLeft', '←', 'Seta para a esquerda'], ['ArrowUp', '↑', 'Seta para cima'], ['ArrowDown', '↓', 'Seta para baixo'], ['ArrowRight', '→', 'Seta para a direita']]],
  ['enter', 'Enter', [['Enter', 'Enter', 'Enter']]],
  ['space', 'Espaço', [[' ', 'Espaço', 'Espaço']]],
  ['esc', 'Esc', [['Escape', 'Esc', 'Escape']]],
  ['wasd', 'W A S D', [['a', 'A', 'Tecla A'], ['w', 'W', 'Tecla W'], ['s', 'S', 'Tecla S'], ['d', 'D', 'Tecla D']]],
  ['digits', '1 2 3 4', [['1', '1', 'Tecla 1'], ['2', '2', 'Tecla 2'], ['3', '3', 'Tecla 3'], ['4', '4', 'Tecla 4']]],
  ['yn', 'S / N', [['s', 'S', 'Sim (S)'], ['n', 'N', 'Não (N)']]],
];
const DEFAULT = ['arrows', 'enter', 'space', 'esc'];

export const activeGroups = () => (Array.isArray(settings.pad) ? settings.pad : DEFAULT);

export function drawPad() {
  const holder = $('padKeys');
  holder.textContent = '';
  const on = new Set(activeGroups());
  for (const [id, , keys] of PAD_GROUPS) {
    if (!on.has(id)) continue;
    for (const [key, label, aria] of keys) {
      const b = document.createElement('button');
      b.dataset.key = key;
      b.textContent = label;
      b.setAttribute('aria-label', aria);
      holder.append(b);
    }
  }
}

export function setPadGroup(id, enabled) {
  const on = new Set(activeGroups());
  if (enabled) on.add(id); else on.delete(id);
  settings.pad = PAD_GROUPS.map(([g]) => g).filter((g) => on.has(g));
  saveSettings();
  drawPad();
}

// ---------------------------------------------------------------- modo jogo
export const inGame = () => $('app').classList.contains('game');

export function setGameMode(on) {
  $('app').classList.toggle('game', on);
  $('gameMode').setAttribute('aria-pressed', String(on));
  $('gameMode').textContent = on ? 'Sair' : 'Tela cheia';
  $('termRun').hidden = !on;
  bus.emit('game:mode', on);
  if (on) { $('termScroll').scrollTop = $('termScroll').scrollHeight; }
}

export function initPad() {
  drawPad();
  $('termRun').addEventListener('click', () => bus.emit('run:toggle'));
  bus.on('run:state', (running) => { $('termRun').textContent = running ? '■ Parar' : '▶ Executar'; });
  $('gameMode').addEventListener('click', () => setGameMode(!inGame()));
  // Ao abrir outro programa ou mexer no código, o modo jogo sai sozinho.
  bus.on('project:before-open', () => { if (inGame()) setGameMode(false); });
}
