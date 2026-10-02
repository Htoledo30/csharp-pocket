// Conserto com um toque: para os erros mais comuns, devolve o que mudar no código.
// Cada conserto: { label, from, to, text } = trocar o trecho [from, to) do arquivo por `text`.
import { lineColToPos } from './editor.js';
import { q } from './data/errors.js';

// Tipos que costumam faltar um "using" (o resto do .NET que o app já importa sozinho: System, System.IO, Linq, Collections.Generic, Threading).
const USING_FOR = {
  StringBuilder: 'System.Text', Encoding: 'System.Text', Regex: 'System.Text.RegularExpressions', Match: 'System.Text.RegularExpressions',
  MatchCollection: 'System.Text.RegularExpressions', Stopwatch: 'System.Diagnostics', Debug: 'System.Diagnostics', Process: 'System.Diagnostics',
  BigInteger: 'System.Numerics', Complex: 'System.Numerics', Vector2: 'System.Numerics', Vector3: 'System.Numerics',
  CultureInfo: 'System.Globalization', NumberStyles: 'System.Globalization', JsonSerializer: 'System.Text.Json', JsonSerializerOptions: 'System.Text.Json',
  JsonDocument: 'System.Text.Json', ObservableCollection: 'System.Collections.ObjectModel', ReadOnlyCollection: 'System.Collections.ObjectModel',
  ConcurrentDictionary: 'System.Collections.Concurrent', ConcurrentQueue: 'System.Collections.Concurrent', ConcurrentBag: 'System.Collections.Concurrent',
  ArrayList: 'System.Collections', Hashtable: 'System.Collections', CallerMemberName: 'System.Runtime.CompilerServices',
  DescriptionAttribute: 'System.ComponentModel', Marshal: 'System.Runtime.InteropServices',
};

const SIMPLE = /^[\w.]+$/;
const wrap = (text) => (SIMPLE.test(text) ? text : '(' + text + ')');
const PARSEABLE = ['int', 'long', 'double', 'float', 'decimal', 'short', 'byte', 'bool'];
const WHOLE = ['int', 'long', 'short', 'byte'];
const DECIMALS = ['double', 'float', 'decimal'];

// Como transformar `text` (do tipo `from`) em `to`.
function conversion(from, to, text) {
  if (from === 'string' && PARSEABLE.includes(to)) return { label: 'Converter com ' + to + '.Parse(...)', text: to + '.Parse(' + text + ')' };
  if (DECIMALS.includes(from) && WHOLE.includes(to)) return { label: 'Cortar as casas com (' + to + ')', text: '(' + to + ')' + wrap(text) };
  if (WHOLE.includes(from) && to === 'char') return { label: 'Virar letra com (char)', text: '(char)' + wrap(text) };
  if (from === 'double' && (to === 'float' || to === 'decimal')) return { label: 'Converter com (' + to + ')', text: '(' + to + ')' + wrap(text) };
  if ((WHOLE.includes(from) || DECIMALS.includes(from) || from === 'bool' || from === 'char') && to === 'string') return { label: 'Virar texto com .ToString()', text: wrap(text) + '.ToString()' };
  return null;
}

// Depois do último `using` do topo (ou no começo do arquivo).
function usingSpot(src) {
  let end = 0;
  const re = /^[ \t]*using\s+[\w.]+\s*;[ \t]*\r?\n/gm;
  let m;
  while ((m = re.exec(src)) && m.index === end) end = m.index + m[0].length;
  return end;
}

export function fixesFor(d, src) {
  const out = [];
  if (!d.line || d.severity !== 'error') return out;
  const from = lineColToPos(d.line, d.col, src);
  const to = d.endLine ? lineColToPos(d.endLine, d.endCol, src) : from;
  const wrongText = src.slice(from, to);

  if (d.id === 'CS1002') out.push({ label: 'Colocar o ; aqui', from, to: from, text: ';' });
  else if (d.id === 'CS1026') out.push({ label: 'Fechar o parêntese )', from, to: from, text: ')' });
  else if (d.id === 'CS1513') {
    const atEnd = src.slice(from).trim() === '';
    out.push(atEnd
      ? { label: 'Fechar a chave }', from: src.length, to: src.length, text: (src.endsWith('\n') ? '' : '\n') + '}\n' }
      : { label: 'Fechar a chave }', from, to: from, text: '}' });
  }

  if ((d.id === 'CS0103' || d.id === 'CS0246') && USING_FOR[wrongText]) {
    const ns = USING_FOR[wrongText];
    if (!new RegExp('^\\s*using\\s+' + ns.replace(/\./g, '\\.') + '\\s*;', 'm').test(src)) {
      const at = usingSpot(src);
      out.push({ label: 'Adicionar using ' + ns + ';', from: at, to: at, text: 'using ' + ns + ';\n' + (at === 0 ? '\n' : '') });
    }
  }

  for (const name of d.names || []) {
    if (to > from) out.push({ label: 'Trocar por ' + name, from, to, text: name });
  }

  if ((d.id === 'CS0029' || d.id === 'CS0266') && to > from) {
    const fix = conversion(q(d.message, 0), q(d.message, 1), wrongText);
    if (fix) out.push({ label: fix.label, from, to, text: fix.text });
  }
  return out.slice(0, 4);
}
