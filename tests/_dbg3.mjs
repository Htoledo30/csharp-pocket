import { startServer, startBrowser, open, ready, idle, setCode, screen, notes } from './lib.mjs';
const server = await startServer({ isolated: true });
const browser = await startBrowser();
const { page } = await open(browser, server.url);
await ready(page);
for (let i = 0; i < 4; i++) {
  await setCode(page, 'Console.WriteLine("Aperte:");\nConsoleKey t = Console.ReadKey().Key;\nConsole.WriteLine();\nConsole.WriteLine("Tecla: " + t);\n');
  await page.click('#run');
  await page.waitForSelector('#keyForm', { state: 'visible' });
  await page.click('[data-key="ArrowLeft"]');
  await idle(page);
  console.log(i, 'A', JSON.stringify(await screen(page)));
  await setCode(page, 'char c = Console.ReadKey(true).KeyChar;\nConsole.WriteLine("Letra: " + c);\n');
  await page.click('#run');
  await page.waitForSelector('#keyForm', { state: 'visible' });
  await page.locator('#keyInput').pressSequentially('x');
  await idle(page);
  console.log(i, 'B', JSON.stringify(await screen(page)), JSON.stringify(await notes(page)));
}
await browser.close(); await server.close();
