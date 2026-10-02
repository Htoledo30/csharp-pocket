// Service worker do C# Pocket.
//  1. Guarda o app no aparelho: depois da primeira abertura ele funciona sem internet.
//  2. Manda os cabeçalhos COOP/COEP em todas as respostas. Com isso a página fica "isolada" e o navegador
//     libera o SharedArrayBuffer, que o console real (ReadKey sem reexecutar o programa) precisa.
//
// As partes entre /* __ */ são trocadas por tools/build.mjs na hora de publicar.
const VERSION = '__VERSION__';
const RUNTIME = '__RUNTIME__';
const SHELL = /*__SHELL__*/[];

const SHELL_CACHE = 'pocket-shell-' + VERSION;
const RUNTIME_CACHE = 'pocket-runtime-' + RUNTIME;
const ROOT = new URL('./', self.location).href;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // 'reload' ignora o cache HTTP do navegador: o app guardado tem que ser exatamente esta versão.
    await Promise.all(SHELL.map(async (path) => {
      const response = await fetch(new Request(new URL(path, ROOT), { cache: 'reload' }));
      if (!response.ok) throw new Error('falha ao guardar ' + path);
      await cache.put(new URL(path, ROOT), response);
    }));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('pocket-') && key !== SHELL_CACHE && key !== RUNTIME_CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const type = event.data && event.data.type;
  if (type === 'skip-waiting') self.skipWaiting();
  else if (type === 'claim') self.clients.claim();
  else if (type === 'version' && event.source) event.source.postMessage({ type: 'version', version: VERSION, runtime: RUNTIME });
});

// Respostas com os cabeçalhos de isolamento.
function isolate(response) {
  if (!response || response.status === 0 || response.type === 'opaque' || response.type === 'opaqueredirect') return response;
  const headers = new Headers(response.headers);
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

const isRuntimeFile = (url) => url.pathname.includes('/framework/') && !url.pathname.endsWith('/Pocket.dll');

async function handle(request) {
  const url = new URL(request.url);
  // Navegação: sempre a página inicial guardada (o app é uma página só).
  const lookup = request.mode === 'navigate' ? new URL('index.html', ROOT).href : request;
  const response = await caches.match(lookup, { ignoreSearch: true });
  if (response) return isolate(response);
  try {
    const fresh = await fetch(request);
    if (fresh.ok && fresh.status === 200) {
      const cache = await caches.open(isRuntimeFile(url) ? RUNTIME_CACHE : SHELL_CACHE);
      cache.put(request, fresh.clone()).catch(() => {});
    }
    return isolate(fresh);
  } catch (error) {
    if (request.mode === 'navigate') {
      const home = await caches.match(new URL('index.html', ROOT).href);
      if (home) return isolate(home);
    }
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.href.startsWith(ROOT)) return;
  event.respondWith(handle(request));
});
