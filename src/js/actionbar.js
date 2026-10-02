// A barra de ações: os botões importantes, sempre à vista logo acima das teclas de símbolos.
// Cada botão tem ícone e nome, e é grande o bastante para tocar. Nos Ajustes dá para escolher quais aparecem.
import { $, bus } from './util.js';
import { code } from './editor.js';
import { settings, saveSettings } from './settings.js';
import { formatCode, copyCode } from './editing.js';
import { openFind } from './find.js';
import { openCola } from './cola.js';
import { duplicateLines, toggleComment, gotoLine } from './commands.js';
import { openMore } from './more.js';

const S = (d) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>';
const ICON = {
  play: S('<path d="M7 5l12 7-12 7z" fill="currentColor" stroke="none"/>'),
  stop: S('<rect x="6" y="6" width="12" height="12" rx="1.6" fill="currentColor" stroke="none"/>'),
  format: S('<path d="M3 6h18M7 10.5h14M7 15h14M3 19.5h18"/>'),
  undo: S('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
  redo: S('<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>'),
  find: S('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>'),
  keyboard: S('<path d="M6 9l6 6 6-6"/><path d="M4 20h16"/>'),
  cola: S('<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M9 9h6M9 13h6"/>'),
  copy: S('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>'),
  dup: S('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/><path d="M14 11v6M11 14h6"/>'),
  comment: S('<path d="M9 19L15 5"/>'),
  goto: S('<path d="M8 4L6 20M18 4l-2 16M4 9h17M3 15h17"/>'),
  more: S('<circle cx="5" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.7" fill="currentColor" stroke="none"/>'),
};

// id -> { label, icon, run, hint }. "run" e "more" sempre aparecem.
const ACTIONS = {
  run: { label: 'Executar', icon: 'play', run: () => bus.emit('run:toggle'), id: 'keyRun', hint: 'Executar o programa (Ctrl+Enter)' },
  format: { label: 'Formatar', icon: 'format', run: () => formatCode(), id: 'format', strong: true, hint: 'Arrumar o recuo do código' },
  undo: { label: 'Desfazer', icon: 'undo', run: () => { code.focus({ preventScroll: true }); try { document.execCommand('undo'); } catch (e) { /* não disponível */ } } },
  redo: { label: 'Refazer', icon: 'redo', run: () => { code.focus({ preventScroll: true }); try { document.execCommand('redo'); } catch (e) { /* não disponível */ } } },
  keyboard: { label: 'Teclado', icon: 'keyboard', run: () => code.blur(), hint: 'Esconder o teclado' },
  find: { label: 'Buscar', icon: 'find', run: () => openFind() },
  cola: { label: 'Cola', icon: 'cola', run: () => openCola(), id: 'cola', hint: 'Modelos prontos de código' },
  copy: { label: 'Copiar', icon: 'copy', run: () => copyCode(), id: 'copy' },
  dup: { label: 'Duplicar', icon: 'dup', run: () => duplicateLines(), hint: 'Duplicar a linha' },
  comment: { label: 'Comentar', icon: 'comment', run: () => toggleComment(), hint: 'Comentar ou descomentar a linha' },
  goto: { label: 'Ir p/ linha', icon: 'goto', run: () => gotoLine() },
  more: { label: 'Mais', icon: 'more', run: () => openMore(), id: 'more', hint: 'Todos os comandos' },
};

export const ACTION_IDS = Object.keys(ACTIONS).filter((id) => id !== 'run' && id !== 'more');
export const actionLabel = (id) => ACTIONS[id].label;
const DEFAULT_PHONE = ['format', 'undo', 'redo', 'keyboard'];
const DEFAULT_WIDE = ['format', 'undo', 'redo', 'find', 'cola'];

export function chosenActions() {
  const base = Array.isArray(settings.actions) ? settings.actions : (window.matchMedia('(max-width: 699px)').matches ? DEFAULT_PHONE : DEFAULT_WIDE);
  return ['run', ...base.filter((id) => ACTIONS[id] && id !== 'run' && id !== 'more'), 'more'];
}

let running = false;

function button(id) {
  const a = ACTIONS[id];
  const b = document.createElement('button');
  b.className = 'act-btn' + (id === 'run' ? ' primary' : '') + (a.strong ? ' strong' : '');
  b.dataset.action = id;
  if (a.id) b.id = a.id;
  b.type = 'button';
  b.title = a.hint || a.label;
  b.setAttribute('aria-label', a.hint || a.label);
  b.innerHTML = ICON[a.icon] + '<span>' + a.label + '</span>';
  return b;
}

export function drawActions() {
  const bar = $('actions');
  bar.textContent = '';
  for (const id of chosenActions()) bar.append(button(id));
  paintRun();
}

function paintRun() {
  const b = $('actions').querySelector('[data-action="run"]');
  if (!b) return;
  b.classList.toggle('stop', running);
  b.querySelector('svg').outerHTML = running ? ICON.stop : ICON.play;
  b.querySelector('span').textContent = running ? 'Parar' : 'Executar';
  b.setAttribute('aria-label', running ? 'Parar o programa' : 'Executar o programa (Ctrl+Enter)');
}

export function setChosenActions(ids) {
  settings.actions = ids.filter((id) => ACTIONS[id] && id !== 'run' && id !== 'more');
  saveSettings();
  drawActions();
}

export function initActionBar() {
  const bar = $('actions');
  // Tocar num botão não pode tirar o foco do editor (senão o teclado do celular fecha).
  bar.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b && ACTIONS[b.dataset.action]) ACTIONS[b.dataset.action].run();
  });
  bus.on('run:state', (state) => { running = state; paintRun(); });
  drawActions();
}
