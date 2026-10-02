// Vários arquivos por programa: criar, usar uma classe de outro arquivo, erro em outro arquivo, renomear, apagar, passo a passo.
import { startServer, startBrowser, open, ready, idle, setCode, screen, notes, check, DESKTOP } from './lib.mjs';

const server = await startServer();
const browser = await startBrowser();
try {
  const { context, page } = await open(browser, server.url, DESKTOP);
  await ready(page);
  const tabs = () => page.$$eval('#ftabs .ftab:not(.add)', (els) => els.map((e) => e.textContent.replace(/\s*●$/, '').trim()));

  check('começa com um arquivo', JSON.stringify(await tabs()) === '["Program.cs"]', JSON.stringify(await tabs()));

  // novo arquivo
  await page.click('#fileAdd');
  await page.fill('.dialog-form input', 'Heroi');
  await page.click('.dialog-buttons .strong');
  check('Heroi.cs criado e aberto', JSON.stringify(await tabs()) === '["Program.cs","Heroi.cs"]' && (await page.inputValue('#code')).startsWith('class Heroi'), await page.inputValue('#code'));
  await setCode(page, 'class Heroi\n{\n    public string Nome;\n    public int Vida = 10;\n    public Heroi(string nome) { Nome = nome; }\n    public void Ferir(int dano)\n    {\n        Vida -= dano;\n        Console.WriteLine($"{Nome} agora tem {Vida} de vida");\n    }\n}\n');

  // usar a classe no arquivo principal
  await page.click('#ftabs .ftab:first-child');
  await setCode(page, 'var h = new Heroi("Teseu");\nh.Ferir(3);\nh.Ferir(4);\n');
  await page.click('#run'); await idle(page);
  check('classe de outro arquivo funciona', (await screen(page)).includes('Teseu agora tem 3 de vida'), await screen(page));

  // sugestões enxergam o outro arquivo
  await page.click('#code'); await page.keyboard.press('Control+End'); await page.keyboard.type('h.');
  await page.waitForFunction(() => !document.getElementById('ac').hidden, null, { timeout: 15000 });
  const rows = await page.$$eval('#ac [role=option] b', (els) => els.map((e) => e.textContent));
  check('sugestões conhecem a classe do outro arquivo', rows.includes('Vida') && rows.includes('Ferir'), rows.join(','));
  await page.keyboard.press('Escape');
  await page.keyboard.press('Backspace'); await page.keyboard.press('Backspace');

  // erro em outro arquivo
  await page.click('#ftabs .ftab:nth-child(2)');
  await setCode(page, 'class Heroi\n{\n    public int Vida = "dez";\n}\n');
  await page.click('#ftabs .ftab:first-child');
  await page.waitForFunction(() => document.querySelector('#ftabs .ftab .err'), null, { timeout: 15000 });
  check('aba do arquivo com erro ganha um aviso', (await page.$$eval('#ftabs .ftab', (els) => els.map((e) => e.textContent))).some((t) => t.includes('Heroi.cs') && t.includes('●')));
  await page.click('#run'); await idle(page);
  const n = await notes(page);
  check('o erro diz de qual arquivo é', /Heroi\.cs · Linha 3/.test(n), n);
  await page.click('.diag:has-text("Heroi.cs")');
  check('tocar no erro abre o arquivo certo', (await page.inputValue('#code')).startsWith('class Heroi'), await page.inputValue('#code'));

  // renomear e apagar
  await page.click('#ftabs .ftab[aria-selected="true"]');
  await page.click('.action-list .action:first-child');
  await page.fill('.dialog-form input', 'Guerreiro');
  await page.click('.dialog-buttons .strong');
  check('arquivo renomeado', JSON.stringify(await tabs()) === '["Program.cs","Guerreiro.cs"]', JSON.stringify(await tabs()));
  await page.click('#ftabs .ftab[aria-selected="true"]');
  await page.click('.action.danger');
  await page.click('.dialog-buttons .danger');
  check('arquivo apagado', JSON.stringify(await tabs()) === '["Program.cs"]', JSON.stringify(await tabs()));

  // passo a passo passando por outro arquivo
  await page.click('#fileAdd');
  await page.fill('.dialog-form input', 'Calc');
  await page.click('.dialog-buttons .strong');
  await setCode(page, 'static class Calc\n{\n    public static int Dobro(int n)\n    {\n        int r = n * 2;\n        return r;\n    }\n}\n');
  await page.click('#ftabs .ftab:first-child');
  await setCode(page, 'int a = 4;\nint b = Calc.Dobro(a);\nConsole.WriteLine(b);\n');
  await page.click('#steps');
  await page.waitForFunction(() => /^Passo \d+/.test(document.getElementById('stepInfo').textContent), null, { timeout: 30000 });
  let sawCalc = false;
  for (let i = 0; i < 8; i++) {
    if ((await page.$$eval('#ftabs .ftab[aria-selected="true"]', (e) => e[0].textContent)).includes('Calc.cs')) sawCalc = true;
    if (await page.isDisabled('#stepNext')) break;
    await page.click('#stepNext');
  }
  check('o passo a passo entra no outro arquivo', sawCalc);
  await page.click('#stepExit');

  // continua depois de recarregar
  await page.reload(); await ready(page);
  check('arquivos continuam depois de recarregar', JSON.stringify(await tabs()) === '["Program.cs","Calc.cs"]', JSON.stringify(await tabs()));

  check('sem erros no console', page.errors.length === 0, page.errors.join(' | '));
  await context.close();
} finally {
  await browser.close();
  await server.close();
}
