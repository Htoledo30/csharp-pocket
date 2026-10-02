// Comandos de edição: recuar, formatar, copiar.
import { $, bus, toast } from './util.js';
import { code, insert, setCode, lineStartOf } from './editor.js';
import { showTab } from './tabs.js';
import { formatSource } from './format.js';
import { indentLines } from './commands.js';

export function outdent() {
  const v = code.value, a = code.selectionStart;
  const lineStart = lineStartOf(a);
  const lead = /^ {1,4}/.exec(v.slice(lineStart));
  if (!lead) return;
  code.setSelectionRange(lineStart, lineStart + lead[0].length);
  insert('');
  code.setSelectionRange(Math.max(lineStart, a - lead[0].length), Math.max(lineStart, a - lead[0].length));
}

export function formatCode() {
  const formatted = formatSource(code.value);
  if (formatted !== code.value) setCode(formatted, true);
  toast('Indentação ajustada');
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
  bus.on('format', formatCode);
  $('format').addEventListener('click', formatCode);
  $('copy').addEventListener('click', copyCode);
}
