// ReadKey e Console.KeyAvailable nos dois modos (reexecutar e ao vivo).
import { startServer, startBrowser, open, ready, idle, setCode, screen, notes, check, DESKTOP } from './lib.mjs';

const browser = await startBrowser();
const cases = {
  'ReadKey().Key': ['Console.WriteLine("Aperte:");\nConsoleKey t = Console.ReadKey().Key;\nConsole.WriteLine();\nConsole.WriteLine("Tecla: " + t);\n', async (p) => { await p.click('[data-key="ArrowLeft"]'); }, /Tecla: LeftArrow/],
  'ReadKey(true).KeyChar': ['char c = Console.ReadKey(true).KeyChar;\nConsole.WriteLine("Letra: " + c);\n', async (p) => { await p.locator('#keyInput').pressSequentially('x'); }, /Letra: x/],
  'ConsoleKeyInfo': ['ConsoleKeyInfo info = Console.ReadKey();\nif (info.Key == ConsoleKey.Enter) Console.WriteLine("enter!"); else Console.WriteLine("outra: " + info.Key);\n', async (p) => { await p.click('[data-key="Enter"]'); }, /enter!/],
  'pausa no fim': ['Console.WriteLine("fim");\nConsole.ReadKey();\n', async (p) => { await p.click('[data-key="Escape"]'); }, /fim/],
  'laço até Esc': ['int n = 0;\nwhile (Console.ReadKey(true).Key != ConsoleKey.Escape) { n++; Console.WriteLine(n); }\nConsole.WriteLine("saiu");\n', async (p) => {
    await p.click('[data-key="ArrowUp"]'); await p.waitForFunction(() => document.getElementById('screen').innerText.includes('1'));
    await p.locator('#keyInput').pressSequentially('a'); await p.waitForFunction(() => document.getElementById('screen').innerText.includes('2'));
    await p.click('[data-key="Escape"]'); }, /saiu/],
};
for (const mode of ['reexecutar', 'ao vivo']) {
  const server = await startServer({ isolated: mode === 'ao vivo' });
  try {
    const { context, page } = await open(browser, server.url, DESKTOP);
    await ready(page);
    console.log('— modo', mode);
    for (const [name, [src, act, expect]] of Object.entries(cases)) {
      await setCode(page, src);
      await page.click('#run');
      await page.waitForSelector('#keyForm', { state: 'visible', timeout: 20000 });
      check(mode + ': ' + name + ' (modo certo)', (await page.getAttribute('#app', 'data-live')) === (mode === 'ao vivo' ? '1' : '0'));
      await act(page);
      await idle(page, 20000);
      const out = await screen(page);
      check(mode + ': ' + name, expect.test(out), out);
    }
    check(mode + ': sem erros no console', page.errors.length === 0, page.errors.join(' | '));
    await context.close();
  } finally { await server.close(); }
}
await browser.close();
