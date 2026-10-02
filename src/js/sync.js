// Sincronizar os programas entre aparelhos usando o GitHub.
//
// Como funciona: o app guarda tudo num "gist" secreto da sua conta (um arquivo pocket.json). Para isso precisa de um
// token do GitHub só com a permissão "gist" (o token não dá acesso a nenhum repositório). O token fica só neste
// aparelho e só é enviado para api.github.com.
//
// Regra de troca: programa por programa, o que foi mexido por último vence.
import { toast, bus, debounce, local } from './util.js';
import { allProjects, mergeProjects, state } from './projects.js';
import { loadFs, saveFs } from './fsstore.js';

const KEY = 'pocket.sync';
const DESCRIPTION = 'C# Pocket (backup dos programas)';
const FILE = 'pocket.json';
const MAX_FS_BYTES = 800_000;

export const syncState = { status: 'off', message: '', last: 0 };      // off | idle | working | error
let cfg = local.getJson(KEY, null);                                    // { token, gistId, user }
let busy = false, again = false;

const apiBase = () => window.__POCKET_API__ || 'https://api.github.com';
export const isConnected = () => !!(cfg && cfg.token && cfg.gistId);
export const syncUser = () => (cfg && cfg.user) || '';

async function api(method, path, body) {
  const res = await fetch(apiBase() + path, {
    method,
    headers: { authorization: 'Bearer ' + cfg.token, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) throw Object.assign(new Error('O token do GitHub foi recusado. Gere outro e conecte de novo.'), { fatal: true });
  if (res.status === 403 || res.status === 429) throw new Error('O GitHub pediu para esperar um pouco. Tente de novo em alguns minutos.');
  if (!res.ok) throw new Error('O GitHub respondeu com erro ' + res.status + '.');
  return res.status === 204 ? null : res.json();
}

function setState(status, message = '') {
  syncState.status = status;
  syncState.message = message;
  bus.emit('sync:state');
}

// ---------------------------------------------------------------- conectar
export async function connect(token) {
  token = String(token || '').trim();
  if (!token) throw new Error('Cole o token do GitHub.');
  cfg = { token, gistId: '', user: '' };
  try {
    const me = await api('GET', '/user');
    cfg.user = me.login;
    // Procura o gist de uma conexão anterior (outro aparelho) antes de criar um novo.
    for (let page = 1; page <= 3 && !cfg.gistId; page++) {
      const list = await api('GET', '/gists?per_page=100&page=' + page);
      if (!Array.isArray(list) || !list.length) break;
      const found = list.find((g) => g.description === DESCRIPTION && g.files && g.files[FILE]);
      if (found) cfg.gistId = found.id;
    }
    if (!cfg.gistId) {
      const made = await api('POST', '/gists', { description: DESCRIPTION, public: false, files: { [FILE]: { content: JSON.stringify(snapshot([], {})) } } });
      cfg.gistId = made.id;
    }
  } catch (e) {
    cfg = null;
    throw e;
  }
  local.setJson(KEY, cfg);
  setState('idle', 'Conectado como ' + cfg.user);
  await syncNow();
}

export function disconnect() {
  cfg = null;
  local.remove(KEY);
  setState('off', '');
}

// ---------------------------------------------------------------- trocar dados
function snapshot(projects, fs) {
  return { app: 'csharp-pocket', version: 1, saved: Date.now(), projects, fs };
}

async function readRemote() {
  const gist = await api('GET', '/gists/' + cfg.gistId);
  const file = gist.files && gist.files[FILE];
  if (!file) return null;
  let content = file.content;
  if (file.truncated && file.raw_url) content = await (await fetch(file.raw_url)).text();
  try { return JSON.parse(content); } catch (e) { return null; }
}

export async function syncNow() {
  if (!isConnected()) return;
  if (busy) { again = true; return; }
  busy = true;
  setState('working', 'Sincronizando…');
  try {
    do {
      again = false;
      const remote = await readRemote();
      const result = mergeProjects((remote && remote.projects) || []);
      // Arquivos gravados pelos programas que vieram de fora.
      for (const id of result.ids) {
        const files = remote && remote.fs && remote.fs[id];
        if (files && Object.keys(files).length) await saveFs(id, files);
      }
      // O que aqui está mais novo (ou não existe lá) sobe.
      const pushNeeded = result.newer.length > 0 || !remote;
      if (pushNeeded) {
        const projects = JSON.parse(JSON.stringify(allProjects()));
        const fs = {};
        let bytes = 0;
        for (const p of projects) {
          if (p.deleted) continue;
          const files = await loadFs(p.id);
          const size = Object.values(files).reduce((n, b64) => n + b64.length, 0);
          if (size && bytes + size <= MAX_FS_BYTES) { fs[p.id] = files; bytes += size; }
        }
        await api('PATCH', '/gists/' + cfg.gistId, { files: { [FILE]: { content: JSON.stringify(snapshot(projects, fs)) } } });
      }
      syncState.last = Date.now();
    } while (again);
    setState('idle', 'Em dia');
  } catch (e) {
    setState('error', e && e.message ? e.message : 'Não foi possível sincronizar.');
    if (e && e.fatal) { cfg = null; local.remove(KEY); }
  } finally {
    busy = false;
  }
}

export function initSync() {
  setState(isConnected() ? 'idle' : 'off', isConnected() ? 'Conectado como ' + cfg.user : '');
  // Os ouvintes ficam sempre ligados: conectar acontece depois, nos Ajustes.
  const soon = debounce(() => { if (isConnected() && navigator.onLine !== false) syncNow(); }, 4000);
  bus.on('projects:changed', soon);
  window.addEventListener('online', () => syncNow());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
  // Ao abrir, depois que o app terminou de aparecer.
  setTimeout(() => { if (isConnected() && navigator.onLine !== false) syncNow(); }, 1500);
}

export const syncedAgo = () => syncState.last;
export { state };
