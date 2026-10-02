// A dica embaixo do editor: explica em português a palavra (ou o sinal) onde o cursor está.
import { $ } from './util.js';
import { highlight, insideTextOrComment } from './highlight.js';
import { code } from './editor.js';
import { HELP, OPS } from './data/help.js';

const hintBox = $('hint'), hintCard = $('hintCard'), hintBtn = $('hintBtn');
let hintKey = '';

function helpAtCaret() {
  if (code.selectionStart !== code.selectionEnd) return '';
  const v = code.value, pos = code.selectionStart;
  let a = pos, b = pos;
  while (a > 0 && /\w/.test(v[a - 1])) a--;
  while (b < v.length && /\w/.test(v[b])) b++;
  if (b > a) {
    if (insideTextOrComment(v, a + 1)) return '';
    const word = v.slice(a, b);
    if (v[a - 1] === '.' && HELP['.' + word]) return '.' + word;
    return HELP[word] && v[a - 1] !== '.' ? word : '';
  }
  for (let start = pos - 2; start <= pos; start++) {
    const two = v.slice(start, start + 2);
    if (start >= 0 && OPS.includes(two)) return insideTextOrComment(v, start + 1) ? '' : two;
  }
  for (const at of [pos - 1, pos]) {
    if (v[at] === '%' || (v[at] === '!' && v[at + 1] !== '=')) return insideTextOrComment(v, at + 1) ? '' : v[at];
  }
  return '';
}

export function updateHint() {
  const key = document.activeElement === code ? helpAtCaret() : hintKey;
  if (key === hintKey) return;
  hintKey = key;
  hintCard.hidden = true;
  hintBtn.setAttribute('aria-expanded', 'false');
  hintBtn.querySelector('i').textContent = 'exemplo';
  if (!key) { hintBox.hidden = true; return; }
  const [title, text, sample] = HELP[key];
  $('hintWord').textContent = title;
  $('hintText').textContent = text;
  $('hintFull').textContent = text;
  $('hintCode').innerHTML = highlight(sample);
  hintBox.hidden = false;
}

export function clearHint() {
  hintKey = '';
  hintBox.hidden = true;
}

export function initHints() {
  hintBtn.addEventListener('pointerdown', (e) => e.preventDefault());
  hintBtn.addEventListener('click', () => {
    hintCard.hidden = !hintCard.hidden;
    hintBtn.setAttribute('aria-expanded', String(!hintCard.hidden));
    hintBtn.querySelector('i').textContent = hintCard.hidden ? 'exemplo' : 'fechar';
  });
  hintCard.addEventListener('pointerdown', (e) => e.preventDefault());
  for (const type of ['keyup', 'click', 'input', 'focus']) code.addEventListener(type, updateHint);
}
