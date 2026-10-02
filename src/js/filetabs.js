// As abas dos arquivos do programa aberto (Program.cs, Jogador.cs...). Um projeto pode ter vários.
import { $, bus, toast } from './util.js';
import { code, setCode, scroller } from './editor.js';
import { currentProject, setActiveFile, addFile, renameFile, removeFile, cleanFileName } from './projects.js';
import { countByFile, setActiveFileIndex } from './diagnostics.js';
import { askText, confirmDialog, chooseAction } from './dialog.js';

export function renderTabs() {
  const bar = $('ftabs');
  bar.textContent = '';
  const p = currentProject();
  if (!p) return;
  bar.classList.toggle('single', p.files.length === 1);
  p.files.forEach((f, i) => {
    const b = document.createElement('button');
    b.className = 'ftab';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(i === p.active));
    b.title = i === p.active ? 'Toque de novo para renomear ou apagar' : f.name;
    b.textContent = f.name;
    if (countByFile(i) > 0) {
      const dot = document.createElement('i');
      dot.className = 'err';
      dot.title = 'Tem erros';
      dot.textContent = ' ●';
      b.append(dot);
    }
    b.addEventListener('click', () => (i === p.active ? fileMenu(i) : switchFile(i)));
    bar.append(b);
  });
  const add = document.createElement('button');
  add.className = 'ftab add';
  add.id = 'fileAdd';
  add.setAttribute('aria-label', 'Novo arquivo');
  add.title = 'Novo arquivo (uma classe por arquivo)';
  add.textContent = '+';
  add.addEventListener('click', newFile);
  bar.append(add);
  const on = bar.querySelector('[aria-selected="true"]');
  if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  code.setAttribute('aria-label', p.files[p.active] ? p.files[p.active].name : 'Program.cs');
}

export function switchFile(index, { keepCaret = false } = {}) {
  const p = currentProject();
  if (!p || !setActiveFile(index)) return;
  setCode(p.files[index].code);
  if (!keepCaret) { scroller.scrollTop = 0; scroller.scrollLeft = 0; code.setSelectionRange(0, 0); }
  setActiveFileIndex(index);
  renderTabs();
  bus.emit('file:switched', index);
}

const stem = (name) => name.replace(/\.cs$/i, '');
const identifier = (name) => (/^[A-Za-z_]\w*$/.test(stem(name)) ? stem(name) : 'Classe');

async function newFile() {
  const p = currentProject();
  if (!p) return;
  const name = await askText({
    title: 'Novo arquivo',
    label: 'Nome do arquivo (por exemplo, Jogador)',
    ok: 'Criar',
    check: (value) => (cleanFileName(value, p) ? '' : 'Use letras e números, sem espaços, e um nome que ainda não existe.'),
  });
  if (!name) return;
  const clean = cleanFileName(name, p);
  const index = addFile(clean, 'class ' + identifier(clean) + '\n{\n    \n}\n');
  if (index < 0) return;
  switchFile(index);
  code.focus();
  toast(clean + ' criado');
}

async function fileMenu(index) {
  const p = currentProject();
  const file = p.files[index];
  const actions = [{ id: 'rename', label: 'Renomear' }];
  if (p.files.length > 1) actions.push({ id: 'delete', label: 'Apagar este arquivo', danger: true });
  const choice = await chooseAction({ title: file.name, actions });
  if (choice === 'rename') {
    const name = await askText({
      title: 'Renomear arquivo', label: 'Novo nome', value: stem(file.name), ok: 'Renomear',
      check: (value) => (cleanFileName(value, p, index) ? '' : 'Use letras e números, sem espaços, e um nome que ainda não existe.'),
    });
    if (name && renameFile(index, name)) renderTabs();
  } else if (choice === 'delete') {
    const ok = await confirmDialog({ title: 'Apagar arquivo', text: 'Apagar "' + file.name + '"? Isso não pode ser desfeito.', ok: 'Apagar', danger: true });
    if (ok && removeFile(index)) switchFile(currentProject().active);
  }
}

export function initFileTabs() {
  bus.on('diagnostics:changed', renderTabs);
  bus.on('projects:changed', () => { /* os nomes só mudam por aqui; o resto é pelo editor */ });
}
