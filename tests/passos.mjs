// Passo a passo: andar, voltar, variáveis, entrada durante o passo a passo, erros.
import { startServer, startBrowser, open, ready, setCode, notes, check, PHONE, DESKTOP } from './lib.mjs';

const ORC = 'int VidaOrc = 20;\nRandom Dado = new Random();\nwhile (VidaOrc > 0)\n{\n    int D6 = Dado.Next(1, 7);\n    VidaOrc = Math.Clamp(VidaOrc - D6, 0, 20);\n    Console.WriteLine($"Vida: {VidaOrc}");\n}\nConsole.WriteLine("Orc morreu.");\n';
const server = await startServer();
const browser = await startBrowser();
const stepReady = (pg) => pg.waitForFunction(() => /^Passo \d+/.test(document.getElementById('stepInfo').textContent), null, { timeout: 30000 });
const info = (pg) => pg.textContent('#stepInfo');
const vars = (pg) => pg.$$eval('#stepVars .var', (rows) => rows.map((r) => (r.classList.contains('changed') ? '*' : '') + r.innerText.replace(/\n/g, ' ')));
try {
  for (const [mode, options] of [['celular', PHONE], ['computador', DESKTOP]]) {
    const { context, page } = await open(browser, server.url, options);
    await ready(page);
    console.log('— ' + mode);
    await setCode(page, ORC);
    await page.click('#steps'); await stepReady(page);
    check(mode + ': começa no passo 1', /^Passo 1 de \d+/.test(await info(page)), await info(page));
    check(mode + ': editor fica só leitura', await page.evaluate(() => document.getElementById('code').readOnly));
    for (let i = 0; i < 6; i++) await page.click('#stepNext');
    check(mode + ': avança', /^Passo 7 de/.test(await info(page)), await info(page));
    const v = await vars(page);
    check(mode + ': mostra variáveis', v.some((x) => x.includes('VidaOrc')), v.join(' ; '));
    await page.click('#stepBack');
    check(mode + ': volta', /^Passo 6 de/.test(await info(page)), await info(page));
    await page.evaluate(() => { const r = document.getElementById('stepRange'); r.value = r.max; r.dispatchEvent(new Event('input')); });
    check(mode + ': barra leva ao fim', /fim|Último/.test(await page.textContent('#stepMsg')), await page.textContent('#stepMsg'));
    await page.click('#stepExit');
    check(mode + ': sair devolve o editor', !(await page.evaluate(() => document.getElementById('code').readOnly)) && !(await page.evaluate(() => document.getElementById('keys').hidden)));
    if (mode === 'computador') {
      // entrada durante o passo a passo, e depois um erro
      await setCode(page, 'Console.Write("n? ");\nint n = int.Parse(Console.ReadLine());\nint d = 10 / n;\nConsole.WriteLine(d);\n');
      await page.click('#steps'); await stepReady(page);
      await page.click('#stepNext');
      await page.click('#stepNext'); await page.fill('#lineInput', '0'); await page.keyboard.press('Enter');
      await page.waitForFunction(() => /de 3/.test(document.getElementById('stepInfo').textContent), null, { timeout: 15000 });
      check('entrada no meio do passo a passo', /Divisão por zero/.test(await notes(page)), await notes(page));
      await page.click('#stepExit');
      // erro de compilação: não entra no passo a passo
      await setCode(page, 'int x = "a";\n');
      await page.click('#steps');
      await page.waitForFunction(() => document.getElementById('stepper').hidden && document.getElementById('notes').innerText.length > 5, null, { timeout: 15000 });
      check('erro de compilação não entra no passo a passo', /erro/.test(await notes(page)), await notes(page));
      // classe com métodos e construtor
      await setCode(page, 'var heroi = new Jogador("Teseu");\nheroi.Ferir(4);\nConsole.WriteLine(heroi.Vida);\nclass Jogador\n{\n    public string Nome; public int Vida = 10;\n    public Jogador(string nome)\n    {\n        Nome = nome;\n    }\n    public void Ferir(int dano)\n    {\n        int antes = Vida;\n        Vida -= dano;\n    }\n}\n');
      await page.click('#steps'); await stepReady(page);
      let sawInside = false;
      for (let i = 0; i < 20 && !(await page.isDisabled('#stepNext')); i++) { if (/dentro de Jogador/.test(await info(page))) sawInside = true; await page.click('#stepNext'); }
      check('passa por dentro dos métodos da classe', sawInside);
      await page.click('#stepExit');
      // labirinto com tecla
      await page.click('#files'); await page.click('[data-ex="labirinto"]');
      await page.click('#steps'); await stepReady(page);
      await page.evaluate(() => { const r = document.getElementById('stepRange'); r.value = r.max; r.dispatchEvent(new Event('input')); });
      await page.click('#stepNext'); await page.click('[data-key="ArrowDown"]');
      await stepReady(page);
      check('labirinto: segue depois de uma tecla', /^Passo \d+/.test(await info(page)), await info(page));
    }
    check(mode + ': sem erros no console', page.errors.length === 0, page.errors.join(' | '));
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}
