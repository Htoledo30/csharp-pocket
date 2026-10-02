// A janela "Meus programas": abrir, criar, renomear, apagar e começar por um exemplo.
import { $, bus, toast } from './util.js';
import { setCode, scroller, code } from './editor.js';
import { hideSuggest } from './suggest.js';
import { showTab } from './tabs.js';
import { EXAMPLES, exampleCode } from './examples.js';
import {
  state, liveProjects, projectById, currentProject, activeFile, addProject, renameProject, deleteProject,
  setCurrent, saveCode, load, persist, initProjectsPersistence, STARTER,
} from './projects.js';

let rowMode = null;   // { id, mode: 'rename' | 'delete', open? }
let syncNote = () => 'Seus programas ficam salvos neste aparelho.';
export const setSyncNote = (fn) => { syncNote = fn; };

const ago = (t) => {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'agora';
  if (s < 3600) return 'há ' + Math.floor(s / 60) + ' min';
  if (s < 86400) return 'há ' + Math.floor(s / 3600) + ' h';
  if (s < 172800) return 'ontem';
  const d = new Date(t);
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
};

export function showCurrent() {
  const p = currentProject();
  $('fileName').textContent = p ? p.name : 'Programas';
}

export function openProject(id, quiet) {
  const p = projectById(id);
  if (!p || p.deleted) return;
  bus.emit('project:before-open');
  setCurrent(id);
  setCode(activeFile(p).code);
  showCurrent();
  scroller.scrollTop = 0; scroller.scrollLeft = 0;
  code.setSelectionRange(0, 0);
  hideSuggest();
  bus.emit('project:opened', p);
  if (!quiet) { closeFiles(); showTab('code'); }
}

function renderFiles() {
  const list = $('fileList');
  list.textContent = '';
  for (const p of liveProjects()) {
    const row = document.createElement('div');
    row.className = 'file' + (p.id === state.current ? ' on' : '');
    if (rowMode && rowMode.id === p.id && rowMode.mode === 'rename') {
      const form = document.createElement('form');
      const input = document.createElement('input');
      input.id = 'renameInput'; input.value = p.name; input.maxLength = 40; input.setAttribute('aria-label', 'Nome do programa');
      input.autocomplete = 'off'; input.spellcheck = false;
      const ok = document.createElement('button');
      ok.className = 'mini strong'; ok.type = 'submit'; ok.textContent = 'Salvar';
      form.append(input, ok);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        renameProject(p.id, input.value);
        const openAfter = rowMode && rowMode.open;
        rowMode = null;
        showCurrent();
        if (openAfter) openProject(p.id); else renderFiles();
      });
      row.append(form);
      list.append(row);
      setTimeout(() => { input.focus(); input.select(); }, 0);
      continue;
    }
    if (rowMode && rowMode.id === p.id && rowMode.mode === 'delete') {
      const ask = document.createElement('span');
      ask.className = 'ask-del';
      ask.textContent = 'Apagar "' + p.name + '"?';
      const yes = document.createElement('button');
      yes.className = 'mini danger'; yes.textContent = 'Apagar';
      yes.addEventListener('click', () => removeProject(p.id));
      const no = document.createElement('button');
      no.className = 'mini'; no.textContent = 'Cancelar';
      no.addEventListener('click', () => { rowMode = null; renderFiles(); });
      row.append(ask, yes, no);
      list.append(row);
      continue;
    }
    const open = document.createElement('button');
    open.className = 'open';
    const name = document.createElement('b');
    name.textContent = p.name;
    const meta = document.createElement('span');
    const text = p.files.map((f) => f.code).join('\n');
    const lines = text ? text.replace(/\n+$/, '').split('\n').length : 0;
    meta.textContent = (p.id === state.current ? 'aberto · ' : '') + ago(p.updated) + ' · ' + lines + (lines === 1 ? ' linha' : ' linhas');
    open.append(name, meta);
    open.addEventListener('click', () => openProject(p.id));
    const ren = document.createElement('button');
    ren.className = 'mini'; ren.textContent = 'Renomear';
    ren.addEventListener('click', () => { rowMode = { id: p.id, mode: 'rename' }; renderFiles(); });
    const del = document.createElement('button');
    del.className = 'mini'; del.textContent = 'Apagar';
    del.addEventListener('click', () => { rowMode = { id: p.id, mode: 'delete' }; renderFiles(); });
    row.append(open, ren, del);
    list.append(row);
  }
  $('syncNote').textContent = syncNote();
}

function removeProject(id) {
  deleteProject(id);
  rowMode = null;
  if (state.current === id) {
    const next = liveProjects()[0] || addProject('Programa 1', STARTER);
    openProject(next.id, true);
  }
  renderFiles();
}

export function openFiles() { rowMode = null; renderFiles(); $('filesBack').hidden = false; $('filesClose').focus(); }
export function closeFiles() { $('filesBack').hidden = true; }
export const refreshFiles = () => { if (!$('filesBack').hidden) renderFiles(); };

export async function startFromExample(id, title) {
  let text;
  try { text = await exampleCode(id); } catch (e) { toast('Não foi possível abrir o exemplo'); return; }
  const p = addProject(title, text);
  openProject(p.id);
  toast('Exemplo aberto como um programa novo');
}

// Primeira abertura: o que mostrar no editor.
export async function bootProjects() {
  initProjectsPersistence();
  const had = load();
  if (!had || !liveProjects().length) {
    let first = STARTER;
    try { first = await exampleCode('labirinto'); } catch (e) { /* sem rede e sem cache: começa em branco */ }
    addProject('Labirinto', first, true);
  }
  if (!projectById(state.current) || projectById(state.current).deleted) state.current = liveProjects()[0].id;
  persist();
  setCode(activeFile(currentProject()).code);
  showCurrent();
}

export function initProjectsUi() {
  $('files').addEventListener('click', openFiles);
  $('filesClose').addEventListener('click', closeFiles);
  $('filesBack').addEventListener('click', (e) => { if (e.target === $('filesBack')) closeFiles(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('filesBack').hidden) closeFiles(); });
  $('fileNew').addEventListener('click', () => {
    const p = addProject('Programa ' + (liveProjects().length + 1), STARTER);
    rowMode = { id: p.id, mode: 'rename', open: true };
    renderFiles();
  });
  $('exList').textContent = '';
  for (const ex of EXAMPLES) {
    const b = document.createElement('button');
    b.className = 'mini';
    b.dataset.ex = ex.id;
    b.textContent = ex.title;
    $('exList').append(b);
  }
  $('exList').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-ex]');
    if (b) startFromExample(b.dataset.ex, b.textContent.trim());
  });
  bus.on('edit', saveCode);
  bus.on('projects:changed', () => refreshFiles());
}
