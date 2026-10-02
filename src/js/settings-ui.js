// A janela de Ajustes: aparência, este aparelho (instalação, sem internet, console ao vivo), seus dados e versão.
import { $, bus, toast, local } from './util.js';
import { setFontSize, fontSize } from './editor.js';
import { settings, saveSettings, applyTheme } from './settings.js';
import { engineState } from './status.js';
import { liveSupported } from './engine.js';
import { isStandalone, installHint, offlineSupported, canPromptInstall, promptInstall } from './pwa.js';
import { state as projectState, liveProjects } from './projects.js';
import { listFs } from './fsstore.js';
import { confirmDialog } from './dialog.js';
import { PAD_GROUPS, activeGroups, setPadGroup } from './pad.js';

const sections = [];       // outros módulos (exportar, sincronizar) acrescentam as suas: (body) => void
export const addSettingsSection = (fn) => sections.push(fn);

function row(label, control) {
  const r = document.createElement('div');
  r.className = 'set-row';
  const l = document.createElement('span');
  l.textContent = label;
  r.append(l, control);
  return r;
}

function segmented(options, value, onPick) {
  const wrap = document.createElement('div');
  wrap.className = 'seg';
  for (const [id, label] of options) {
    const b = document.createElement('button');
    b.textContent = label;
    b.setAttribute('aria-pressed', String(id === value));
    b.addEventListener('click', () => {
      for (const x of wrap.children) x.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-pressed', 'true');
      onPick(id);
    });
    wrap.append(b);
  }
  return wrap;
}

const note = (text) => { const p = document.createElement('p'); p.className = 'set-note'; p.textContent = text; return p; };
const heading = (text) => { const h = document.createElement('h3'); h.textContent = text; return h; };

async function cachedFileCount() {
  try {
    const names = await caches.keys();
    let n = 0;
    for (const name of names) if (name.startsWith('pocket-')) n += (await (await caches.open(name)).keys()).length;
    return n;
  } catch (e) { return 0; }
}

let version = null;
async function loadVersion() {
  if (version) return version;
  try { version = await (await fetch('version.json', { cache: 'no-store' })).json(); } catch (e) { version = {}; }
  return version;
}

export async function openSettings() {
  const body = $('settingsBody');
  body.textContent = '';
  $('settingsBack').hidden = false;
  $('settingsClose').focus();

  body.append(heading('Aparência'));
  body.append(row('Tema', segmented([['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']], settings.theme, (id) => { settings.theme = id; saveSettings(); applyTheme(); })));
  const size = document.createElement('div');
  size.className = 'stepper-num';
  const minus = document.createElement('button'); minus.className = 'mini'; minus.textContent = 'A−';
  const plus = document.createElement('button'); plus.className = 'mini'; plus.textContent = 'A+';
  const value = document.createElement('b'); value.textContent = Math.round(fontSize()) + ' px';
  const change = (d) => { const px = setFontSize(fontSize() + d); settings.font = px; saveSettings(); value.textContent = px + ' px'; };
  minus.addEventListener('click', () => change(-1));
  plus.addEventListener('click', () => change(1));
  size.append(minus, value, plus);
  body.append(row('Tamanho da letra', size));

  // Botões importantes sempre à vista (a barra logo acima das teclas de símbolos).
  const bar = await import('./actionbar.js');
  body.append(heading('Barra de ações'));
  body.append(note('Os botões que ficam sempre à vista acima do teclado. Escolha os que você mais usa (Executar e Mais sempre aparecem).'));
  const barWrap = document.createElement('div');
  barWrap.className = 'ex-list';
  const chosen = new Set(bar.chosenActions());
  for (const id of bar.ACTION_IDS) {
    const b = document.createElement('button');
    b.className = 'mini';
    b.textContent = bar.actionLabel(id);
    b.setAttribute('aria-pressed', String(chosen.has(id)));
    b.addEventListener('click', () => {
      const now = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(now));
      bar.setChosenActions(bar.ACTION_IDS.filter((x) => (x === id ? now : barWrap.querySelector('[data-id="' + x + '"]').getAttribute('aria-pressed') === 'true')));
    });
    b.dataset.id = id;
    barWrap.append(b);
  }
  body.append(barWrap);
  const auto = document.createElement('button');
  auto.className = 'mini';
  auto.setAttribute('aria-pressed', String(!!settings.formatOnRun));
  auto.textContent = 'Formatar sozinho ao executar';
  auto.addEventListener('click', () => { settings.formatOnRun = !settings.formatOnRun; auto.setAttribute('aria-pressed', String(settings.formatOnRun)); saveSettings(); });
  body.append(auto);

  body.append(heading('Teclas do jogo'));
  body.append(note('Quais teclas aparecem na tela quando o programa espera uma tecla (ReadKey). O toque em "Tela cheia" no terminal esconde o resto para jogar.'));
  const padWrap = document.createElement('div');
  padWrap.className = 'ex-list';
  const on = new Set(activeGroups());
  for (const [id, label] of PAD_GROUPS) {
    const b = document.createElement('button');
    b.className = 'mini';
    b.textContent = label;
    b.setAttribute('aria-pressed', String(on.has(id)));
    b.addEventListener('click', () => { const now = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(now)); setPadGroup(id, now); });
    padWrap.append(b);
  }
  body.append(padWrap);

  body.append(heading('Este aparelho'));
  const live = liveSupported();
  body.append(row('Console ao vivo', Object.assign(document.createElement('b'), { textContent: live ? 'ligado' : 'desligado' })));
  if (!live) body.append(note(window.crossOriginIsolated ? 'O motor ainda está carregando.' : 'Sem ele, o programa roda de novo desde o começo a cada resposta e jogos em tempo real não funcionam. Ele liga sozinho quando o app está instalado e é aberto pelo ícone.'));
  const offline = offlineSupported();
  const count = await cachedFileCount();
  body.append(row('Funciona sem internet', Object.assign(document.createElement('b'), { textContent: offline && count > 80 ? 'sim' : offline ? 'quase (abra um programa e execute uma vez)' : 'não' })));
  body.append(row('Tela cheia', Object.assign(document.createElement('b'), { textContent: isStandalone() ? 'sim, aberto como app' : 'não, aberto no navegador' })));
  const hint = installHint();
  if (hint) body.append(note(hint));
  if (canPromptInstall()) {
    const install = document.createElement('button');
    install.className = 'mini strong';
    install.textContent = 'Instalar o app';
    install.addEventListener('click', async () => { await promptInstall(); install.remove(); });
    body.append(install);
  }
  const v = await loadVersion();
  body.append(row('Versão', Object.assign(document.createElement('b'), { textContent: (v.version ? v.version.slice(0, 7) : 'local') + (engineState.version ? ' · ' + engineState.version : '') })));
  const update = document.createElement('button');
  update.className = 'mini';
  update.textContent = 'Procurar atualização';
  update.addEventListener('click', async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) { toast('Sem service worker aqui (modo de desenvolvimento)'); return; }
      await reg.update();
      toast(reg.waiting || reg.installing ? 'Atualização encontrada' : 'Você já está na versão mais nova');
    } catch (e) { toast('Não foi possível verificar agora'); }
  });
  body.append(update);

  body.append(heading('Seus programas'));
  const filesCount = (await listFs()).length;
  body.append(row('Programas neste aparelho', Object.assign(document.createElement('b'), { textContent: String(liveProjects().length) })));
  if (filesCount) body.append(row('Com arquivos gravados pelo programa', Object.assign(document.createElement('b'), { textContent: String(filesCount) })));
  for (const add of sections) add(body);

  body.append(heading('Cuidado'));
  const wipe = document.createElement('button');
  wipe.className = 'mini danger';
  wipe.textContent = 'Apagar todos os programas e ajustes';
  wipe.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: 'Apagar tudo', text: 'Isso apaga todos os programas, arquivos e ajustes deste aparelho. Não dá para desfazer. Exporte antes se quiser guardar uma cópia.', ok: 'Apagar tudo', danger: true });
    if (!ok) return;
    try { localStorage.clear(); } catch (e) { /* sem armazenamento */ }
    try { indexedDB.deleteDatabase('pocket-files'); indexedDB.deleteDatabase('pocket-history'); } catch (e) { /* sem armazenamento */ }
    location.reload();
  });
  body.append(wipe);
}

export function closeSettings() { $('settingsBack').hidden = true; }

export function initSettingsUi() {
  $('settingsBtn').addEventListener('click', openSettings);
  $('settingsClose').addEventListener('click', closeSettings);
  $('settingsBack').addEventListener('click', (e) => { if (e.target === $('settingsBack')) closeSettings(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('settingsBack').hidden) closeSettings(); });
}
