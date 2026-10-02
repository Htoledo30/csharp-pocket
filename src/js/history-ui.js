// A janela "Histórico": versões guardadas do programa aberto; ver e restaurar.
import { toast } from './util.js';
import { highlight } from './highlight.js';
import { currentProject, replaceFiles } from './projects.js';
import { addVersion, listVersions } from './history.js';
import { openProject } from './projects-ui.js';
import { askText } from './dialog.js';

const ago = (t) => {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'agora há pouco';
  if (s < 3600) return 'há ' + Math.floor(s / 60) + ' min';
  if (s < 86400) return 'há ' + Math.floor(s / 3600) + ' h';
  const d = new Date(t);
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
};

export async function saveNamedVersion() {
  const p = currentProject();
  if (!p) return;
  const name = await askText({ title: 'Guardar versão', label: 'Nome da versão (por exemplo, "antes do chefe")', ok: 'Guardar' });
  if (name === null) return;
  await addVersion(p, name || 'Versão guardada', { force: true });
  toast('Versão guardada');
}

export async function openHistory() {
  const p = currentProject();
  if (!p) return;
  const versions = await listVersions(p.id);
  const back = document.createElement('div');
  back.className = 'modal-back';
  const box = document.createElement('div');
  box.className = 'modal wide';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.innerHTML = '<div class="modal-head"><h2>Histórico</h2><button class="mini" id="histClose">Fechar</button></div><div class="modal-body"></div>';
  const body = box.querySelector('.modal-body');
  const close = () => back.remove();
  back.append(box);
  document.body.append(back);
  box.querySelector('#histClose').addEventListener('click', close);
  back.addEventListener('click', (e) => { if (e.target === back) close(); });
  back.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  const showList = () => {
    body.textContent = '';
    const save = document.createElement('button');
    save.className = 'btn new';
    save.textContent = 'Guardar uma versão agora';
    save.addEventListener('click', async () => { await saveNamedVersion(); close(); openHistory(); });
    body.append(save);
    if (!versions.length) {
      const none = document.createElement('p');
      none.className = 'set-note';
      none.textContent = 'Ainda não há versões. O app guarda uma sozinho ao executar, de tempos em tempos e ao trocar de programa.';
      body.append(none);
      return;
    }
    const list = document.createElement('div');
    list.className = 'file-list';
    for (const v of versions) {
      const row = document.createElement('div');
      row.className = 'file';
      const open = document.createElement('button');
      open.className = 'open';
      const title = document.createElement('b');
      title.textContent = v.label;
      const meta = document.createElement('span');
      const lines = v.files.reduce((n, f) => n + (f.code ? f.code.replace(/\n+$/, '').split('\n').length : 0), 0);
      meta.textContent = ago(v.t) + ' · ' + lines + (lines === 1 ? ' linha' : ' linhas') + (v.files.length > 1 ? ' · ' + v.files.length + ' arquivos' : '');
      open.append(title, meta);
      open.addEventListener('click', () => showVersion(v));
      row.append(open);
      list.append(row);
    }
    body.append(list);
  };

  const showVersion = (v) => {
    body.textContent = '';
    let which = Math.min(v.active || 0, v.files.length - 1);
    const bar = document.createElement('div');
    bar.className = 'cola-top';
    const back = document.createElement('button');
    back.className = 'mini'; back.textContent = 'Voltar';
    back.addEventListener('click', showList);
    const restore = document.createElement('button');
    restore.className = 'mini strong'; restore.textContent = 'Restaurar esta versão';
    restore.addEventListener('click', async () => {
      await addVersion(currentProject(), 'Antes de restaurar', { force: true });
      replaceFiles(p.id, v.files, v.active || 0);
      openProject(p.id, true);
      close();
      toast('Versão restaurada');
    });
    bar.append(back, restore);
    const head = document.createElement('p');
    head.className = 'set-note';
    head.textContent = v.label + ' · ' + ago(v.t);
    const tabs = document.createElement('div');
    tabs.className = 'ex-list';
    const pre = document.createElement('pre');
    pre.className = 'hist-code';
    const draw = () => {
      pre.innerHTML = highlight(v.files[which].code || '');
      for (const b of tabs.children) b.setAttribute('aria-pressed', String(Number(b.dataset.i) === which));
    };
    v.files.forEach((f, i) => {
      if (v.files.length < 2) return;
      const b = document.createElement('button');
      b.className = 'mini'; b.dataset.i = String(i); b.textContent = f.name;
      b.addEventListener('click', () => { which = i; draw(); });
      tabs.append(b);
    });
    body.append(bar, head, tabs, pre);
    draw();
  };

  showList();
  box.querySelector('#histClose').focus();
}
