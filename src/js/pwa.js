// App instalável: service worker (funciona sem internet), avisos de atualização e armazenamento seguro.
import { $, toast, local } from './util.js';

const RELOAD_FLAG = 'pocket.sw-reload';

// Primeira abertura: registra o service worker e recarrega uma vez, para a página já nascer sob o controle dele.
// Devolve true se a página vai ser recarregada (então não adianta continuar a iniciar o app).
export async function installFirstTime() {
  if (window.__pocketSw !== 'installing') return false;
  if (sessionStorage.getItem(RELOAD_FLAG)) return false;      // já tentou nesta sessão: seguir sem
  try {
    $('statusText').textContent = 'Instalando o app…';
    const reg = await navigator.serviceWorker.register('sw.js', { scope: './' });
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => {
        const t = setTimeout(resolve, 4000);
        navigator.serviceWorker.addEventListener('controllerchange', () => { clearTimeout(t); resolve(); }, { once: true });
        if (reg.active) reg.active.postMessage({ type: 'claim' });
      });
    }
    if (navigator.serviceWorker.controller) {
      sessionStorage.setItem(RELOAD_FLAG, '1');
      location.reload();
      return true;
    }
  } catch (e) { /* sem service worker: o app funciona do mesmo jeito, só não guarda para usar sem internet */ }
  return false;
}

// Nas próximas aberturas: vigia se saiu uma versão nova.
export async function watchUpdates() {
  if (window.__pocketSw !== 'on' && !navigator.serviceWorker.controller) return;
  try {
    const reg = await navigator.serviceWorker.register('sw.js', { scope: './' });
    const offer = (worker) => toast('Nova versão do C# Pocket pronta.', {
      label: 'Atualizar',
      run: () => { worker.postMessage({ type: 'skip-waiting' }); },
    });
    if (reg.waiting) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => { if (worker.state === 'installed' && navigator.serviceWorker.controller) offer(worker); });
    });
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      location.reload();
    });
    // Conferir por novidades de tempos em tempos (o app pode ficar aberto por dias).
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  } catch (e) { /* offline ou sem suporte */ }
}

// Pede ao navegador para não apagar os programas quando faltar espaço.
export async function keepStorage() {
  try {
    if (navigator.storage && navigator.storage.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch (e) { /* sem permissão: tudo bem */ }
}

export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// Guia de instalação (iPhone/iPad não têm botão de instalar: é pelo menu Compartilhar).
export function installHint() {
  if (isStandalone()) return '';
  if (isIos()) return 'Para usar em tela cheia: toque em Compartilhar (o quadrado com a seta) e depois em "Adicionar à Tela de Início".';
  return 'Para usar em tela cheia: no menu do navegador, escolha "Instalar app" ou "Adicionar à tela inicial".';
}

export const offlineSupported = () => 'serviceWorker' in navigator && !!navigator.serviceWorker.controller;
export const flagSeen = (key) => local.get('pocket.seen.' + key) === '1';
export const setSeen = (key) => local.set('pocket.seen.' + key, '1');

// Android/Chrome: o navegador oferece instalar; guardamos o aviso para um botão nos Ajustes.
let installEvent = null;
export function listenInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; });
  window.addEventListener('appinstalled', () => { installEvent = null; });
}
export const canPromptInstall = () => installEvent !== null;
export async function promptInstall() {
  if (!installEvent) return false;
  installEvent.prompt();
  try { await installEvent.userChoice; } catch (e) { /* sem resposta */ }
  installEvent = null;
  return true;
}

// Quantas vezes o app foi aberto (para não repetir dicas sempre).
export function launchCount() {
  const n = (Number(local.get('pocket.launches', '0')) || 0) + 1;
  local.set('pocket.launches', String(n));
  return n;
}
