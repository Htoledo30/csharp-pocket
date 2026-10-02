// Os programas guardados neste aparelho. Cada programa é um projeto com um ou mais arquivos .cs.
//
//   { v: 2, current: 'id', projects: [ { id, name, files: [ { name: 'Program.cs', code } ], active: 0, updated, deleted?, seed? } ] }
//
// Apagar só marca `deleted`: assim a sincronização entre aparelhos sabe que foi apagado de propósito.
import { bus, local, debounce } from './util.js';

const KEY = 'pocket.projects';
const LEGACY_KEY = 'csharp-pocket:files';
export const MAIN_FILE = 'Program.cs';
export const STARTER = '// Escreva seu código aqui\n';

export const state = { current: '', projects: [] };

export const liveProjects = () => state.projects.filter((p) => !p.deleted).sort((a, b) => b.updated - a.updated);
export const projectById = (id) => state.projects.find((p) => p.id === id);
export const currentProject = () => projectById(state.current);
export const newId = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function activeFile(project = currentProject()) {
  if (!project) return null;
  if (!project.files[project.active]) project.active = 0;
  return project.files[project.active];
}

// ---------------------------------------------------------------- guardar e ler
const writeNow = () => { local.setJson(KEY, { v: 2, current: state.current, projects: state.projects }); };
const writeSoon = debounce(writeNow, 300);
export function persist(now = false) { if (now) { writeSoon.cancel(); writeNow(); } else writeSoon(); }

export function load() {
  const saved = local.getJson(KEY);
  if (saved && Array.isArray(saved.projects)) {
    state.projects = saved.projects.map(normalize);
    state.current = saved.current || '';
    return true;
  }
  // Versão antiga (um arquivo por programa), caso exista neste aparelho.
  const old = local.getJson(LEGACY_KEY);
  if (old && Array.isArray(old.files)) {
    state.projects = old.files.map((f) => normalize({ id: f.id, name: f.name, files: [{ name: MAIN_FILE, code: f.code || '' }], updated: f.updated, deleted: f.deleted, seed: f.seed }));
    state.current = old.current || '';
    return true;
  }
  return false;
}

function normalize(p) {
  const files = Array.isArray(p.files) && p.files.length ? p.files.map((f) => ({ name: String(f.name || MAIN_FILE), code: String(f.code || '') })) : [{ name: MAIN_FILE, code: String(p.code || '') }];
  const out = { id: String(p.id || newId()), name: String(p.name || 'Programa'), files, active: Number(p.active) || 0, updated: Number(p.updated) || 0 };
  if (p.deleted) out.deleted = true;
  if (p.seed) out.seed = true;
  return out;
}

export function uniqueName(base) {
  const taken = new Set(liveProjects().map((p) => p.name));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(base + ' ' + n)) return base + ' ' + n;
}

export function addProject(name, code, seed) {
  const p = { id: newId(), name: uniqueName(name), files: [{ name: MAIN_FILE, code }], active: 0, updated: Date.now() };
  if (seed) p.seed = true;
  state.projects.push(p);
  persist();
  bus.emit('projects:changed', p.id);
  return p;
}

// O código do arquivo aberto mudou.
export function saveCode(text) {
  const p = currentProject();
  const f = activeFile(p);
  if (!p || !f || f.code === text) return;
  f.code = text;
  p.updated = Date.now();
  delete p.seed;
  persist();
  bus.emit('projects:changed', p.id);
}

export function renameProject(id, name) {
  const p = projectById(id);
  name = name.trim();
  if (!p || !name || name === p.name) return;
  p.name = name;
  p.updated = Date.now();
  delete p.seed;
  persist();
  bus.emit('projects:changed', p.id);
}

export function deleteProject(id) {
  const p = projectById(id);
  if (!p) return;
  p.deleted = true;
  p.files = [{ name: MAIN_FILE, code: '' }];
  p.updated = Date.now();
  delete p.seed;
  persist();
  bus.emit('projects:changed', p.id);
}

export function setCurrent(id) {
  state.current = id;
  persist();
}

// ---------------------------------------------------------------- arquivos do projeto
// Os arquivos (.cs) do programa aberto: um por classe, por exemplo. O primeiro é o principal.
export const projectFiles = (project = currentProject()) => (project ? project.files.map((f) => ({ name: f.name, code: f.code })) : []);

// "jogador" vira "Jogador.cs"; nomes repetidos ou estranhos são recusados (devolve null).
export function cleanFileName(raw, project = currentProject(), ignoreIndex = -1) {
  let name = String(raw || '').trim().replace(/\s+/g, '');
  if (!name) return null;
  if (!/\.cs$/i.test(name)) name += '.cs';
  if (!/^[A-Za-z_][A-Za-z0-9_.-]*\.cs$/.test(name) || name.length > 40) return null;
  if (project.files.some((f, i) => i !== ignoreIndex && f.name.toLowerCase() === name.toLowerCase())) return null;
  return name;
}

export function setActiveFile(index) {
  const p = currentProject();
  if (!p || !p.files[index]) return false;
  p.active = index;
  persist();
  return true;
}

export function addFile(rawName, code = '') {
  const p = currentProject();
  const name = cleanFileName(rawName, p);
  if (!p || !name) return -1;
  p.files.push({ name, code });
  p.active = p.files.length - 1;
  p.updated = Date.now();
  delete p.seed;
  persist();
  bus.emit('projects:changed', p.id);
  return p.active;
}

export function renameFile(index, rawName) {
  const p = currentProject();
  const name = cleanFileName(rawName, p, index);
  if (!p || !p.files[index] || !name) return false;
  if (p.files[index].name === name) return true;
  p.files[index].name = name;
  p.updated = Date.now();
  persist();
  bus.emit('projects:changed', p.id);
  return true;
}

export function removeFile(index) {
  const p = currentProject();
  if (!p || p.files.length < 2 || !p.files[index]) return false;
  p.files.splice(index, 1);
  p.active = Math.min(p.active, p.files.length - 1);
  p.updated = Date.now();
  persist();
  bus.emit('projects:changed', p.id);
  return true;
}

// Gravar já, antes de o aplicativo ser fechado ou ir para o fundo (o iPhone pode encerrá-lo a qualquer momento).
export function initProjectsPersistence() {
  const flush = () => persist(true);
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
}
