// O editor: fechar chaves, recuo, aspas do iPhone, comandos de linha, buscar/trocar, renomear, ir para a linha, cola.
import { startServer, startBrowser, open, ready, idle, setCode, screen, check, DESKTOP, PHONE } from './lib.mjs';

const server = await startServer();
const browser = await startBrowser();
const text = (page) => page.inputValue('#code');
const caretAt = (page, needle, offset = 0) => page.evaluate(([n, o]) => { const c = document.getElementById('code'); c.focus(); const i = c.value.indexOf(n) + o; c.setSelectionRange(i, i); c.dispatchEvent(new Event('keyup')); }, [needle, offset]);
const press = async (page, ...keys) => { for (const k of keys) await page.keyboard.press(k); };
try {
  const { context, page } = await open(browser, server.url, DESKTOP);
  await ready(page);

  // --- chaves, parênteses e recuo
  await setCode(page, '');
  await page.click('#code');
  await page.keyboard.type('if (x > 1)');
  await page.keyboard.type('{');
  check('{ fecha com }', (await text(page)).endsWith('{}'), JSON.stringify(await text(page)));
  await page.keyboard.press('Enter');
  check('Enter entre chaves recua e deixa a } embaixo', (await text(page)) === 'if (x > 1){\n    \n}', JSON.stringify(await text(page)));
  await setCode(page, '');
  await page.keyboard.type('Console.WriteLine("oi');
  check('aspas e parêntese fecham sozinhos', (await text(page)) === 'Console.WriteLine("oi")' || (await text(page)).startsWith('Console.WriteLine("oi'), JSON.stringify(await text(page)));

  // --- aspas curvas do iPhone viram retas
  await setCode(page, 'x = ');
  await page.evaluate(() => {
    const c = document.getElementById('code'); c.focus(); c.setSelectionRange(c.value.length, c.value.length);
    for (const d of ['“', 'a', '”']) { const ev = new InputEvent('beforeinput', { inputType: 'insertText', data: d, cancelable: true, bubbles: true }); if (c.dispatchEvent(ev)) document.execCommand('insertText', false, d); }
  });
  check('aspas curvas viram retas', /x = "a"/.test(await text(page)), JSON.stringify(await text(page)));

  // --- comandos de linha
  await setCode(page, 'a\nb\nc\n');
  await caretAt(page, 'b');
  await page.keyboard.press('Control+d');
  check('duplicar linha (Ctrl+D)', (await text(page)) === 'a\nb\nb\nc\n', JSON.stringify(await text(page)));
  await page.keyboard.press('Control+Shift+K');
  check('apagar linha (Ctrl+Shift+K)', (await text(page)) === 'a\nb\nc\n', JSON.stringify(await text(page)));
  await caretAt(page, 'b');
  await page.keyboard.press('Alt+ArrowUp');
  check('subir linha (Alt+↑)', (await text(page)) === 'b\na\nc\n', JSON.stringify(await text(page)));
  await page.keyboard.press('Alt+ArrowDown');
  check('descer linha (Alt+↓)', (await text(page)) === 'a\nb\nc\n', JSON.stringify(await text(page)));
  await setCode(page, 'int a = 1;\nint b = 2;\n');
  await caretAt(page, 'int a');
  await page.keyboard.press('Control+/');
  check('comentar (Ctrl+/)', (await text(page)) === '// int a = 1;\nint b = 2;\n', JSON.stringify(await text(page)));
  await page.keyboard.press('Control+/');
  check('descomentar', (await text(page)) === 'int a = 1;\nint b = 2;\n', JSON.stringify(await text(page)));
  await page.evaluate(() => { const c = document.getElementById('code'); c.setSelectionRange(0, c.value.length - 1); });
  await page.keyboard.press('Tab');
  check('Tab com várias linhas recua todas', (await text(page)) === '    int a = 1;\n    int b = 2;\n', JSON.stringify(await text(page)));
  await page.keyboard.press('Shift+Tab');
  check('Shift+Tab desfaz o recuo', (await text(page)) === 'int a = 1;\nint b = 2;\n', JSON.stringify(await text(page)));
  await page.keyboard.press('Control+z');
  check('desfazer volta o recuo (histórico do navegador)', (await text(page)) === '    int a = 1;\n    int b = 2;\n', JSON.stringify(await text(page)));

  // --- buscar e trocar
  await setCode(page, 'int vida = 20;\nvida -= 5;\nConsole.WriteLine(vida);\nstring Vida = "x";\n');
  await page.click('#code');
  await page.keyboard.press('Control+f');
  await page.waitForSelector('#findbar:not([hidden])');
  await page.keyboard.type('vida');
  await page.waitForFunction(() => /\d de \d/.test(document.getElementById('findCount').textContent));
  check('conta os achados (ignora maiúsculas)', (await page.textContent('#findCount')).trim() === '1 de 4', await page.textContent('#findCount'));
  check('marca os achados no código', (await page.locator('#marks i.find').count()) === 4);
  await page.keyboard.press('Enter');
  check('Enter vai ao próximo', (await page.textContent('#findCount')).trim() === '2 de 4', await page.textContent('#findCount'));
  await page.click('#findCase');
  check('diferenciar maiúsculas muda a contagem', (await page.textContent('#findCount')).includes('de 3'), await page.textContent('#findCount'));
  await page.click('#findReplaceToggle');
  await page.fill('#replaceInput', 'hp');
  await page.click('#replaceAll');
  check('trocar todos', (await text(page)) === 'int hp = 20;\nhp -= 5;\nConsole.WriteLine(hp);\nstring Vida = "x";\n', JSON.stringify(await text(page)));
  await page.click('#findClose');
  check('fechar a busca tira as marcas', (await page.locator('#marks i.find').count()) === 0 && (await page.isHidden('#findbar')));

  // --- renomear (não mexe em textos nem comentários)
  await setCode(page, 'int vida = 20;\n// vida do orc\nstring s = "vida";\nConsole.WriteLine($"Vida: {vida}");\nvida -= 1;\n');
  await caretAt(page, 'vida', 2);
  await page.click('#more'); await page.click('.tile:has-text("Renomear")');
  await page.fill('.dialog-form input', 'energia');
  await page.click('.dialog-buttons .strong');
  check('renomear troca o código, não textos nem comentários', (await text(page)) === 'int energia = 20;\n// vida do orc\nstring s = "vida";\nConsole.WriteLine($"Vida: {energia}");\nenergia -= 1;\n', JSON.stringify(await text(page)));

  // --- ir para a linha
  await setCode(page, Array.from({ length: 60 }, (_, i) => 'linha' + (i + 1)).join('\n') + '\n');
  await page.click('#code');
  await page.keyboard.press('Control+g');
  await page.fill('.dialog-form input', '42');
  await page.keyboard.press('Enter');
  const pos = await page.evaluate(() => { const c = document.getElementById('code'); return c.value.slice(0, c.selectionStart).split('\n').length; });
  check('ir para a linha 42', pos === 42, String(pos));

  // --- par de chaves destacado
  await setCode(page, 'void f()\n{\n    int x;\n}\n');
  await caretAt(page, '{');
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.querySelectorAll('#marks i.br').length === 2);
  check('destaca o par da chave', true);

  // --- botão ▶ da barra de teclas
  await setCode(page, 'Console.WriteLine("pela barra");\n');
  await page.click('#keyRun');
  await idle(page);
  check('▶ da barra de teclas executa', (await screen(page)).includes('pela barra'), await screen(page));

  // --- menu Mais, ajustes
  await page.click('#more');
  check('menu Mais abre com os comandos', (await page.locator('.tile').count()) >= 12);
  await page.keyboard.press('Escape');
  await page.click('#settingsBtn');
  await page.waitForSelector('#settingsBack:not([hidden])');
  check('ajustes abrem', /Tema/.test(await page.textContent('#settingsBody')));
  await page.click('.seg button:has-text("Escuro")');
  check('tema escuro aplicado', (await page.getAttribute('html', 'data-theme')) === 'dark');
  await page.click('.seg button:has-text("Automático")');
  await page.click('#settingsClose');

  // --- cola
  await setCode(page, 'int vida = 3;\n');
  await page.click('#more'); await page.click('.tile >> text="Cola de C#"');
  await page.waitForSelector('.cola-card');
  check('cola abre com cartões', (await page.locator('.cola-card').count()) > 20);
  await page.click('.cola-card:nth-of-type(1) >> text=Inserir');
  check('inserir da cola coloca o código', (await text(page)).length > 20, JSON.stringify(await text(page)));

  check('sem erros no console', page.errors.length === 0, page.errors.join(' | '));
  await context.close();

  // --- no celular: modo de digitação e rolagem horizontal
  const phone = await open(browser, server.url, PHONE);
  await ready(phone.page);
  await phone.page.click('#code');
  check('celular: ao tocar no código o editor ganha a tela', (await phone.page.getAttribute('#app', 'class')).includes('typing'));
  check('celular: sem rolagem horizontal da página', await phone.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  check('celular: barra de teclas visível', await phone.page.isVisible('#keys'));
  check('celular: sem erros no console', phone.page.errors.length === 0, phone.page.errors.join(' | '));
  await phone.context.close();
} finally {
  await browser.close();
  await server.close();
}
