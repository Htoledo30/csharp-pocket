// Ferramentas dos testes: servidor local, navegador e atalhos para mexer na página.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '../tools/serve.mjs';
import { launchChrome, launchWebKit } from '../tools/browser.mjs';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let nextPort = 8300 + Math.floor(Math.random() * 400);
export async function startServer({ folder = 'src', isolated = false } = {}) {
  const port = nextPort++;
  const server = await serve({ root: path.join(root, folder), port, isolated, quiet: true });
  return { url: `http://localhost:${port}/`, close: () => new Promise((r) => server.close(r)) };
}

export async function startBrowser(kind = process.env.BROWSER || 'chrome') {
  return kind === 'webkit' ? launchWebKit() : launchChrome();
}

export const PHONE = { locale: 'pt-BR', viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true, colorScheme: 'dark' };
export const DESKTOP = { locale: 'pt-BR', viewport: { width: 1280, height: 780 } };

export async function open(browser, url, contextOptions = DESKTOP) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) page.errors.push('console: ' + m.text().slice(0, 200)); });
  await page.goto(url);
  return { context, page };
}

export const ready = (page, timeout = 90000) => page.waitForFunction(() => document.getElementById('status').dataset.state === 'ready', null, { timeout });
export const idle = (page, timeout = 90000) => page.waitForFunction(() => document.getElementById('run').dataset.mode === 'run' && document.getElementById('status').dataset.state === 'ready', null, { timeout });
export const setCode = (page, source) => page.evaluate((v) => { const c = document.getElementById('code'); c.value = v; c.dispatchEvent(new Event('input')); }, source);
export const notes = (page) => page.evaluate(() => document.getElementById('notes').innerText);
export const screen = (page) => page.evaluate(() => document.getElementById('screen').innerText);

// Execução simples: coloca o código, aperta Executar e espera acabar. Devolve o que o terminal mostrou.
export async function runCode(page, source) {
  await setCode(page, source);
  await page.click('#run');
  await idle(page);
  return { screen: await screen(page), notes: await notes(page) };
}

export function check(name, ok, detail = '') {
  const line = (ok ? 'ok   ' : 'FALHA') + '  ' + name + (detail && !ok ? '  → ' + detail : '');
  console.log(line);
  if (!ok) process.exitCode = 1;
  return ok;
}
