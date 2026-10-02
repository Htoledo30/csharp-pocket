// A "cola": modelos prontos de código por assunto, para inserir com um toque.
import { $, toast, bus } from './util.js';
import { highlight } from './highlight.js';
import { code, setCursor, insert, lineStartOf, lineEndOf } from './editor.js';
import { showTab } from './tabs.js';

let data = null, built = false;

async function load() {
  if (data !== null) return data;
  try {
    const res = await fetch('examples/cola.txt');
    data = res.ok ? await res.text() : '';
  } catch (e) { data = ''; }
  return data;
}

function build(text) {
  const body = $('colaBody');
  body.textContent = '';
  let group = null;
  for (const block of text.split(/\n(?=(?:===|---) )/)) {
    const first = block.split('\n')[0], rest = block.slice(first.length + 1).replace(/\n+$/, '');
    if (first.startsWith('=== ')) {
      const h = document.createElement('h3');
      h.textContent = first.slice(4);
      group = document.createElement('div');
      group.className = 'cola-group';
      body.append(h, group);
      continue;
    }
    if (!first.startsWith('--- ') || !group) continue;
    const [head, about] = first.slice(4).split(' | ');
    const atEnd = head.includes('@fim');
    const card = document.createElement('div');
    card.className = 'cola-card';
    const top = document.createElement('div');
    top.className = 'cola-top';
    const title = document.createElement('b');
    title.textContent = head.replace(' @fim', '');
    const use = document.createElement('button');
    use.className = 'mini strong';
    use.textContent = 'Inserir';
    use.addEventListener('click', () => insertSnippet(rest, atEnd));
    top.append(title, use);
    card.append(top);
    if (about) { const p = document.createElement('p'); p.textContent = about; card.append(p); }
    const pre = document.createElement('pre');
    pre.innerHTML = highlight(rest);
    card.append(pre);
    group.append(card);
  }
}

function insertSnippet(text, atEnd) {
  $('colaBack').hidden = true;
  bus.emit('editor:will-change');   // sai do passo a passo, se estiver nele
  showTab('code');
  const v = code.value;
  if (atEnd) {
    setCursor(v.length);
    insert((v.endsWith('\n\n') || !v ? '' : v.endsWith('\n') ? '\n' : '\n\n') + text + '\n');
  } else {
    const at = code.selectionStart;
    const lineStart = lineStartOf(at), lineEnd = lineEndOf(at);
    const current = v.slice(lineStart, lineEnd);
    const indent = /^[ \t]*/.exec(current)[0];
    const body = text.replace(/\n/g, '\n' + indent);
    if (current.trim() === '') { code.setSelectionRange(lineStart, lineEnd); insert(indent + body); }
    else { code.setSelectionRange(lineEnd, lineEnd); insert('\n' + indent + body); }
  }
  toast('Trecho inserido');
}

export async function openCola() {
  if (!built) { build(await load()); built = true; }
  $('colaBack').hidden = false;
  $('colaClose').focus();
}

export function initCola() {
  $('colaClose').addEventListener('click', () => { $('colaBack').hidden = true; });
  $('colaBack').addEventListener('click', (e) => { if (e.target === $('colaBack')) $('colaBack').hidden = true; });
}
