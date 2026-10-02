// Atualização do app instalado: sai uma versão nova, o app avisa, atualiza e descarta a versão antiga.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer, startBrowser, ready, check, root } from './lib.mjs';

const source = path.join(root, 'dist');
if (!fs.existsSync(path.join(source, 'sw.js'))) { console.error('dist/ não existe: rode "node tools/build.mjs dist" primeiro'); process.exit(1); }
const site = fs.mkdtempSync(path.join(os.tmpdir(), 'pocket-update-'));
fs.cpSync(source, site, { recursive: true });

const server = await startServer({ folder: site });
const browser = await startBrowser();
try {
  const context = await browser.newContext({ locale: 'pt-BR', viewport: { width: 1000, height: 700 } });
  const page = await context.newPage();
  await page.goto(server.url + '?sw');
  await ready(page);
  const oldCaches = await page.evaluate(async () => (await caches.keys()).filter((k) => k.startsWith('pocket-shell')));
  check('versão 1 instalada', oldCaches.length === 1, oldCaches.join());

  // "publica" uma versão nova: o service worker muda de versão e a página ganha uma marca
  const swPath = path.join(site, 'sw.js');
  fs.writeFileSync(swPath, fs.readFileSync(swPath, 'utf8').replace(/const VERSION = '[^']*'/, "const VERSION = 'versao-nova'"));
  const htmlPath = path.join(site, 'index.html');
  fs.writeFileSync(htmlPath, fs.readFileSync(htmlPath, 'utf8').replace('<title>C# Pocket</title>', '<title>C# Pocket</title><meta name="marca" content="nova">'));
  await page.evaluate(async () => { const reg = await navigator.serviceWorker.getRegistration(); await reg.update(); });

  await page.waitForFunction(() => Array.from(document.querySelectorAll('.toast button')).some((b) => b.textContent === 'Atualizar'), null, { timeout: 20000 });
  check('o app avisa que há versão nova', true);
  check('a página ainda é a versão antiga até atualizar', (await page.locator('meta[name=marca]').count()) === 0);

  await Promise.all([page.waitForNavigation({ timeout: 20000 }).catch(() => {}), page.click('.toast button')]);
  await ready(page);
  check('depois de atualizar a página é a nova', (await page.locator('meta[name=marca]').count()) === 1);
  const caches = await page.evaluate(async () => (await caches.keys()).filter((k) => k.startsWith('pocket-shell')));
  check('a versão antiga foi descartada', caches.length === 1 && caches[0] === 'pocket-shell-versao-nova', caches.join());
  check('o .NET não foi baixado de novo (cache do runtime mantido)', (await page.evaluate(async () => (await caches.keys()).filter((k) => k.startsWith('pocket-runtime')).length)) === 1);
  await context.close();
} finally {
  await browser.close();
  await server.close();
  fs.rmSync(site, { recursive: true, force: true });
}
