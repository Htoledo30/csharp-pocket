// O app instalável: service worker, isolamento (SharedArrayBuffer), funcionamento sem internet.
// Roda sobre o dist/ (node tools/build.mjs dist antes), porque o service worker só existe no site montado.
import fs from 'node:fs';
import path from 'node:path';
import { startServer, startBrowser, ready, runCode, screen, check, root } from './lib.mjs';

if (!fs.existsSync(path.join(root, 'dist', 'sw.js'))) { console.error('dist/ não existe: rode "node tools/build.mjs dist" primeiro'); process.exit(1); }
const server = await startServer({ folder: 'dist' });
const browser = await startBrowser();
try {
  const context = await browser.newContext({ locale: 'pt-BR', viewport: { width: 1100, height: 760 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 160)); });

  // 1ª abertura: instala o service worker e recarrega sozinho
  await page.goto(server.url + '?sw');
  await ready(page);
  check('service worker controla a página', await page.evaluate(() => !!navigator.serviceWorker.controller));
  check('página isolada (crossOriginIsolated)', await page.evaluate(() => window.crossOriginIsolated === true));
  check('SharedArrayBuffer disponível', await page.evaluate(() => typeof SharedArrayBuffer === 'function'));

  const manifest = await page.evaluate(async () => (await fetch('manifest.webmanifest')).json());
  check('manifesto: tela cheia (standalone)', manifest.display === 'standalone');
  const iconsOk = await page.evaluate(async (icons) => (await Promise.all(icons.map(async (i) => (await fetch(i.src)).ok))).every(Boolean), manifest.icons);
  check('manifesto: ícones existem', iconsOk);

  // roda um programa para o .NET ficar todo guardado
  const first = await runCode(page, 'Console.WriteLine("online");\n');
  check('roda com internet', first.screen.includes('online'));

  check('o modo ao vivo está ativo (console real)', (await page.getAttribute('#app', 'data-live')) === '1');

  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    let count = 0;
    for (const n of names) count += (await (await caches.open(n)).keys()).length;
    return { names, count };
  });
  console.log('   caches:', cached.names.join(', '), '·', cached.count, 'arquivos');
  check('o .NET ficou guardado no aparelho', cached.count > 80, String(cached.count));

  // sem internet: o servidor é desligado (no site publicado, usa o modo offline do navegador)
  if (process.env.POCKET_URL) await context.setOffline(true); else await server.close();
  await page.reload();
  await ready(page, 60000);
  check('abre sem internet', true);
  const offline = await runCode(page, 'Console.WriteLine($"offline {2 + 3}");\n');
  check('roda sem internet', offline.screen.includes('offline 5'), JSON.stringify(offline));

  check('sem erros no console', errors.length === 0, errors.join(' | '));
  await context.close();
} finally {
  await browser.close();
  await server.close();
}
