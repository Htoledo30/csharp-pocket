// Pequenas ferramentas usadas pelo app inteiro.

export const $ = (id) => document.getElementById(id);
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
export const narrow = () => window.matchMedia('(max-width: 699px)').matches;

// Armazenamento do aparelho. Pode estar bloqueado (aba anônima, dados limpos): nunca deixa o app cair.
export const local = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : raw;
    } catch (e) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); return true; } catch (e) { return false; }
  },
  remove(key) { try { localStorage.removeItem(key); } catch (e) { /* sem armazenamento: nada a fazer */ } },
  getJson(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  },
  setJson(key, value) { return local.set(key, JSON.stringify(value)); },
};

export function debounce(fn, ms) {
  let timer = 0;
  const run = (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
  run.cancel = () => clearTimeout(timer);
  run.flush = (...args) => { clearTimeout(timer); fn(...args); };
  return run;
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Aviso rápido embaixo da tela. `action` = { label, run } acrescenta um botão (ex.: "Atualizar").
let toastTimer = 0, toastEl = null;
export function toast(text, action) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    toastEl.setAttribute('role', 'status');
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = text;
  if (action) {
    const b = document.createElement('button');
    b.textContent = action.label;
    b.addEventListener('click', () => { toastEl.hidden = true; action.run(); });
    toastEl.append(b);
  }
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, action ? 9000 : 1800);
}

export function vibrate(ms = 8) {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* sem vibração: tudo bem */ }
}

// Mensageiro simples entre os módulos, para eles não dependerem uns dos outros.
const listeners = new Map();
export const bus = {
  on(name, fn) {
    if (!listeners.has(name)) listeners.set(name, new Set());
    listeners.get(name).add(fn);
    return () => listeners.get(name).delete(fn);
  },
  emit(name, ...args) {
    const set = listeners.get(name);
    if (set) for (const fn of Array.from(set)) fn(...args);
  },
};
