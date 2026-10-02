// Histórico de versões de cada programa, guardado no aparelho (IndexedDB). Serve para voltar atrás.
// Uma versão é guardada: ao executar, de tempos em tempos enquanto se edita, ao trocar de programa e quando se pede.
import { bus } from './util.js';
import { currentProject } from './projects.js';

const DB = 'pocket-history', STORE = 'v', KEEP = 50;
let dbPromise = null;
const memory = new Map();

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch (e) { resolve(null); }
  });
  return dbPromise;
}

async function read(id) {
  const db = await open();
  if (!db) return memory.get(id) || [];
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => resolve([]);
    } catch (e) { resolve([]); }
  });
}

async function write(id, list) {
  memory.set(id, list);
  const db = await open();
  if (!db) return;
  await new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(list, id);
      tx.oncomplete = tx.onerror = tx.onabort = () => resolve();
    } catch (e) { resolve(); }
  });
}

const sameFiles = (a, b) => a.length === b.length && a.every((f, i) => f.name === b[i].name && f.code === b[i].code);

// Guarda uma versão do programa. Se nada mudou desde a última, não guarda (a não ser com force).
export async function addVersion(project, label, { force = false } = {}) {
  if (!project || project.deleted) return false;
  const files = project.files.map((f) => ({ name: f.name, code: f.code }));
  const list = await read(project.id);
  if (!force && list.length && sameFiles(list[0].files, files)) return false;
  if (!force && files.every((f) => !f.code.trim() || f.code === '// Escreva seu código aqui\n') && !list.length) return false;
  list.unshift({ t: Date.now(), label, files, active: project.active });
  await write(project.id, list.slice(0, KEEP));
  return true;
}

export const listVersions = (id) => read(id);
export async function clearVersions(id) { await write(id, []); }

let lastAuto = 0;
export function initHistory() {
  bus.on('run:starting', () => addVersion(currentProject(), 'Ao executar'));
  bus.on('project:before-open', () => addVersion(currentProject(), 'Ao trocar de programa'));
  // De tempos em tempos, enquanto o app está aberto.
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    if (Date.now() - lastAuto < 5 * 60 * 1000 - 1000) return;
    lastAuto = Date.now();
    addVersion(currentProject(), 'Automático');
  }, 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') addVersion(currentProject(), 'Ao sair do app'); });
}

