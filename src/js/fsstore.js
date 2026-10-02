// Os arquivos que o programa grava (File.WriteAllText...) e que ficam entre uma execução e outra.
// Cada programa tem os seus, guardados no IndexedDB deste aparelho: { "caminho/arquivo.txt": "<base64>" }.
const DB = 'pocket-files', STORE = 'fs';
let dbPromise = null;
const memory = new Map();    // se o IndexedDB não estiver disponível, vale só até fechar o app

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

function request(mode, fn) {
  return open().then((db) => new Promise((resolve) => {
    if (!db) { resolve(undefined); return; }
    try {
      const tx = db.transaction(STORE, mode);
      const result = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(result && 'result' in result ? result.result : undefined);
      tx.onerror = tx.onabort = () => resolve(undefined);
    } catch (e) { resolve(undefined); }
  }));
}

export async function loadFs(projectId) {
  const stored = await request('readonly', (s) => s.get(projectId));
  if (stored && typeof stored === 'object') return stored;
  return memory.get(projectId) || {};
}

export async function saveFs(projectId, files) {
  memory.set(projectId, files);
  await request('readwrite', (s) => (Object.keys(files).length ? s.put(files, projectId) : s.delete(projectId)));
}

export async function clearFs(projectId) {
  memory.delete(projectId);
  await request('readwrite', (s) => s.delete(projectId));
}

export async function listFs() {
  const all = await request('readonly', (s) => s.getAllKeys());
  return Array.isArray(all) ? all : Array.from(memory.keys());
}

// Tamanho aproximado, em bytes, dos arquivos de um programa.
export const fsBytes = (files) => Object.values(files).reduce((n, b64) => n + Math.floor((b64.length * 3) / 4), 0);
