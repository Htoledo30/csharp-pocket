// Mede a rapidez do motor em perguntas repetidas (depuração, não é teste).
import { startServer, startBrowser, open, ready } from '../tests/lib.mjs';
const server = await startServer();
const browser = await startBrowser();
const { page } = await open(browser, server.url);
await ready(page);
const out = await page.evaluate(async () => {
  const { ask } = await import('./js/engine.js');
  const times = {};
  const time = async (name, fn) => { const t = performance.now(); const r = await fn(); (times[name] ||= []).push(Math.round(performance.now() - t)); return r; };
  const base = 'string nome = "Ana";\nList<int> lista = new List<int>();\nint x = 5;\nConsole.WriteLine(nome);\n';
  for (let i = 0; i < 4; i++) {
    const src = base + 'nome.' + 'x'.repeat(i) + '\n';
    await time('analyze', () => ask('analyze', { files: [{ name: 'Program.cs', code: src }] }));
    await time('complete .', () => ask('complete', { files: [{ name: 'Program.cs', code: src }], file: 0, pos: base.length + 5 }));
    const src2 = base + 'Con' + 'x'.repeat(i) + '\n';
    await time('complete ident', () => ask('complete', { files: [{ name: 'Program.cs', code: src2 }], file: 0, pos: base.length + 3 }));
    const src3 = base + 'Console.WriteLine(' + 'x'.repeat(i) + '\n';
    await time('signature', () => ask('signature', { files: [{ name: 'Program.cs', code: src3 }], file: 0, pos: base.length + 18 }));
  }
  return times;
});
console.log(JSON.stringify(out));
await browser.close(); await server.close();
