// Teste básico: o app abre, o .NET carrega, um programa roda e pede entrada.
import { startServer, startBrowser, open, ready, idle, runCode, setCode, screen, notes, check, PHONE, DESKTOP } from './lib.mjs';

const server = await startServer();
const browser = await startBrowser();
try {
  const { context, page } = await open(browser, server.url, DESKTOP);
  const t0 = Date.now();
  await ready(page);
  check('o .NET carregou', true);
  console.log('   boot', Date.now() - t0, 'ms ·', await page.textContent('#statusText'));

  const hello = await runCode(page, 'Console.WriteLine("Olá, mundo!");\n');
  check('Olá, mundo roda', hello.screen.includes('Olá, mundo!'), JSON.stringify(hello));
  check('mostra "Programa encerrado"', hello.notes.includes('Programa encerrado'), hello.notes);

  // entrada de texto
  await setCode(page, 'Console.Write("Nome: ");\nvar n = Console.ReadLine();\nConsole.WriteLine($"Oi, {n}!");\n');
  await page.click('#run');
  await page.waitForSelector('#lineInput', { state: 'visible', timeout: 30000 });
  await page.fill('#lineInput', 'Ana');
  await page.keyboard.press('Enter');
  await idle(page);
  check('ReadLine devolve o que foi digitado', (await screen(page)).includes('Oi, Ana!'), await screen(page));

  // erro de compilação em português
  const bad = await runCode(page, 'int x = "a";\n');
  check('erro de compilação é explicado', /texto|número inteiro/.test(bad.notes), bad.notes);

  console.log('erros da página:', page.errors.length ? page.errors : 'nenhum');
  check('sem erros no console', page.errors.length === 0, page.errors.join(' | '));
  await context.close();
} finally {
  await browser.close();
  await server.close();
}
