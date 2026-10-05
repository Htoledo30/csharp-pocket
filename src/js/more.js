// O menu "Mais": todos os comandos do editor em botões grandes, fáceis de tocar.
import { $, bus, toast } from './util.js';
import { code, insert } from './editor.js';
import { openFind } from './find.js';
import { duplicateLines, deleteLines, moveLines, toggleComment, indentLines, selectLine, gotoLine, renameSymbol } from './commands.js';
import { openCola } from './cola.js';
import { formatCode, copyCode } from './editing.js';
import { openSettings } from './settings-ui.js';
import { openFiles } from './projects-ui.js';
import { openHistory, saveNamedVersion } from './history-ui.js';
import { exportCurrent, pickFilesToImport } from './backup.js';
import { changeFont } from './keybar.js';
import { toggleZen } from './zen.js';

async function paste() {
  try {
    const text = await navigator.clipboard.readText();
    if (text) { code.focus({ preventScroll: true }); insert(text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ')); } else toast('A área de transferência está vazia');
  } catch (e) {
    toast('Para colar, segure o dedo no código e toque em Colar');
  }
}

const GROUPS = [
  ['Procurar', [
    ['Buscar', () => openFind()],
    ['Buscar e trocar', () => openFind({ replace: true })],
    ['Ir para a linha', gotoLine],
    ['Renomear nome', renameSymbol],
  ]],
  ['Linhas', [
    ['Duplicar linha', duplicateLines],
    ['Apagar linha', deleteLines],
    ['Subir linha', () => moveLines(-1)],
    ['Descer linha', () => moveLines(1)],
    ['Comentar / tirar //', toggleComment],
    ['Selecionar linha', selectLine],
    ['Selecionar tudo', () => { code.focus({ preventScroll: true }); code.select(); }],
    ['Avançar (recuo)', () => indentLines(false)],
    ['Voltar (recuo)', () => indentLines(true)],
  ]],
  ['Texto', [
    ['Formatar o código', formatCode],
    ['Copiar tudo', copyCode],
    ['Colar', paste],
    ['Cola de C#', openCola],
    ['Código em tela cheia', toggleZen],
    ['Letra maior', () => changeFont(1)],
    ['Letra menor', () => changeFont(-1)],
  ]],
  ['Programa', [
    ['Meus programas', openFiles],
    ['Novo arquivo (classe)', () => { const b = document.getElementById('fileAdd'); if (b) b.click(); }],
    ['Histórico de versões', openHistory],
    ['Guardar uma versão', saveNamedVersion],
    ['Exportar este programa', exportCurrent],
    ['Importar arquivo…', pickFilesToImport],
    ['Ajustes e sincronização', openSettings],
  ]],
];

export function openMore() {
  const back = document.createElement('div');
  back.className = 'modal-back';
  const box = document.createElement('div');
  box.className = 'modal wide';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.innerHTML = '<div class="modal-head"><h2>Mais ações</h2><button class="mini" id="moreClose">Fechar</button></div><div class="modal-body"></div>';
  const body = box.querySelector('.modal-body');
  const close = () => back.remove();
  for (const [title, items] of GROUPS) {
    const h = document.createElement('h3');
    h.textContent = title;
    const grid = document.createElement('div');
    grid.className = 'tile-grid';
    for (const [label, run] of items) {
      const b = document.createElement('button');
      b.className = 'tile';
      b.textContent = label;
      b.addEventListener('click', () => { close(); setTimeout(() => run(), 0); });
      grid.append(b);
    }
    body.append(h, grid);
  }
  back.append(box);
  document.body.append(back);
  box.querySelector('#moreClose').addEventListener('click', close);
  back.addEventListener('click', (e) => { if (e.target === back) close(); });
  back.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  box.querySelector('#moreClose').focus();
}

export function initMore() {
  // O botão "Mais" vive na barra de ações (actionbar.js), que chama openMore.
}
