// Meus programas: criar, renomear, apagar, exemplos e o que sobra depois de recarregar.
import { startServer, startBrowser, open, ready, setCode, check, PHONE } from './lib.mjs';

const server = await startServer();
const browser = await startBrowser();
const names = (page) => page.$$eval('#fileList .file .open b', (els) => els.map((e) => e.textContent));
try {
  const { context, page } = await open(browser, server.url, PHONE);
  await ready(page);
  check('começa com o Labirinto', (await page.textContent('#fileName')) === 'Labirinto');

  await page.click('#files');
  await page.click('#fileNew');
  await page.fill('#renameInput', 'Orc e dado'); await page.keyboard.press('Enter');
  check('novo programa criado e aberto', (await page.textContent('#fileName')) === 'Orc e dado' && (await page.inputValue('#code')).startsWith('// Escreva'), await page.textContent('#fileName'));
  await setCode(page, 'Console.WriteLine("orc");\n');

  await page.click('#files'); await page.click('[data-ex="combate"]');
  await page.waitForFunction(() => document.getElementById('fileName').textContent === 'Combate');
  check('exemplo abre como programa novo', true);
  await page.click('#files');
  const list = await names(page);
  check('lista com os três', list.length === 3 && list.includes('Orc e dado') && list.includes('Labirinto'), list.join(','));

  // apagar o aberto
  await page.click('#fileList .file.on >> text=Apagar'); await page.click('#fileList .mini.danger');
  const after = await names(page);
  check('apagar o programa aberto abre outro', after.length === 2 && !after.includes('Combate'), after.join(','));

  // recarregar
  await page.keyboard.press('Escape');
  await page.reload(); await ready(page);
  const current = await page.textContent('#fileName');
  await page.click('#files');
  check('programas continuam depois de recarregar', (await names(page)).length === 2, (await names(page)).join(','));
  check('o aberto continua aberto', current !== 'Programas');
  check('o código foi guardado', (await page.inputValue('#code')).length > 5);

  // editar guarda sozinho
  await page.keyboard.press('Escape');
  await setCode(page, 'Console.WriteLine("guardado");\n');
  await page.waitForTimeout(500);
  await page.reload(); await ready(page);
  check('edição guardada sem apertar nada', (await page.inputValue('#code')).includes('guardado'), await page.inputValue('#code'));

  check('sem erros no console', page.errors.length === 0, page.errors.join(' | '));
  await context.close();
} finally {
  await browser.close();
  await server.close();
}
