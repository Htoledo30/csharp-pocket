// Colorir o código: comentários, textos, números, palavras do C#, tipos e chamadas.
import { esc } from './util.js';

export const KEYWORDS = new Set(('abstract as async await base bool break byte case catch char checked class const continue decimal default delegate do double ' +
  'else enum event explicit extern false finally fixed float for foreach get global goto if implicit in init int interface internal is lock long ' +
  'nameof namespace new null object operator out override params partial private protected public readonly record ref required return sbyte sealed set short ' +
  'sizeof stackalloc static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using var virtual void volatile when where while with yield').split(' '));

// Grupos: 1 comentário · 2 texto/caractere · 3 número · 4 palavra
export const TOKEN = /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|("""[\s\S]*?(?:"""|$)|\$?@\$?"(?:[^"]|"")*(?:"|$)|\$?"(?:[^"\\\n]|\\.)*(?:"|$)|'(?:[^'\\\n]|\\.)+')|\b(0[xX][\da-fA-F_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?[fFdDmMuUlL]*)\b|\b([A-Za-z_]\w*)\b/g;

export function highlight(src) {
  let out = '', last = 0, m;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(src))) {
    out += esc(src.slice(last, m.index));
    const text = esc(m[0]);
    if (m[1]) out += '<span class="c">' + text + '</span>';
    else if (m[2]) out += '<span class="s">' + text + '</span>';
    else if (m[3]) out += '<span class="n">' + text + '</span>';
    else if (KEYWORDS.has(m[4])) out += '<span class="k">' + text + '</span>';
    else if (/^\s*\(/.test(src.slice(TOKEN.lastIndex, TOKEN.lastIndex + 8))) out += '<span class="f">' + text + '</span>';
    else if (/^[A-Z]/.test(m[4])) out += '<span class="t">' + text + '</span>';
    else out += text;
    last = TOKEN.lastIndex;
    if (m[0] === '') TOKEN.lastIndex++;
  }
  return out + esc(src.slice(last));
}

// O cursor está dentro de um texto ou comentário?
export function insideTextOrComment(src, pos) {
  TOKEN.lastIndex = 0;
  let m;
  while ((m = TOKEN.exec(src)) && m.index < pos) {
    const end = m.index + m[0].length;
    if ((m[1] || m[2]) && pos > m.index) {
      const closed = m[1] ? (m[0].startsWith('//') ? false : m[0].endsWith('*/')) : (m[0].length > 1 && /["']$/.test(m[0]));
      if (pos < end || (pos === end && !closed)) return true;
    }
    if (m[0] === '') TOKEN.lastIndex++;
  }
  return false;
}

// O código com comentários e textos trocados por um símbolo neutro (mantém posições e quebras de linha).
export function mask(src, filler = ' ') {
  return src.replace(TOKEN, (m, com, str) => (com ? m.replace(/[^\n]/g, filler) : str ? (m.length > 1 ? '"' + m.slice(1, -1).replace(/[^\n]/g, filler) + '"' : filler) : m));
}
