// "Seus programas" nos Ajustes: exportar, importar, histórico e sincronização com o GitHub.
import { bus, toast } from './util.js';
import { addSettingsSection } from './settings-ui.js';
import { exportBackup, exportZipAll, exportCurrent, pickFilesToImport, importFromClipboard } from './backup.js';
import { openHistory, saveNamedVersion } from './history-ui.js';
import { isConnected, syncUser, connect, disconnect, syncNow, syncState, initSync } from './sync.js';

const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=gist&description=' + encodeURIComponent('C# Pocket');

function button(label, onClick, cls = 'mini') {
  const b = document.createElement('button');
  b.className = cls;
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

function group(...children) {
  const g = document.createElement('div');
  g.className = 'ex-list';
  g.append(...children);
  return g;
}

const note = (text) => { const p = document.createElement('p'); p.className = 'set-note'; p.textContent = text; return p; };
const heading = (text) => { const h = document.createElement('h3'); h.textContent = text; return h; };

function when(t) {
  if (!t) return '';
  const d = new Date(t);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function syncSection(body) {
  body.append(heading('Sincronizar com o GitHub'));
  const status = note('');
  const holder = document.createElement('div');
  holder.className = 'sync-box';
  const paint = () => {
    if (!status.isConnected) return;
    holder.textContent = '';
    if (isConnected()) {
      status.textContent = (syncState.status === 'error' ? 'Problema: ' : syncState.status === 'working' ? '' : 'Conectado como ' + syncUser() + '. ') + syncState.message + (syncState.last && syncState.status === 'idle' ? ' (' + when(syncState.last) + ')' : '');
      holder.append(group(
        button('Sincronizar agora', async () => { await syncNow(); paint(); }, 'mini strong'),
        button('Desconectar', () => { disconnect(); paint(); toast('Desconectado. Seus programas continuam neste aparelho.'); }),
      ));
    } else {
      status.textContent = syncState.status === 'error' ? 'Problema: ' + syncState.message : 'Seus programas ficam num arquivo secreto (gist) da sua conta do GitHub e aparecem em todos os aparelhos em que você conectar. O token só dá acesso a gists, não aos seus repositórios, e fica só neste aparelho.';
      const link = document.createElement('a');
      link.href = TOKEN_URL; link.target = '_blank'; link.rel = 'noopener';
      link.className = 'mini';
      link.textContent = '1. Criar o token no GitHub';
      const input = document.createElement('input');
      input.type = 'password'; input.placeholder = '2. Cole o token aqui'; input.autocomplete = 'off'; input.spellcheck = false;
      input.className = 'token-input';
      input.setAttribute('aria-label', 'Token do GitHub');
      const go = button('3. Conectar', async () => {
        go.disabled = true;
        try { await connect(input.value); toast('Conectado ao GitHub'); }
        catch (e) { toast(e && e.message ? e.message : 'Não foi possível conectar'); }
        go.disabled = false;
        paint();
      }, 'mini strong');
      holder.append(group(link), input, group(go));
    }
  };
  body.append(status, holder);
  paint();
  bus.on('sync:state', paint);
}

export function initDataUi() {
  addSettingsSection((body) => {
    body.append(group(
      button('Exportar backup (.json)', exportBackup),
      button('Exportar .zip com os .cs', exportZipAll),
      button('Exportar o programa aberto', exportCurrent),
    ));
    body.append(group(
      button('Importar arquivo…', pickFilesToImport, 'mini strong'),
      button('Colar como programa novo', importFromClipboard),
    ));
    body.append(note('O backup guarda tudo (programas e arquivos gravados por eles) e o app lê de volta sem perder nada. Também dá para importar .cs soltos e .zip.'));
    body.append(group(
      button('Histórico de versões', openHistory),
      button('Guardar uma versão', saveNamedVersion),
    ));
    syncSection(body);
  });
  initSync();
}
