// Os programas de exemplo abrem, compilam e funcionam (com respostas digitadas por um "jogador" automático).
import { startServer, startBrowser, open, ready, idle, screen, notes, check, DESKTOP } from './lib.mjs';

const server = await startServer({ isolated: true });
const browser = await startBrowser();

// Roda o programa aberto respondendo com answers(n, tela) sempre que ele pedir uma linha.
async function play(page, answers, limit = 80) {
  await page.click('#run');
  let given = 0;
  for (let i = 0; i < limit; i++) {
    const state = await (await page.waitForFunction(() => {
      const mode = document.getElementById('run').dataset.mode, t = document.getElementById('termState').textContent;
      return mode === 'run' && document.getElementById('status').dataset.state === 'ready' ? 'done' : t === 'esperando entrada' ? 'input' : false;
    }, null, { timeout: 30000 })).jsonValue();
    if (state === 'done') return { given, screen: await screen(page), notes: await notes(page) };
    await page.fill('#lineInput', String(answers(given++, await screen(page))));
    await page.keyboard.press('Enter');
  }
  await page.click('#run');
  return { given, screen: await screen(page), notes: await notes(page), forced: true };
}

const openExample = async (page, id) => {
  await page.click('#files');
  await page.click(`[data-ex="${id}"]`);
  await page.waitForFunction((x) => document.getElementById('filesBack').hidden, id);
  await page.waitForTimeout(300);
};

try {
  const { context, page } = await open(browser, server.url, DESKTOP);
  await ready(page);
  const noErrors = async (id) => {
    await page.waitForFunction(() => true);
    await page.waitForTimeout(1500);          // a análise ao digitar roda sozinha ao abrir
    return page.evaluate(() => document.querySelector('#ftabs .ftab .err') === null && document.querySelector('#gutter .e') === null);
  };

  for (const id of ['ola', 'nome', 'adivinhe', 'calculadora', 'forca', 'combate', 'labirinto', 'cobrinha', 'salvar', 'batalha']) {
    await openExample(page, id);
    check(id + ': abre sem erros marcados', await noErrors(id));
  }

  await openExample(page, 'adivinhe');
  let r = await play(page, (n) => (n === 0 ? 'abc' : 50));
  check('adivinhe: termina com acerto ou fim das tentativas', /Acertou|Acabaram/.test(r.screen) && /não é um número/.test(r.screen), r.screen);

  await openExample(page, 'calculadora');
  const script = ['+', '2', '3,5', '/', '1', '0', '/', '7', '2', 's'];
  r = await play(page, (n) => script[n]);
  check('calculadora: soma com vírgula e divisão', /2 \+ 3,5 = 5,5/.test(r.screen) && /dividir por zero/.test(r.screen) && /7 \/ 2 = 3,5/.test(r.screen) && /Até logo/.test(r.screen), r.screen);

  await openExample(page, 'forca');
  const alphabet = 'aeiorstnlcdmpuvgbfhqxzjkwy';
  r = await play(page, (n) => alphabet[n % alphabet.length]);
  check('forca: termina ganhando ou perdendo', /Você ganhou|Você perdeu/.test(r.screen), r.screen.slice(-120));

  await openExample(page, 'combate');
  r = await play(page, () => '1');
  check('combate: termina', /Vitória|labirinto\.\.\./.test(r.screen), r.screen.slice(-120));

  await openExample(page, 'batalha');
  const files = await page.$$eval('#ftabs .ftab:not(.add)', (e) => e.map((x) => x.textContent.replace(/\s*●$/, '').trim()).join(','));
  check('batalha: abre com 4 arquivos', files === 'Program.cs,Personagem.cs,Heroi.cs,Monstro.cs', files);
  r = await play(page, () => '1', 120);
  check('batalha: termina (vence ou cai)', /venceu todos|caiu no labirinto/.test(r.screen), r.screen.slice(-160));

  await openExample(page, 'salvar');
  await page.click('#run'); await idle(page);
  const first = await screen(page);
  await page.click('#run'); await idle(page);
  const second = await screen(page);
  const best = Number(/Recorde atual: (\d+)/.exec(first)[1]);
  const next = Number(/Recorde atual: (\d+)/.exec(second)[1]);
  check('salvar: o recorde guardado aparece na execução seguinte', next >= best && /Novo recorde|Não bateu/.test(first) && next > 0, first + ' || ' + second);

  // cobrinha em tempo real
  await openExample(page, 'cobrinha');
  await page.click('#run');
  await page.waitForSelector('#keyForm', { state: 'visible', timeout: 30000 });
  await page.waitForFunction(() => document.getElementById('screen').innerText.includes('Pontos: 0'), null, { timeout: 15000 });
  check('cobrinha: desenha o quadro', /\+-{10,}\+/.test(await screen(page)));
  await page.click('[data-key="ArrowDown"]');
  await page.waitForTimeout(400);
  await page.click('[data-key="Escape"]');
  await idle(page, 15000);
  check('cobrinha: Esc encerra o jogo', /Fim de jogo/.test(await screen(page)), (await screen(page)).slice(-100));

  check('sem erros no console', page.errors.length === 0, page.errors.join(' | '));
  await context.close();
} finally {
  await browser.close();
  await server.close();
}
