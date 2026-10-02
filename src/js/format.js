// Ajusta o recuo pelas chaves. Textos e comentários são mascarados para as chaves deles não contarem.
import { TOKEN } from './highlight.js';

export function formatSource(input) {
  const src = input.replace(/\t/g, '    ');
  const masked = src.replace(TOKEN, (m, com, str) => (com || str) ? m.replace(/[^\n]/g, '_') : m);
  const lines = src.split('\n'), shape = masked.split('\n');
  const out = [];
  const stack = [];            // uma entrada por chave aberta: é o corpo de um switch?
  let pendingSwitch = false, hang = 0, blank = 0, verbatim = false;
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i].trim(), sh = shape[i].trim();
    if (verbatim) {            // dentro de um texto ou comentário de várias linhas: deixar a linha como está
      out.push(lines[i].replace(/\s+$/, ''));
      verbatim = /^_+$/.test(sh) || (sh.endsWith('_') && lines[i + 1] !== undefined && /^\s*_/.test(shape[i + 1]) && !/[;{})]/.test(sh));
      continue;
    }
    if (!text) { if (++blank <= 1 && out.length) out.push(''); continue; }
    blank = 0;
    let depth = stack.length;
    const closes = /^[}\])]/.test(sh);
    if (closes && depth) depth--;
    const inSwitch = stack.length && stack[stack.length - 1] && !closes;
    const label = /^(case\b.*|default\s*):/.test(sh);
    let level = depth + (inSwitch && !label ? 1 : 0);
    if (hang && !sh.startsWith('{')) level += 1;
    out.push(' '.repeat(4 * level) + text);
    hang = 0;
    let opensSwitch = pendingSwitch || /^switch\b/.test(sh);
    for (const ch of sh) {
      if (ch === '{') { stack.push(opensSwitch); opensSwitch = false; pendingSwitch = false; }
      else if (ch === '}') stack.pop();
    }
    if (/^switch\b/.test(sh) && !sh.includes('{')) pendingSwitch = true;
    if (/^(if|for|foreach|while|else if)\b.*\)$/.test(sh) || /^else$/.test(sh)) hang = 1;
    verbatim = /_$/.test(sh) && lines[i + 1] !== undefined && /^_/.test(shape[i + 1].trim()) && /^[_\s]*$/.test(shape[i + 1]);
  }
  while (out.length && out[out.length - 1] === '') out.pop();
  return out.join('\n') + '\n';
}
