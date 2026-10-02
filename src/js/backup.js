// Exportar e importar programas: para guardar uma cópia, passar para outro aparelho ou abrir em outro programa.
//  - backup (.json): tudo, inclusive os arquivos que os programas gravaram; é o que o app lê de volta sem perder nada
//  - .zip: uma pasta por programa com os arquivos .cs (para abrir no Visual Studio, por exemplo)
//  - um programa só: o próprio .cs, ou um .zip se tiver vários arquivos
import { toast, bus } from './util.js';
import { allProjects, liveProjects, currentProject, mergeProjects, addImported, addFile, MAIN_FILE } from './projects.js';
import { loadFs, saveFs } from './fsstore.js';
import { makeZip, readZip, bytesToText } from './zip.js';
import { chooseAction } from './dialog.js';
import { openProject } from './projects-ui.js';
import { switchFile } from './filetabs.js';

const stamp = () => new Date().toISOString().slice(0, 10);
const safe = (name) => (String(name).replace(/[\\/:*?"<>|]+/g, '').trim() || 'programa').slice(0, 60);

// Celular e tablet: a folha de compartilhar (Salvar em Arquivos, AirDrop...). Computador: baixar direto.
const touchDevice = () => /iphone|ipad|android/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export async function deliver(blob, name) {
  const file = new File([blob], name, { type: blob.type || 'application/octet-stream' });
  if (touchDevice() && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return 'shared'; }
    catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
  return 'downloaded';
}

// ---------------------------------------------------------------- exportar
export async function buildBackup() {
  const projects = JSON.parse(JSON.stringify(allProjects()));
  const fs = {};
  for (const p of projects) {
    if (p.deleted) continue;
    const files = await loadFs(p.id);
    if (Object.keys(files).length) fs[p.id] = files;
  }
  return { app: 'csharp-pocket', version: 1, exported: Date.now(), projects, fs };
}

export async function exportBackup() {
  const json = JSON.stringify(await buildBackup());
  const result = await deliver(new Blob([json], { type: 'application/json' }), 'csharp-pocket-backup-' + stamp() + '.json');
  if (result !== 'cancelled') toast('Backup pronto');
}

function zipEntriesFor(project, prefix) {
  return project.files.map((f) => ({ name: prefix + f.name, data: f.code }));
}

export async function exportZipAll() {
  const entries = [];
  const used = new Set();
  for (const p of liveProjects()) {
    let folder = safe(p.name), n = 2;
    while (used.has(folder.toLowerCase())) folder = safe(p.name) + ' ' + n++;
    used.add(folder.toLowerCase());
    entries.push(...zipEntriesFor(p, folder + '/'));
  }
  if (!entries.length) { toast('Não há programas para exportar'); return; }
  const result = await deliver(makeZip(entries), 'csharp-pocket-' + stamp() + '.zip');
  if (result !== 'cancelled') toast('Arquivo .zip pronto');
}

export async function exportCurrent() {
  const p = currentProject();
  if (!p) return;
  const base = safe(p.name);
  if (p.files.length === 1) {
    const name = /\.cs$/i.test(p.files[0].name) && p.files[0].name !== MAIN_FILE ? p.files[0].name : base + '.cs';
    const result = await deliver(new Blob([p.files[0].code], { type: 'text/plain' }), name);
    if (result !== 'cancelled') toast('Arquivo pronto');
  } else {
    const result = await deliver(makeZip(zipEntriesFor(p, '')), base + '.zip');
    if (result !== 'cancelled') toast('Arquivo .zip pronto');
  }
}

// ---------------------------------------------------------------- importar
const isCs = (name) => /\.(cs|txt)$/i.test(name);
const stem = (name) => name.replace(/^.*\//, '').replace(/\.[^.]+$/, '');
const text = (bytes) => bytesToText(bytes).replace(/^﻿/, '').replace(/\r\n?/g, '\n').replace(/\t/g, '    ');

async function importBackup(data) {
  const result = mergeProjects(data.projects || []);
  let withFiles = 0;
  for (const id of result.ids) {
    const files = data.fs && data.fs[id];
    if (files && Object.keys(files).length) { await saveFs(id, files); withFiles++; }
  }
  bus.emit('projects:changed');
  toast(result.added + ' novo(s), ' + result.replaced + ' atualizado(s)' + (withFiles ? ', arquivos dos programas incluídos' : ''));
  return result;
}

// Grupos de arquivos .cs vindos de um .zip: uma pasta de primeiro nível = um programa.
function groupZip(entries, zipName) {
  const groups = new Map();
  for (const e of entries) {
    if (!isCs(e.name) || /(^|\/)(bin|obj)\//i.test(e.name)) continue;
    const parts = e.name.split('/');
    const folder = parts.length > 1 ? parts[0] : zipName;
    if (!groups.has(folder)) groups.set(folder, []);
    groups.get(folder).push({ name: parts[parts.length - 1], code: text(e.data) });
  }
  return groups;
}

export async function importFiles(fileList) {
  const loose = [];            // arquivos .cs soltos
  let opened = null, count = 0;
  for (const file of Array.from(fileList)) {
    const lower = file.name.toLowerCase();
    try {
      if (lower.endsWith('.json')) {
        const data = JSON.parse(await file.text());
        if (data && data.app === 'csharp-pocket') { await importBackup(data); count++; continue; }
        if (data && typeof data.code === 'string') { opened = addImported(data.name || stem(file.name), [{ name: MAIN_FILE, code: data.code }]) || opened; count++; continue; }
        toast('Este .json não é um backup do C# Pocket');
      } else if (lower.endsWith('.zip')) {
        const groups = groupZip(await readZip(await file.arrayBuffer()), stem(file.name));
        for (const [name, files] of groups) { opened = addImported(name, files) || opened; count++; }
        if (!groups.size) toast('Não achei arquivos .cs dentro do .zip');
      } else if (isCs(lower)) {
        loose.push({ name: lower.endsWith('.txt') ? stem(file.name) + '.cs' : file.name, code: text(new Uint8Array(await file.arrayBuffer())) });
      } else toast('Tipo de arquivo não suportado: ' + file.name);
    } catch (e) {
      toast('Não consegui ler ' + file.name);
    }
  }
  if (loose.length) {
    const here = currentProject();
    const choice = here ? await chooseAction({
      title: loose.length === 1 ? loose[0].name : loose.length + ' arquivos .cs',
      actions: [{ id: 'new', label: 'Abrir como programa novo' }, { id: 'add', label: 'Adicionar ao programa aberto' }],
    }) : 'new';
    if (choice === 'new') {
      opened = addImported(loose.length === 1 ? stem(loose[0].name) : 'Importado', loose) || opened;
      count++;
    } else if (choice === 'add') {
      let last = -1;
      for (const f of loose) {
        let name = f.name, n = 2;
        while (here.files.some((x) => x.name.toLowerCase() === name.toLowerCase())) name = stem(f.name) + n++ + '.cs';
        last = addFile(name, f.code);
      }
      if (last >= 0) switchFile(last);
      count++;
    }
  }
  if (opened) { openProject(opened.id); toast('Importado: ' + opened.name); }
  return count;
}

export function pickFilesToImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = '.cs,.zip,.json,.txt,text/plain,application/zip,application/json';
  input.style.display = 'none';
  input.addEventListener('change', async () => { if (input.files && input.files.length) await importFiles(input.files); input.remove(); });
  document.body.append(input);
  input.click();
}

// Colar um código da área de transferência como programa novo.
export async function importFromClipboard() {
  try {
    const clip = (await navigator.clipboard.readText()) || '';
    if (!clip.trim()) { toast('A área de transferência está vazia'); return; }
    const p = addImported('Colado', [{ name: MAIN_FILE, code: clip.replace(/\r\n?/g, '\n').replace(/\t/g, '    ') }]);
    openProject(p.id);
    toast('Código colado como programa novo');
  } catch (e) {
    toast('Não consegui ler a área de transferência');
  }
}

