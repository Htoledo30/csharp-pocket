// Comandos de edição: formatar, copiar e a tecla Tab.
import { bus, toast } from './util.js';
import { code, setCode, setCursor } from './editor.js';
import { showTab } from './tabs.js';
import { formatSource } from './format.js';
import { indentLines } from './commands.js';

// Arruma o recuo e deixa o cursor no mesmo lugar do código (não volta para o topo).
// Devolve true se algo mudou.
export function formatCode({ quiet = false } = {}) {
  const src = code.value;
  const formatted = formatSource(src);
  if (formatted === src) {
    if (!quiet) toast('O código já está organizado');
    return false;
  }
  // Onde o cursor estava: "a N-ésima linha não vazia, tantos caracteres depois do recuo".
  const hadFocus = document.activeElement === code;
  const caret = code.selectionStart;
  const lineStart = src.lastIndexOf('\n', caret - 1) + 1;
  const lineEnd = src.indexOf('\n', lineStart) < 0 ? src.length : src.indexOf('\n', lineStart);
  const lineText = src.slice(lineStart, lineEnd);
  const column = Math.max(0, caret - lineStart - /^ */.exec(lineText)[0].length);
  const ordinal = src.slice(0, lineStart).split('\n').filter((l) => l.trim()).length;

  setCode(formatted, true);

  let index = 0, seen = 0, target = formatted.length;
  for (const line of formatted.split('\n')) {
    if (line.trim()) {
      if (seen === ordinal) { target = index + /^ */.exec(line)[0].length + Math.min(column, line.trim().length); break; }
      seen++;
    }
    index += line.length + 1;
  }
  setCursor(Math.min(target, formatted.length));
  if (!hadFocus) code.blur();      // não abrir o teclado do celular só porque se organizou o código
  if (!quiet) toast('Código organizado');
  return true;
}

export async function copyCode() {
  try {
    await navigator.clipboard.writeText(code.value);
    toast('Código copiado');
  } catch (e) {
    showTab('code');
    code.focus();
    code.select();
    toast('Texto selecionado: use Copiar do teclado');
  }
}

export function initEditing() {
  bus.on('editor:tab', (shift) => indentLines(shift));
  bus.on('format', () => formatCode());
}
