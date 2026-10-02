// O compilador ajudando enquanto se digita: erros sublinhados, sugestões, ajuda de parâmetros e consertos.
import { startServer, startBrowser, open, ready, idle, setCode, screen, check, typeInEditor, editorText, DESKTOP } from './lib.mjs';

const server = await startServer();
const browser = await startBrowser();
try {
  const { context, page } = await open(browser, server.url, DESKTOP);
  await ready(page);
  const waitFor = (fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout });

  // --- erros ao digitar
  await setCode(page, 'int x = "a";\nConsole.WriteLine(x);\n');
  await waitFor(() => document.querySelector('#gutter .e'));
  check('erro marcado na linha sem executar', (await page.textContent('#gutter .e')).trim() === '1');
  check('sublinhado do erro', (await page.locator('#marks i.sq.e').count()) >= 1);
  await page.click('#code'); await page.keyboard.press('Control+Home');
  await waitFor(() => !document.getElementById('problem').hidden);
  const strip = await page.textContent('#problem');
  check('faixa explica o erro em português', /texto|número inteiro/.test(strip), strip);
  check('oferece converter com int.Parse', /int\.Parse/.test(await page.textContent('#problemFixes')), await page.textContent('#problemFixes'));
  await page.click('#problemFixes button');
  check('conserto aplicado', (await editorText(page)).startsWith('int x = int.Parse("a");'), await editorText(page));

  // --- ponto e vírgula
  await setCode(page, 'int y = 5\nConsole.WriteLine(y);\n');
  await waitFor(() => document.querySelector('#gutter .e'));
  await page.click('#code'); await page.keyboard.press('Control+Home');
  await waitFor(() => !document.getElementById('problem').hidden);
  await page.click('#problemFixes button');
  check('ponto e vírgula colocado', (await editorText(page)).startsWith('int y = 5;'), await editorText(page));

  // --- nome digitado errado
  await setCode(page, 'Console.Writeline("oi");\n');
  await waitFor(() => document.querySelector('#gutter .e'));
  await page.click('#code'); await page.keyboard.press('Control+Home');
  await waitFor(() => !document.getElementById('problem').hidden);
  const fixes = await page.textContent('#problemFixes');
  check('sugere WriteLine', /WriteLine/.test(fixes), fixes);
  await page.click('#problemFixes button');
  check('corrige o nome', (await editorText(page)).startsWith('Console.WriteLine('), await editorText(page));

  // --- using que faltou
  await setCode(page, 'var sb = new StringBuilder();\nsb.Append("a");\nConsole.WriteLine(sb);\n');
  await waitFor(() => document.querySelector('#gutter .e'));
  await page.click('#code'); await page.keyboard.press('Control+Home');
  await waitFor(() => !document.getElementById('problem').hidden);
  check('oferece o using', /using System\.Text/.test(await page.textContent('#problemFixes')), await page.textContent('#problemFixes'));
  await page.click('#problemFixes button');
  await page.click('#run'); await idle(page);
  check('depois do using o programa roda', (await editorText(page)).startsWith('using System.Text;') && (await screen(page)).trim() === 'a', JSON.stringify(await editorText(page)) + ' => ' + JSON.stringify(await screen(page)));

  // --- sugestões do compilador depois do ponto
  await typeInEditor(page, '', { reset: 'string nome = "Ana";\nList<int> lista = new List<int>();\n' });
  let t0 = Date.now();
  await page.keyboard.type('nome.', { delay: 10 });
  await waitFor(() => !document.getElementById('ac').hidden);
  const first = Date.now() - t0;
  let rows = await page.$$eval('#ac [role=option] b', (els) => els.map((e) => e.textContent));
  check('nome. mostra membros do string', rows.includes('Length') && rows.includes('ToUpper'), rows.join(','));
  console.log('   latência da 1ª sugestão:', first, 'ms');
  await page.keyboard.type('Su');
  await page.waitForTimeout(500);
  rows = await page.$$eval('#ac [role=option] b', (els) => els.map((e) => e.textContent));
  check('filtra pelo que foi digitado', rows.includes('Substring') && !rows.includes('Length'), rows.join(','));
  await page.keyboard.press('Escape');
  await page.keyboard.type('\n');
  await page.keyboard.type('lista.');
  await waitFor(() => !document.getElementById('ac').hidden);
  rows = await page.$$eval('#ac [role=option] b', (els) => els.map((e) => e.textContent));
  check('lista. mostra Add e Count (e extensões do Linq)', rows.includes('Add') && rows.includes('Count') && rows.some((r) => ['Where', 'Select', 'Any'].includes(r)), rows.join(','));
  const detail = await page.$$eval('#ac [role=option]', (els) => els.map((e) => e.textContent).find((t) => /^.?Add/.test(t)));
  console.log('   exemplo:', detail);
  await page.keyboard.type('Add');
  await page.waitForTimeout(400);
  await page.keyboard.press('Tab');
  check('Tab aceita e coloca parênteses', /lista\.Add\(\)?/.test(await editorText(page)), await editorText(page));

  // --- ajuda dos parâmetros
  await typeInEditor(page, '', { reset: 'string s = "a,b";\n' });
  await page.keyboard.type('s.Split(');
  await waitFor(() => !document.getElementById('sig').hidden);
  const sigText = await page.textContent('#sig');
  check('mostra a assinatura de Split', /Split/.test(sigText), sigText);
  console.log('   assinatura:', sigText.replace(/\s+/g, ' '));
  await page.keyboard.type('"," , ');
  await page.waitForTimeout(700);
  check('parâmetro ativo avança com a vírgula', (await page.$$eval('#sig .sig-p.on', (e) => e.map((x) => x.textContent))).length === 1);

  // --- tipos do próprio programa
  await typeInEditor(page, '', { reset: 'var h = new Heroi();\nclass Heroi { public int Vida = 10; public void Curar(int n) { Vida += n; } }\n' });
  await page.click('#code'); await page.keyboard.press('Control+Home'); await page.keyboard.press('End'); await page.keyboard.press('Enter');
  await page.keyboard.type('h.');
  await waitFor(() => !document.getElementById('ac').hidden);
  rows = await page.$$eval('#ac [role=option] b', (els) => els.map((e) => e.textContent));
  check('h. mostra Vida e Curar da classe do usuário', rows.includes('Vida') && rows.includes('Curar'), rows.join(','));

  check('sem erros no console', page.errors.length === 0, page.errors.join(' | '));
  await context.close();
} finally {
  await browser.close();
  await server.close();
}
