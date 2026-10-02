// Fotos da barra de ações em vários aparelhos, com e sem teclado (o teclado é simulado encolhendo a altura): node tests/shots-barra.mjs
import fs from 'node:fs';
import path from 'node:path';
import { startServer, startBrowser, open, ready, setCode, root } from './lib.mjs';

const out = path.join(root, 'tests', 'shots');
fs.mkdirSync(out, { recursive: true });
const server = await startServer();
const browser = await startBrowser();
const base = { locale: 'pt-BR', hasTouch: true, colorScheme: 'dark', deviceScaleFactor: 2 };
const cases = [
  ['iphone', { ...base, isMobile: true, viewport: { width: 390, height: 780 } }, 470],
  ['iphone-claro', { ...base, isMobile: true, colorScheme: 'light', viewport: { width: 390, height: 780 } }, 470],
  ['ipad-retrato', { ...base, viewport: { width: 820, height: 1100 } }, 760],
  ['ipad-paisagem', { ...base, viewport: { width: 1180, height: 780 } }, 440],
];
try {
  for (const [name, options, typingHeight] of cases) {
    const { context, page } = await open(browser, server.url, options);
    await ready(page);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, 'barra-' + name + '-sem-teclado.png') });
    await page.setViewportSize({ width: options.viewport.width, height: typingHeight });
    await page.click('#code');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(out, 'barra-' + name + '-teclado.png') });
    console.log('ok', name, page.errors.length ? page.errors : '');
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}
