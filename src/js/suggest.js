// Sugestões enquanto você digita: depois do ponto (Console., lista.) e as palavras mais usadas.
// Duas fontes: o compilador (quando está livre) e uma lista pronta (data/completions.js) como apoio.
import { $, esc, bus } from './util.js';
import { TOKEN, insideTextOrComment } from './highlight.js';
import { code, scroller, lineHeight, charWidth, insert, posToLineCol, lineStartOf, addKeyHook, addInputHook } from './editor.js';
import { M, STATIC, INSTANCE, TYPE_KEY, SNIPPETS, COMMON_WORDS, NOT_A_TYPE } from './data/completions.js';

const gutter = $('gutter');
const acBox = $('ac');
export const ac = { open: false, items: [], index: 0, start: 0, member: false, moved: false };

// Lê o código para saber o que é cada variável e quais membros as classes deste arquivo têm.
export function scan(src) {
  const flat = src.replace(TOKEN, (m, com, str) => (com ? m.replace(/[^\n]/g, ' ') : str ? (m.length > 1 ? '"' + m.slice(1, -1).replace(/[^\n]/g, ' ') + '"' : ' ') : m));
  const vars = new Map(), types = new Map(), words = new Set();
  let m;
  const decl = /\b(string|int|double|float|decimal|long|short|byte|uint|bool|char|[A-Z]\w*)(<[^>;(){}]*>)?(\[[\s,]*\])?\s+([A-Za-z_]\w*)\s*(?==|;|,|\)|\bin\b)/g;
  while ((m = decl.exec(flat))) vars.set(m[4], m[3] ? 'array' : m[1]);
  const inferred = /\bvar\s+([A-Za-z_]\w*)\s*=\s*([^;\n]*)/g;
  while ((m = inferred.exec(flat))) {
    const init = m[2];
    let t = null, n;
    if ((n = /^new\s+([A-Za-z_]\w*)\s*[<({]/.exec(init))) t = n[1];
    else if (/^(new\s*\w*\s*\[|\[)/.test(init)) t = 'array';
    else if (/^\$?@?"/.test(init) || /^Console\.ReadLine\(\)\s*$/.test(init) || /\.(ToString|Trim|ToUpper|ToLower|Replace|Substring)\([^)]*\)\s*$/.test(init)) t = 'string';
    else if (/^Console\.ReadKey/.test(init)) t = 'ConsoleKeyInfo';
    else if (/^-?\d/.test(init) || /^(int|double|decimal|float|long)\.Parse/.test(init) || /^Convert\.To(Int32|Double|Decimal)/.test(init)) t = 'int';
    else if (/^DateTime\./.test(init)) t = 'DateTime';
    if (t) vars.set(m[1], t);
  }
  const typeDecl = /\b(class|struct|record|enum)\s+([A-Za-z_]\w*)/g;
  while ((m = typeDecl.exec(flat))) {
    const members = [], seen = new Set();
    const add = (name, call) => { if (!seen.has(name)) { seen.add(name); members.push(M(name, call ? name + '(|)' : name, call ? 'método' : '')); } };
    const open = flat.indexOf('{', m.index), semi = flat.indexOf(';', m.index);
    const head = flat.slice(m.index, open < 0 ? flat.length : open);
    if (m[1] === 'record') {
      const list = /\(([^)]*)\)/.exec(head.split(';')[0]);
      if (list) for (const part of list[1].split(',')) { const name = /([A-Za-z_]\w*)\s*$/.exec(part.trim()); if (name) add(name[1], false); }
    }
    if (open >= 0 && (semi < 0 || open < semi || m[1] !== 'record')) {
      let depth = 0, body = '', i = open;
      for (; i < flat.length; i++) {
        const ch = flat[i];
        if (ch === '{') { depth++; if (depth === 2) body += '{'; continue; }
        if (ch === '}') { depth--; if (depth === 1) body += '}'; if (depth === 0) break; continue; }
        if (depth === 1) body += ch;
      }
      if (m[1] === 'enum') {
        for (const part of body.split(',')) { const name = /^\s*([A-Za-z_]\w*)/.exec(part); if (name) add(name[1], false); }
      } else {
        const member = /([\w<>\[\],.?]+)\s+([A-Za-z_]\w*)\s*(\(|\{|=>|=|;)/g;
        let d;
        while ((d = member.exec(body))) if (!NOT_A_TYPE.has(d[1]) && d[2] !== m[2]) add(d[2], d[3] === '(');
      }
    }
    types.set(m[2], members);
  }
  const word = /[A-Za-z_]\w{2,}/g;
  while ((m = word.exec(flat))) words.add(m[0]);
  return { vars, types, words };
}

export function refreshSuggest() {
  if (code.selectionStart !== code.selectionEnd) return hideSuggest();
  const src = code.value, pos = code.selectionStart;
  const before = src.slice(Math.max(0, pos - 120), pos);
  const dotted = /([A-Za-z_]\w*)\.(\w*)$/.exec(before);
  const plain = dotted ? null : /(?:^|[^\w.])([A-Za-z_]\w+)$/.exec(before);
  if ((!dotted && !plain) || insideTextOrComment(src, pos)) return hideSuggest();
  const info = scan(src);
  let pool, prefix;
  if (dotted) {
    const owner = dotted[1];
    prefix = dotted[2];
    const declared = info.vars.get(owner);
    pool = declared ? (INSTANCE[TYPE_KEY[declared] || declared] || info.types.get(declared)) : (STATIC[owner] || info.types.get(owner));
    if (!pool) return hideSuggest();
  } else {
    prefix = plain[1];
    const seen = new Set(SNIPPETS.map((it) => it.l));
    pool = SNIPPETS.slice();
    for (const w of COMMON_WORDS.concat(Array.from(info.words))) if (!seen.has(w)) { seen.add(w); pool.push(M(w)); }
  }
  const low = prefix.toLowerCase();
  let items = pool.filter((it) => it.l.toLowerCase().startsWith(low) && (it.snip || it.l !== prefix));
  if (!dotted) {
    items.sort((a, b) => (b.snip && b.l === prefix ? 1 : 0) - (a.snip && a.l === prefix ? 1 : 0) || (b.l.startsWith(prefix) ? 1 : 0) - (a.l.startsWith(prefix) ? 1 : 0));
    items = items.slice(0, 8);
  }
  if (!items.length) return hideSuggest();
  showSuggest(items, pos - prefix.length, !!dotted);
}

// Mostra a lista, ancorada na posição `start` do texto.
export function showSuggest(items, start, member) {
  ac.items = items; ac.index = 0; ac.start = start; ac.member = member; ac.moved = false; ac.open = true;
  acBox.innerHTML = items.map((it, i) => '<div role="option" data-i="' + i + '" aria-selected="' + (i === 0) + '"><b>' + esc(it.l) + '</b>' + (it.d ? '<span>' + esc(it.d) + '</span>' : '') + '</div>').join('');
  acBox.hidden = false;
  const { line, col } = posToLineCol(start);
  const lh = lineHeight(), cw = charWidth();
  acBox.style.maxHeight = Math.max(88, Math.min(190, scroller.clientHeight - lh * 2 - 12)) + 'px';
  acBox.scrollTop = 0;
  const h = acBox.offsetHeight, w = acBox.offsetWidth;
  let top = 10 + line * lh + 2;
  if (top + h > scroller.scrollTop + scroller.clientHeight - 4 && 10 + (line - 1) * lh - h - 2 >= scroller.scrollTop) top = 10 + (line - 1) * lh - h - 2;
  const viewW = scroller.clientWidth - gutter.offsetWidth;
  const left = Math.max(scroller.scrollLeft + 4, Math.min(10 + (col - 1) * cw, scroller.scrollLeft + viewW - w - 6));
  acBox.style.top = top + 'px';
  acBox.style.left = left + 'px';
}

export function hideSuggest() {
  if (!ac.open) return;
  ac.open = false;
  acBox.hidden = true;
}

function moveSuggest(step) {
  const rows = acBox.children;
  rows[ac.index].setAttribute('aria-selected', 'false');
  ac.index = (ac.index + step + ac.items.length) % ac.items.length;
  ac.moved = true;
  const row = rows[ac.index];
  row.setAttribute('aria-selected', 'true');
  if (row.offsetTop < acBox.scrollTop) acBox.scrollTop = row.offsetTop - 3;
  else if (row.offsetTop + row.offsetHeight > acBox.scrollTop + acBox.clientHeight) acBox.scrollTop = row.offsetTop + row.offsetHeight - acBox.clientHeight + 3;
}

export function acceptSuggest(i) {
  const item = ac.items[i === undefined ? ac.index : i];
  const start = ac.start, end = code.selectionStart;
  hideSuggest();
  if (!item) return;
  const indent = /^[ \t]*/.exec(code.value.slice(lineStartOf(start), start))[0];
  let text = item.i.replace(/\n/g, '\n' + indent);
  const mark = text.indexOf('|');
  text = text.replace('|', '');
  // Não repetir um ponto e vírgula que já está lá.
  const after = code.value.slice(end, end + 1);
  if (text.endsWith(';') && after === ';') text = text.slice(0, -1);
  code.setSelectionRange(start, end);
  insert(text, mark >= 0 ? mark : text.length);
}

export function initSuggest() {
  acBox.addEventListener('pointerdown', (e) => e.preventDefault());
  acBox.addEventListener('click', (e) => { const row = e.target.closest('[data-i]'); if (row) acceptSuggest(Number(row.dataset.i)); });
  code.addEventListener('blur', hideSuggest);
  code.addEventListener('click', hideSuggest);
  scroller.addEventListener('scroll', () => { if (ac.open && acBox.matches(':hover') === false && document.activeElement !== code) hideSuggest(); });
  bus.on('edit', refreshSuggest);

  addInputHook((e) => {
    if ((e.inputType === 'insertLineBreak' || (e.inputType === 'insertText' && e.data === '\n'))) {
      if (ac.open && (ac.member || ac.moved)) { e.preventDefault(); acceptSuggest(); return true; }
      hideSuggest();
    }
    return false;
  });
  addKeyHook((e) => {
    if (!ac.open) return false;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); moveSuggest(e.key === 'ArrowDown' ? 1 : -1); return true; }
    if (e.key === 'Tab' || (e.key === 'Enter' && (ac.member || ac.moved))) { e.preventDefault(); acceptSuggest(); return true; }
    if (e.key === 'Escape') { e.preventDefault(); hideSuggest(); return true; }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End' || e.key === 'Enter') hideSuggest();
    return false;
  });
}
