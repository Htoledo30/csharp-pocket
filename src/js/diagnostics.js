// Os erros e avisos do compilador, por arquivo. Vêm de duas fontes: ao executar e ao digitar.
// Aqui ficam guardados e são desenhados no editor (linha marcada e sublinhado) para o arquivo que está aberto.
import { bus } from './util.js';
import { code, setLineMarks, setSquiggles } from './editor.js';
import { refine } from './data/errors.js';

let byFile = new Map();     // índice do arquivo -> lista de { severity, id, message, line, col, endLine, endCol, names }
let active = 0;

// Troca todos os erros pelos novos. `files` são os arquivos de que eles vieram. Dicas ("tip") não são sublinhadas.
export function setDiagnostics(list, files = []) {
  byFile = new Map();
  for (const raw of list) {
    const file = raw.file >= 0 ? raw.file : 0;
    const d = refine(raw, files[file] ? files[file].code : '');
    if (!byFile.has(file)) byFile.set(file, []);
    byFile.get(file).push(d);
  }
  apply();
  bus.emit('diagnostics:changed');
}

export function clearDiagnostics() {
  if (!byFile.size) return;
  byFile = new Map();
  apply();
  bus.emit('diagnostics:changed');
}

// O texto do arquivo mudou: o que se sabia dele já não vale.
export function dropFile(index) {
  if (byFile.delete(index)) bus.emit('diagnostics:changed');
}

export function setActiveFileIndex(index) {
  active = index;
  apply();
  bus.emit('diagnostics:changed');
}

export const diagnosticsOf = (index = active) => byFile.get(index) || [];
export const countByFile = (index) => diagnosticsOf(index).filter((d) => d.severity === 'error').length;
export const hasErrors = () => Array.from(byFile.values()).some((list) => list.some((d) => d.severity === 'error'));

export function apply() {
  const marks = new Map();
  const squiggles = [];
  const lines = code.value.split('\n');
  for (const d of diagnosticsOf(active)) {
    if (!d.line) continue;
    if (d.severity === 'error' || !marks.has(d.line)) marks.set(d.line, d.severity === 'error' ? 'error' : 'warning');
    if (d.severity === 'tip' || !d.col) continue;
    const text = lines[d.line - 1] || '';
    let len = d.endLine === d.line && d.endCol > d.col ? d.endCol - d.col : Math.max(1, text.length - d.col + 1);
    if (d.endLine && d.endLine > d.line) len = Math.max(1, text.length - d.col + 1);
    // Um erro de "faltou algo" não tem tamanho: sublinhar o caractere que vem logo depois.
    squiggles.push({ line: d.line, col: d.col, len: Math.max(1, len), sev: d.severity });
  }
  setLineMarks(marks);
  setSquiggles(squiggles);
}

// Ao editar, o que se sabia do arquivo aberto deixa de valer até a próxima análise.
export function initDiagnostics() {
  bus.on('edit', () => dropFile(active));
}
