// Tira fotos da tela em vários aparelhos para conferir o visual: node tests/shots.mjs
import fs from 'node:fs';
import path from 'node:path';
import { startServer, startBrowser, open, ready, runCode, root } from './lib.mjs';

const out = path.join(root, 'tests', 'shots');
fs.mkdirSync(out, { recursive: true });
const server = await startServer();
const browser = await startBrowser();
const devices = {
  iphone: { locale: 'pt-BR', viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true, colorScheme: 'dark', deviceScaleFactor: 2 },
  'iphone-claro': { locale: 'pt-BR', viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true, colorScheme: 'light', deviceScaleFactor: 2 },
  'ipad-retrato': { locale: 'pt-BR', viewport: { width: 820, height: 1100 }, hasTouch: true, colorScheme: 'dark' },
  'ipad-paisagem': { locale: 'pt-BR', viewport: { width: 1180, height: 780 }, hasTouch: true, colorScheme: 'dark' },
  'iphone-paisagem': { locale: 'pt-BR', viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, colorScheme: 'dark' },
  desktop: { locale: 'pt-BR', viewport: { width: 1366, height: 800 }, colorScheme: 'dark' },
};
const only = process.argv.slice(2);
try {
  for (const [name, options] of Object.entries(devices)) {
    if (only.length && !only.includes(name)) continue;
    const { context, page } = await open(browser, server.url, options);
    await ready(page);
    await page.screenshot({ path: path.join(out, name + '-codigo.png') });
    await page.click('#run');
    await page.waitForFunction(() => document.getElementById('status').dataset.state === 'busy' || document.getElementById('run').dataset.mode === 'run');
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(out, name + '-terminal.png') });
    if (page.errors.length) console.log(name, page.errors);
    await context.close();
    console.log('ok', name);
  }
} finally {
  await browser.close();
  await server.close();
}
