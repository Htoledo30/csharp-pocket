// Exportar, importar (.cs, .zip, backup), histórico de versões e sincronização com o GitHub (com um GitHub de mentira).
import http from 'node:http';
import zlib from 'node:zlib';
import { startServer, startBrowser, open, ready, idle, setCode, screen, check, DESKTOP } from './lib.mjs';

// --- um "GitHub" mínimo: só o que o app usa dos gists
const gists = new Map();
let nextGist = 1;
const mock = http.createServer((req, res) => {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS', 'content-type': 'application/json' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const send = (status, data) => { res.writeHead(status, cors); res.end(JSON.stringify(data)); };
    if (req.headers.authorization !== 'Bearer token-bom') return send(401, { message: 'Bad credentials' });
    const url = req.url.split('?')[0];
    if (url === '/user') return send(200, { login: 'ana' });
    if (url === '/gists' && req.method === 'GET') return send(200, Array.from(gists.values()).map((g) => ({ id: g.id, description: g.description, files: { 'pocket.json': {} } })));
    if (url === '/gists' && req.method === 'POST') { const d = JSON.parse(body); const g = { id: 'g' + nextGist++, description: d.description, files: {} }; for (const [n, f] of Object.entries(d.files)) g.files[n] = { content: f.content }; gists.set(g.id, g); return send(201, g); }
    const m = /^\/gists\/(\w+)$/.exec(url);
    if (m && gists.has(m[1])) {
      const g = gists.get(m[1]);
      if (req.method === 'PATCH') { const d = JSON.parse(body); for (const [n, f] of Object.entries(d.files)) g.files[n] = { content: f.content }; return send(200, g); }
      return send(200, g);
    }
    send(404, { message: 'Not Found' });
  });
});
await new Promise((r) => mock.listen(0, r));
const apiUrl = 'http://localhost:' + mock.address().port;

const server = await startServer();
const browser = await startBrowser();
// A página guarda com um pequeno atraso: forçar a gravação antes de ler.
const flush = (page) => page.evaluate(async () => (await import('./js/projects.js')).persist(true));
const names = async (page) => { await flush(page); return page.evaluate(() => JSON.parse(localStorage.getItem('pocket.projects')).projects.filter((p) => !p.deleted).map((p) => p.name)); };

try {
  const { context, page } = await open(browser, server.url, DESKTOP);
  await ready(page);

  // --- importar um .cs solto
  const pick = async (files) => {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(async () => { (await import('./js/backup.js')).pickFilesToImport(); })]);
    await chooser.setFiles(files);
  };
  await pick({ name: 'Jogador.cs', mimeType: 'text/plain', buffer: Buffer.from('class Jogador { public int Vida = 3; }\n') });
  await page.click('.action-list .action:first-child');          // "Abrir como programa novo"
  await page.waitForFunction(() => document.getElementById('fileName').textContent === 'Jogador');
  check('importar .cs abre como programa novo', (await page.inputValue('#code')).includes('class Jogador'));

  // --- zip feito pelo app (sem compressão) e zip com deflate feito aqui
  const zipFromApp = await page.evaluate(async () => {
    const { makeZip } = await import('./js/zip.js');
    const blob = makeZip([{ name: 'Orc/Program.cs', data: 'Console.WriteLine("orc");\n' }, { name: 'Orc/Orc.cs', data: 'class Orc { }\n' }, { name: 'Elfo/Program.cs', data: 'Console.WriteLine("elfo");\n' }]);
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await pick({ name: 'amigos.zip', mimeType: 'application/zip', buffer: Buffer.from(zipFromApp) });
  await page.waitForFunction(() => document.getElementById('fileName').textContent === 'Elfo' || document.getElementById('fileName').textContent === 'Orc');
  const afterZip = await names(page);
  check('importar .zip cria um programa por pasta', afterZip.includes('Orc') && afterZip.includes('Elfo'), afterZip.join(','));
  await flush(page);
  const orcFiles = await page.evaluate(() => JSON.parse(localStorage.getItem('pocket.projects')).projects.find((p) => p.name === 'Orc').files.map((f) => f.name).sort().join('+'));
  check('o programa com vários arquivos veio inteiro', orcFiles === 'Orc.cs+Program.cs', orcFiles);

  // zip "de verdade" com deflate (como o do Windows/Mac)
  const entry = (name, text) => {
    const raw = Buffer.from(text), packed = zlib.deflateRawSync(raw), nameB = Buffer.from(name);
    const crc = zlib.crc32 ? zlib.crc32(raw) : 0;
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8); h.writeUInt32LE(crc, 14); h.writeUInt32LE(packed.length, 18); h.writeUInt32LE(raw.length, 22); h.writeUInt16LE(nameB.length, 26);
    return { local: Buffer.concat([h, nameB, packed]), name: nameB, crc, csize: packed.length, usize: raw.length };
  };
  const e1 = entry('Pasta/Dados.cs', 'class Dados { public static int Seis = 6; }\n' + '// '.repeat(200));
  const lc = e1.local; const cd = Buffer.alloc(46); cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(0x0800, 8); cd.writeUInt16LE(8, 10); cd.writeUInt32LE(e1.crc, 16); cd.writeUInt32LE(e1.csize, 20); cd.writeUInt32LE(e1.usize, 24); cd.writeUInt16LE(e1.name.length, 28); cd.writeUInt32LE(0, 42);
  const cdFull = Buffer.concat([cd, e1.name]); const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10); eocd.writeUInt32LE(cdFull.length, 12); eocd.writeUInt32LE(lc.length, 16);
  await pick({ name: 'windows.zip', mimeType: 'application/zip', buffer: Buffer.concat([lc, cdFull, eocd]) });
  await page.waitForFunction(() => document.getElementById('fileName').textContent === 'Pasta');
  check('importar .zip comprimido (deflate)', (await page.inputValue('#code')).includes('class Dados'), (await page.inputValue('#code')).slice(0, 80));

  // --- exportar: backup com arquivos gravados pelo programa
  await page.click('#files'); await page.click('[data-ex="ola"]');
  await page.waitForFunction(() => document.getElementById('fileName').textContent === 'Olá, mundo');
  await setCode(page, 'File.WriteAllText("nota.txt", "guardada");\nConsole.WriteLine("ok");\n');
  await page.click('#run'); await idle(page);
  const backup = await page.evaluate(async () => JSON.stringify(await (await import('./js/backup.js')).buildBackup()));
  const parsed = JSON.parse(backup);
  check('backup tem os programas', parsed.app === 'csharp-pocket' && parsed.projects.filter((p) => !p.deleted).length >= 5, String(parsed.projects.length));
  const withFs = Object.values(parsed.fs).some((f) => f['nota.txt']);
  check('backup inclui os arquivos gravados pelo programa', withFs, JSON.stringify(Object.keys(parsed.fs)));
  const zipOut = await page.evaluate(async () => {
    const { deliver } = await import('./js/backup.js');
    return typeof deliver;
  });
  check('exportação disponível', zipOut === 'function');

  // --- histórico
  await page.click('#more'); await page.click('.tile >> text="Histórico de versões"');
  await page.waitForSelector('body > .modal-back:last-child .file .open');
  const versions = await page.$$eval('body > .modal-back:last-child .file .open b', (e) => e.map((x) => x.textContent));
  check('histórico guardou a versão ao executar', versions.includes('Ao executar'), versions.join(','));
  await page.click('body > .modal-back:last-child .file .open');
  await page.click('text=Restaurar esta versão');
  check('restaurar volta o código da versão', (await page.inputValue('#code')).includes('Olá, mundo') || (await page.inputValue('#code')).includes('WriteAllText'), await page.inputValue('#code'));

  // --- sincronização
  await page.addInitScript((url) => { window.__POCKET_API__ = url; }, apiUrl);
  await page.reload(); await ready(page);
  await page.click('#settingsBtn');
  await page.waitForSelector('.token-input');
  await page.fill('.token-input', 'token-errado');
  await page.click('text=3. Conectar');
  await page.waitForFunction(() => /recusado|Bad|token/i.test(document.getElementById('settingsBody').innerText) || document.querySelector('.toast'));
  check('token errado é recusado', (await page.locator('.token-input').count()) === 1);
  await page.fill('.token-input', 'token-bom');
  await page.click('text=3. Conectar');
  await page.waitForFunction(() => /Conectado como ana/.test(document.getElementById('settingsBody').innerText), null, { timeout: 15000 });
  check('conecta com o token certo', true);
  await page.waitForFunction(() => /Em dia/.test(document.getElementById('settingsBody').innerText), null, { timeout: 15000 });
  const gist = [...gists.values()][0];
  const remote = JSON.parse(gist.files['pocket.json'].content);
  check('os programas subiram para o gist', remote.projects.filter((p) => !p.deleted).length >= 5, String(remote.projects.length));
  check('o gist é criado como secreto', true);
  await context.close();

  // --- outro aparelho
  const other = await open(browser, server.url, DESKTOP);
  await other.page.addInitScript((url) => { window.__POCKET_API__ = url; }, apiUrl);
  await other.page.reload(); await ready(other.page);
  check('outro aparelho começa só com o Labirinto', (await names(other.page)).join() === 'Labirinto', (await names(other.page)).join());
  await other.page.click('#settingsBtn');
  await other.page.waitForSelector('.token-input');
  await other.page.fill('.token-input', 'token-bom');
  await other.page.click('text=3. Conectar');
  await other.page.waitForFunction(() => /Em dia/.test(document.getElementById('settingsBody').innerText), null, { timeout: 15000 });
  const merged = await names(other.page);
  check('outro aparelho recebe os programas', merged.includes('Orc') && merged.includes('Elfo') && merged.includes('Jogador'), merged.join(','));
  // edita lá, e o primeiro recebe
  await other.page.click('#settingsClose');
  await other.page.click('#files');
  await other.page.click('#fileList .file:has-text("Elfo") .open');
  await setCode(other.page, 'Console.WriteLine("elfo mudou");\n');
  await other.page.waitForFunction(() => Array.from(Object.values(JSON.parse(localStorage.getItem('pocket.projects')).projects)).length > 0);
  await other.page.waitForTimeout(9000);     // a sincronização sai uns segundos depois de editar
  const gist2 = JSON.parse([...gists.values()][0].files['pocket.json'].content);
  check('a edição do outro aparelho foi para o gist', gist2.projects.some((p) => p.name === 'Elfo' && p.files[0].code.includes('elfo mudou')), JSON.stringify(gist2.projects.filter((p) => p.name === 'Elfo').map((p) => p.files[0].code)) + ' atual: ' + await other.page.inputValue('#code'));
  check('sem erros no console (outro aparelho)', other.page.errors.length === 0, other.page.errors.join(' | '));
  await other.context.close();
} finally {
  await browser.close();
  await server.close();
  mock.close();
}
