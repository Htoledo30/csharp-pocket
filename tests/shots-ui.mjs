// Fotos dos estados da interface no celular (busca, menu Mais, ajustes, sugestões, erro): node tests/shots-ui.mjs
import fs from 'node:fs';
import path from 'node:path';
import { startServer, startBrowser, open, ready, setCode, root } from './lib.mjs';

const out = path.join(root, 'tests', 'shots');
fs.mkdirSync(out, { recursive: true });
const server = await startServer();
const browser = await startBrowser();
const phone = { locale: 'pt-BR', viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true, colorScheme: 'dark', deviceScaleFactor: 2 };
try {
  const { context, page } = await open(browser, server.url, phone);
  await ready(page);
  const shot = (name) => page.screenshot({ path: path.join(out, 'ui-' + name + '.png') });

  await setCode(page, 'int vida = "dez";\nstring nome = "Ana";\nConsole.WriteLine(nome);\n');
  await page.click('#code');
  await page.keyboard.press('Control+Home');
  await page.waitForFunction(() => !document.getElementById('problem').hidden, null, { timeout: 15000 });
  await shot('erro');

  await setCode(page, 'string nome = "Ana";\n');
  await page.click('#code');
  await page.keyboard.press('Control+End');
  await page.keyboard.type('nome.');
  await page.waitForFunction(() => !document.getElementById('ac').hidden, null, { timeout: 15000 });
  await shot('sugestoes');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Backspace');

  await page.keyboard.type(';\nConsole.WriteLine(');
  await page.waitForFunction(() => !document.getElementById('sig').hidden, null, { timeout: 15000 });
  await shot('parametros');

  await page.keyboard.press('Control+f');
  await page.keyboard.type('nome');
  await shot('busca');
  await page.keyboard.press('Escape');

  await page.click('#fileAdd');
  await page.fill('.dialog-form input', 'Heroi');
  await shot('novo-arquivo');
  await page.click('.dialog-buttons .strong');
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.waitForTimeout(500);
  await shot('abas');

  await page.click('#more');
  await shot('mais');
  await page.keyboard.press('Escape');
  await page.click('#settingsBtn');
  await shot('ajustes');
  await context.close();
  console.log('fotos em tests/shots/ui-*.png');
} finally {
  await browser.close();
  await server.close();
}
