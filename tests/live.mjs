// Console real (ao vivo): o programa espera de verdade pelo que você digita, sem reexecutar.
import { startServer, startBrowser, open, ready, idle, setCode, screen, notes, check, DESKTOP } from './lib.mjs';

const server = await startServer({ isolated: true });
const browser = await startBrowser();
try {
  const { context, page } = await open(browser, server.url, DESKTOP);
  await ready(page);
  check('página isolada', await page.evaluate(() => crossOriginIsolated === true));

  // 1. ReadLine: o texto antes da pergunta aparece uma vez só, e o programa continua de onde parou
  await setCode(page, 'Console.WriteLine("início");\nConsole.Write("Nome: ");\nvar n = Console.ReadLine();\nConsole.WriteLine($"Oi, {n}!");\nConsole.Write("Idade: ");\nint i = int.Parse(Console.ReadLine());\nConsole.WriteLine($"{i + 1} no ano que vem");\n');
  await page.click('#run');
  await page.waitForSelector('#lineInput', { state: 'visible', timeout: 30000 });
  check('rodando ao vivo', (await page.getAttribute('#app', 'data-live')) === '1');
  await page.fill('#lineInput', 'Ana'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.getElementById('screen').innerText.includes('Oi, Ana!'));
  await page.waitForSelector('#lineInput', { state: 'visible' });
  await page.fill('#lineInput', '41'); await page.keyboard.press('Enter');
  await idle(page);
  const out = await screen(page);
  check('ReadLine duas vezes', out.includes('Oi, Ana!') && out.includes('42 no ano que vem'), out);
  check('sem repetir a saída', (out.match(/início/g) || []).length === 1, out);

  // 2. tempo real: KeyAvailable + Sleep
  await setCode(page, 'int voltas = 0;\nwhile (true)\n{\n    if (Console.KeyAvailable)\n    {\n        var k = Console.ReadKey(true);\n        if (k.Key == ConsoleKey.Q) break;\n        Console.WriteLine("tecla " + k.Key);\n    }\n    voltas++;\n    Thread.Sleep(20);\n}\nConsole.WriteLine("fim " + (voltas > 3));\n');
  await page.click('#run');
  await page.waitForSelector('#keyForm', { state: 'visible', timeout: 30000 });
  await page.click('[data-key="ArrowUp"]');
  await page.waitForFunction(() => document.getElementById('screen').innerText.includes('tecla UpArrow'), null, { timeout: 10000 });
  check('tecla chega com o programa rodando', true);
  await page.click('[data-key="ArrowLeft"]');
  await page.waitForFunction(() => document.getElementById('screen').innerText.includes('tecla LeftArrow'));
  await page.locator('#keyInput').pressSequentially('q');
  await idle(page);
  check('sai do laço ao apertar Q', (await screen(page)).includes('fim True'), await screen(page));

  // 3. Parar um programa que está dormindo (sem reiniciar o motor)
  await setCode(page, 'while (true) { Thread.Sleep(50); }\n');
  await page.click('#run');
  await page.waitForFunction(() => document.getElementById('status').dataset.state === 'busy');
  await page.waitForTimeout(400);
  const t0 = Date.now();
  await page.click('#run');
  await idle(page, 5000);
  check('Parar funciona e é rápido', Date.now() - t0 < 1400, String(Date.now() - t0));

  // 4. Parar uma conta que nunca termina (reinicia o motor)
  await setCode(page, 'long x = 0;\nwhile (true) { x++; }\n');
  await page.click('#run');
  await page.waitForFunction(() => document.getElementById('status').dataset.state === 'busy');
  await page.waitForTimeout(400);
  await page.click('#run');
  await idle(page, 30000);
  check('Parar uma conta infinita', true);
  const again = await (async () => { await setCode(page, 'Console.WriteLine("de novo");\n'); await page.click('#run'); await idle(page, 60000); return screen(page); })();
  check('roda de novo depois de reiniciar o motor', again.includes('de novo'), again);

  // 5. erro em tempo de execução com a linha
  await setCode(page, 'int[] v = { 1 };\nConsole.WriteLine("a");\nConsole.WriteLine(v[5]);\n');
  await page.click('#run'); await idle(page);
  const n = await notes(page);
  check('erro de execução aponta a linha 3', /linha 3/.test(n), n);

  // 6. arquivos que persistem entre execuções
  await setCode(page, 'File.WriteAllText("save.txt", "pontos=42");\nConsole.WriteLine("salvou");\n');
  await page.click('#run'); await idle(page);
  await setCode(page, 'Console.WriteLine(File.Exists("save.txt") ? File.ReadAllText("save.txt") : "sem arquivo");\n');
  await page.click('#run'); await idle(page);
  check('arquivo gravado numa execução existe na próxima', (await screen(page)).includes('pontos=42'), await screen(page));
  await page.reload(); await ready(page);
  await setCode(page, 'Console.WriteLine(File.Exists("save.txt") ? File.ReadAllText("save.txt") : "sem arquivo");\n');
  await page.click('#run'); await idle(page);
  check('e continua lá depois de recarregar o app', (await screen(page)).includes('pontos=42'), await screen(page));

  check('sem erros no console', page.errors.length === 0, page.errors.join(' | '));
  await context.close();
} finally {
  await browser.close();
  await server.close();
}
