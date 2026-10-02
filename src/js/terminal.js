// O terminal: recebe o que o programa escreve (texto, cores, cursor, limpar a tela) e desenha em linhas.
import { $, esc } from './util.js';
import { charWidth, lineHeight } from './editor.js';

export const screen = $('screen'), notes = $('notes'), termScroll = $('termScroll');

// Ordem do ConsoleColor. O preto é o próprio fundo do terminal.
const PALETTE = ['', '#5b8cff', '#3fae6a', '#35a9b8', '#d9596b', '#b071d9', '#c9a23f', '', '#7d7896', '#8fb4ff', '#74dd9c', '#6fe0ec', '#ff8a99', '#dba4ff', '#f4d875', '#ffffff'];
const ANSI = [0, 4, 2, 6, 1, 5, 3, 7];
const MAX_ROWS = 1500;

export const term = {
  rows: [], x: 0, y: 0, fg: 7, bg: 0, dirty: new Set(), frame: 0, carry: '', stick: false,
  row(i) {
    while (this.rows.length <= i) {
      const el = document.createElement('div');
      screen.appendChild(el);
      this.rows.push({ ch: [], at: [], el });
    }
    return this.rows[i];
  },
  reset() {
    this.rows = []; this.x = 0; this.y = 0; this.fg = 7; this.bg = 0; this.carry = '';
    this.dirty.clear();
    screen.textContent = '';
    screen.style.background = '';
    $('termTitle').textContent = 'Terminal';
  },
  clear() {
    this.rows = []; this.x = 0; this.y = 0; this.dirty.clear();
    screen.textContent = '';
    screen.style.background = this.bg ? PALETTE[this.bg] : '';
  },
  put(c) {
    const r = this.row(this.y);
    while (r.ch.length < this.x) { r.ch.push(' '); r.at.push(7); }
    r.ch[this.x] = c; r.at[this.x] = this.fg | (this.bg << 4);
    this.x++;
    this.dirty.add(r);
  },
  newline() {
    this.row(this.y);
    this.y++; this.x = 0;
    this.row(this.y);
    if (this.rows.length > MAX_ROWS) {
      const cut = this.rows.splice(0, this.rows.length - MAX_ROWS);
      for (const r of cut) { r.el.remove(); this.dirty.delete(r); }
      this.y -= cut.length;
    }
  },
  sgr(params) {
    const p = params.length ? params : [0];
    for (let i = 0; i < p.length; i++) {
      const n = p[i];
      if (n === 0) { this.fg = 7; this.bg = 0; }
      else if (n === 1) { if (this.fg < 8) this.fg += 8; }
      else if (n >= 30 && n <= 37) this.fg = ANSI[n - 30];
      else if (n === 39) this.fg = 7;
      else if (n >= 40 && n <= 47) this.bg = ANSI[n - 40];
      else if (n === 49) this.bg = 0;
      else if (n >= 90 && n <= 97) this.fg = ANSI[n - 90] + 8;
      else if (n >= 100 && n <= 107) this.bg = ANSI[n - 100] + 8;
      else if ((n === 38 || n === 48) && p[i + 1] === 5) {
        const c = p[i + 2];
        if (c >= 0 && c < 16) { const v = ANSI[c % 8] + (c >= 8 ? 8 : 0); if (n === 38) this.fg = v; else this.bg = v; }
        i += 2;
      } else if ((n === 38 || n === 48) && p[i + 1] === 2) i += 4;
    }
  },
  write(data) {
    const stick = termScroll.scrollTop + termScroll.clientHeight >= termScroll.scrollHeight - 30;
    const s = this.carry + data;
    this.carry = '';
    let i = 0;
    const n = s.length;
    while (i < n) {
      const c = s[i];
      if (c === '\n') { this.newline(); i++; }
      else if (c === '\r') { this.x = 0; i++; }
      else if (c === '\b') { if (this.x > 0) this.x--; i++; }
      else if (c === '\t') { const to = (Math.floor(this.x / 8) + 1) * 8; while (this.x < to) this.put(' '); i++; }
      else if (c === '\x07') { beep(); i++; }
      else if (c === '\x1b') {
        if (i + 1 >= n) { this.carry = s.slice(i); break; }
        if (s[i + 1] === '[') {
          let j = i + 2;
          while (j < n && !(s[j] >= '@' && s[j] <= '~')) j++;
          if (j >= n) { this.carry = s.slice(i); break; }
          const params = s.slice(i + 2, j).replace(/^\?/, '').split(';').map((v) => parseInt(v, 10)).map((v) => (isNaN(v) ? 0 : v));
          const fin = s[j];
          if (fin === 'p') this.fg = params[0] & 15;
          else if (fin === 'q') this.bg = params[0] & 15;
          else if (fin === 'm') this.sgr(s.slice(i + 2, j) === '' ? [] : params);
          else if (fin === 'J') { if (params[0] === 2 || params[0] === 3) this.clear(); }
          else if (fin === 'H' || fin === 'f') { this.y = Math.max(0, (params[0] || 1) - 1); this.x = Math.max(0, (params[1] || 1) - 1); this.row(this.y); }
          else if (fin === 'K') { const r = this.row(this.y); r.ch.length = Math.min(r.ch.length, this.x); r.at.length = r.ch.length; this.dirty.add(r); }
          else if (fin === 'A') this.y = Math.max(0, this.y - (params[0] || 1));
          else if (fin === 'B') { this.y += params[0] || 1; this.row(this.y); }
          else if (fin === 'C') this.x += params[0] || 1;
          else if (fin === 'D') this.x = Math.max(0, this.x - (params[0] || 1));
          i = j + 1;
        } else if (s[i + 1] === ']') {
          const end = s.indexOf('\x07', i);
          if (end < 0) { this.carry = s.slice(i); break; }
          const body = s.slice(i + 2, end);
          if (body.startsWith('0;')) $('termTitle').textContent = body.slice(2) || 'Terminal';
          i = end + 1;
        } else i += 2;
      } else {
        const cp = s.codePointAt(i);
        const chr = cp > 0xffff ? String.fromCodePoint(cp) : c;
        this.put(chr);
        i += chr.length;
      }
    }
    this.schedule(stick);
  },
  schedule(stick) {
    if (stick) this.stick = true;
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      for (const r of this.dirty) r.el.innerHTML = renderRow(r);
      this.dirty.clear();
      if (this.stick) termScroll.scrollTop = termScroll.scrollHeight;
      this.stick = false;
    });
  },
};

// Blocos (█ ▓ ▒ ░ ▀ ▄...): ganham um contorno fininho para não aparecer fresta entre as células.
const BLOCKS = /[▀-▟]+/g;

function renderRow(r) {
  let html = '', run = '', attr = 7;
  const flushRun = () => {
    if (!run) return;
    const fg = attr & 15, bg = attr >> 4;
    const text = esc(run).replace(BLOCKS, (m) => '<span class="blk">' + m + '</span>');
    if (attr === 7) html += text;
    else html += '<span style="' + (PALETTE[fg] ? 'color:' + PALETTE[fg] + ';' : fg === 0 ? 'color:#0c0a12;' : '') + (bg ? 'background:' + PALETTE[bg] : '') + '">' + text + '</span>';
    run = '';
  };
  for (let i = 0; i < r.ch.length; i++) {
    if (r.at[i] !== attr) { flushRun(); attr = r.at[i]; }
    run += r.ch[i];
  }
  flushRun();
  return html;
}

let audio = null;
export function beep() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audio.createOscillator(), gain = audio.createGain();
    osc.frequency.value = 800; gain.gain.value = 0.06;
    osc.connect(gain).connect(audio.destination);
    osc.start(); osc.stop(audio.currentTime + 0.12);
  } catch (e) { /* sem som disponível */ }
}

// Mensagem fora do programa: avisos, erros, "Programa encerrado".
export function note(kind, html) {
  const el = document.createElement('div');
  el.className = 'note ' + kind;
  el.innerHTML = html;
  notes.appendChild(el);
  termScroll.scrollTop = termScroll.scrollHeight;
  return el;
}

export function scrollEnd() { termScroll.scrollTop = termScroll.scrollHeight; }

// Quantas colunas e linhas cabem no terminal agora (o programa vê isso em Console.WindowWidth/Height).
export function termSize() {
  const cw = charWidth(), lh = lineHeight();
  const w = termScroll.clientWidth - 24, h = termScroll.clientHeight - 24;
  return { cols: w > 80 ? Math.max(20, Math.floor(w / cw)) : 80, rows: h > 60 ? Math.max(8, Math.floor(h / lh)) : 24 };
}
