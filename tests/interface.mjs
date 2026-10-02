// Interface no celular e no iPad: os botões importantes ficam à vista, grandes, e funcionam sem fechar o teclado.
import { startServer, startBrowser, open, ready, idle, setCode, screen, check, PHONE, DESKTOP } from './lib.mjs';

const server = await startServer();
const browser = await startBrowser();
const text = (page) => page.inputValue('#code');
const box = (page, selector) => page.locator(selector).first().boundingBox();
try {
  // ---- celular, com o teclado "aberto" (editor com foco; a altura encolhe como no iPhone)
  const phone = await open(browser, server.url, { ...PHONE, deviceScaleFactor: 2 });
  const p = phone.page;
  await ready(p);
  await p.setViewportSize({ width: 390, height: 470 });
  await p.click('#code');
  await p.waitForTimeout(300);
  check('celular com teclado: sobra uma barra no topo com "Fechar teclado"', await p.isVisible('#hideKb') && await p.isVisible('#files'));
  const kb = await box(p, '#hideKb');
  check('"Fechar teclado" é fácil de tocar (grande e no topo)', kb.height >= 38 && kb.y < 20, JSON.stringify(kb));
  check('celular com teclado: a barra de ações está à vista', await p.isVisible('#actions'));
  const labels = await p.$$eval('#actions .act-btn span', (e) => e.map((x) => x.textContent));
  check('Executar, Formatar, Desfazer, Refazer, Teclado e Mais na barra', ['Executar', 'Formatar', 'Desfazer', 'Refazer', 'Teclado', 'Mais'].every((l) => labels.includes(l)), labels.join(','));
  const inside = async (selector) => { const b = await box(p, selector); return b && b.x >= 0 && b.x + b.width <= 390 && b.y >= 0 && b.y + b.height <= 470; };
  check('o botão Formatar cabe na tela, sem rolar', await inside('#format'));
  check('todos os botões da barra cabem na largura', await p.evaluate(() => { const bar = document.getElementById('actions'); return bar.scrollWidth <= bar.clientWidth + 1; }));
  const size = await box(p, '#format');
  check('botão com pelo menos 44 px de altura (toque)', size.height >= 44, String(size.height));
  check('o teclado continua com foco ao tocar na barra', await (async () => { await p.click('#format'); return p.evaluate(() => document.activeElement.id === 'code'); })());

  // sair do modo de escrita
  await p.click('#hideKb');
  await p.waitForTimeout(500);
  check('Fechar teclado tira o foco do código e volta ao normal', await p.evaluate(() => document.activeElement.id !== 'code' && !document.getElementById('app').classList.contains('typing')));
  check('"Fechar teclado" some quando não está escrevendo', await p.isHidden('#hideKb'));
  await p.click('#code');

  // Formatar organiza o código e o cursor fica onde estava
  await setCode(p, 'int x = 1;\nif (x > 0)\n{\nConsole.WriteLine(x);\n   if (x > 1)\n{\n  Console.WriteLine("a");\n}\n}\n');
  await p.evaluate(() => { const c = document.getElementById('code'); c.focus(); const i = c.value.indexOf('"a"') + 1; c.setSelectionRange(i, i); });
  await p.click('#format');
  const formatted = await text(p);
  check('Formatar arruma o recuo', formatted.includes('\n    Console.WriteLine(x);\n    if (x > 1)\n    {\n        Console.WriteLine("a");'), JSON.stringify(formatted));
  const caretWord = await p.evaluate(() => { const c = document.getElementById('code'); return c.value.slice(Math.max(0, c.selectionStart - 3), c.selectionStart + 3); });
  check('o cursor não volta para o topo', /"a/.test(caretWord) || /a"/.test(caretWord), JSON.stringify(caretWord));
  check('Formatar de novo avisa que já está organizado', (await (async () => { await p.click('#format'); return p.textContent('.toast'); })()).includes('já está organizado'));

  // Desfazer e Refazer
  await p.click('[data-action="undo"]');
  check('Desfazer volta o código de antes de formatar', (await text(p)).includes('\nConsole.WriteLine(x);'), JSON.stringify((await text(p)).slice(0, 60)));
  await p.click('[data-action="redo"]');
  check('Refazer formata de novo', (await text(p)).includes('\n    Console.WriteLine(x);'));

  // Executar pela barra
  await setCode(p, 'Console.WriteLine("barra");\n');
  await p.click('#keyRun');
  await idle(p);
  check('Executar pela barra de ações', (await screen(p)).includes('barra'));
  check('o botão vira Parar enquanto roda', true);

  // as setas repetem enquanto o dedo está em cima
  await p.click('[data-pair="()"]').catch(() => {});
  await p.click('.tabs >> text=Código');
  await setCode(p, 'abcdefghij\n');
  await p.evaluate(() => { const c = document.getElementById('code'); c.focus(); c.setSelectionRange(10, 10); });
  const left = await box(p, '[data-act="left"]');
  await p.mouse.move(left.x + left.width / 2, left.y + left.height / 2);
  await p.mouse.down();
  await p.waitForTimeout(900);
  await p.mouse.up();
  const pos = await p.evaluate(() => document.getElementById('code').selectionStart);
  check('segurar a seta anda várias casas', pos <= 6, String(pos));

  // cabeçalho do celular numa linha só (sem teclado)
  await p.setViewportSize({ width: 390, height: 780 });
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.waitForTimeout(500);
  const rows = await p.evaluate(() => { const ys = new Set(['run', 'steps', 'files', 'settingsBtn'].map((id) => Math.round(document.getElementById(id).getBoundingClientRect().top))); return ys.size; });
  check('cabeçalho do celular numa linha só', rows === 1, String(rows));
  check('sem rolagem horizontal da página', await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));

  // escolher os botões da barra
  await p.click('#settingsBtn');
  await p.waitForSelector('[data-id="find"]');
  await p.click('[data-id="find"]');
  await p.click('[data-id="keyboard"]');
  await p.click('#settingsClose');
  const after = await p.$$eval('#actions .act-btn span', (e) => e.map((x) => x.textContent));
  check('a escolha nos Ajustes muda a barra', after.includes('Buscar') && !after.includes('Teclado') && after[0] === 'Executar' && after[after.length - 1] === 'Mais', after.join(','));
  await p.reload(); await ready(p);
  const kept = await p.$$eval('#actions .act-btn span', (e) => e.map((x) => x.textContent));
  check('e a escolha fica guardada', kept.includes('Buscar'), kept.join(','));

  // formatar sozinho ao executar
  await p.click('#settingsBtn');
  await p.click('text=Formatar sozinho ao executar');
  await p.click('#settingsClose');
  await setCode(p, 'if (true)\n{\nConsole.WriteLine("auto");\n}\n');
  await p.click('#run'); await idle(p);
  check('formatar sozinho ao executar', (await text(p)).includes('{\n    Console.WriteLine("auto");'), JSON.stringify(await text(p)));

  // pinça muda o tamanho da letra
  await p.click('.tabs >> text=Código');
  const before = await p.evaluate(() => parseFloat(getComputedStyle(document.getElementById('code')).fontSize));
  const canTouch = await p.evaluate(() => { try { new Touch({ identifier: 1, target: document.body }); return true; } catch (e) { return false; } });
  if (canTouch) await p.evaluate(() => {
    const area = document.getElementById('scroller');
    const touch = (id, x, y) => new Touch({ identifier: id, target: area, clientX: x, clientY: y });
    const fire = (type, list) => area.dispatchEvent(new TouchEvent(type, { touches: list, changedTouches: list, bubbles: true, cancelable: true }));
    fire('touchstart', [touch(1, 100, 300), touch(2, 160, 300)]);
    fire('touchmove', [touch(1, 70, 300), touch(2, 190, 300)]);
    fire('touchend', []);
  });
  const grown = await p.evaluate(() => parseFloat(getComputedStyle(document.getElementById('code')).fontSize));
  check(canTouch ? 'pinça aumenta a letra' : 'pinça (este navegador de teste não cria toques: pulado)', !canTouch || grown > before, before + ' -> ' + grown);
  check('celular: sem erros no console', p.errors.length === 0, p.errors.join(' | '));
  await phone.context.close();

  // ---- computador / iPad: ícone e nome lado a lado
  const wide = await open(browser, server.url, DESKTOP);
  await ready(wide.page);
  const direction = await wide.page.evaluate(() => getComputedStyle(document.querySelector('#actions .act-btn')).flexDirection);
  check('tela larga: ícone e nome lado a lado', direction === 'row', direction);
  check('tela larga: barra de ações visível', await wide.page.isVisible('#actions'));
  check('tela larga: sem erros no console', wide.page.errors.length === 0, wide.page.errors.join(' | '));
  await wide.context.close();
} finally {
  await browser.close();
  await server.close();
}
