// Os erros do compilador e do programa, explicados em português simples.
export const TYPE_PT = { string: 'texto (string)', int: 'número inteiro (int)', double: 'número com casas decimais (double)', float: 'número com casas decimais (float)',
  decimal: 'número decimal (decimal)', bool: 'verdadeiro ou falso (bool)', char: 'uma letra (char)', void: 'nada (void)', 'method group': 'um método sem os parênteses' };
export const ty = (t) => TYPE_PT[t] || "'" + t + "'";
export const NUMERIC = ['int', 'double', 'float', 'decimal', 'long'];
export function convertTip(from, to) {
  if (from === 'method group') return ' Faltaram os parênteses ( ) para chamar o método.';
  if (from === 'string' && NUMERIC.includes(to)) return ' Para transformar texto em número, use ' + to + '.Parse(...).';
  if (NUMERIC.includes(from) && to === 'string') return ' Para transformar em texto, use .ToString() ou $"{valor}".';
  if (to === 'bool') return ' Aqui precisa de uma comparação, como x == 1 ou x > 0.';
  if ((from === 'double' || from === 'float' || from === 'decimal') && (to === 'int' || to === 'long')) return ' Para cortar as casas decimais, escreva (int) na frente do valor.';
  if (from === 'int' && to === 'char') return ' Para virar letra, escreva (char) na frente do valor.';
  return '';
}
export const q = (msg, n) => { const all = msg.match(/'[^']*'/g) || []; return (all[n] || "''").slice(1, -1); };
export const ERR = {
  CS1002: () => 'Faltou um ponto e vírgula (;) no fim do comando.',
  CS1003: (m) => 'Erro de escrita: aqui o C# esperava ' + q(m, 0) + '.',
  CS1513: () => 'Faltou fechar uma chave }. Confira se cada { tem o seu }.',
  CS1514: () => 'Faltou abrir uma chave { aqui.',
  CS1026: () => 'Faltou fechar um parêntese ).',
  CS1022: () => 'Sobrou uma chave } a mais, ou há código depois do fim de uma classe.',
  CS1525: (m) => "O C# não entendeu o trecho '" + q(m, 0) + "'. Normalmente falta algo antes dele: um valor, um parêntese ou um ponto e vírgula.",
  CS1001: () => 'Faltou um nome aqui (de variável, método ou classe).',
  CS1010: () => 'Faltou fechar as aspas do texto nesta linha.',
  CS1039: () => 'Faltou fechar as aspas do texto.',
  CS1012: () => "Aspas simples guardam uma letra só. Para um texto, use aspas duplas: \"assim\".",
  CS1011: () => "Entre aspas simples precisa haver uma letra. Para texto vazio, use \"\".",
  CS0103: (m) => "O nome '" + q(m, 0) + "' não existe aqui. Confira se digitou igual (maiúsculas e minúsculas contam) e se a variável foi criada antes desta linha, dentro do mesmo bloco { }.",
  CS0128: (m) => "Já existe uma variável chamada '" + q(m, 0) + "'. Escolha outro nome, ou tire o tipo da frente se quiser só mudar o valor dela.",
  CS0136: (m) => "Já existe uma variável chamada '" + q(m, 0) + "' num bloco de fora. Escolha outro nome.",
  CS0029: (m) => 'Você está colocando ' + ty(q(m, 0)) + ' onde o C# espera ' + ty(q(m, 1)) + '.' + convertTip(q(m, 0), q(m, 1)),
  CS0266: (m) => 'Você está colocando ' + ty(q(m, 0)) + ' onde o C# espera ' + ty(q(m, 1)) + '.' + convertTip(q(m, 0), q(m, 1)),
  CS0019: (m) => "O operador '" + q(m, 0) + "' não funciona entre " + ty(q(m, 1)) + ' e ' + ty(q(m, 2)) + '.' + (q(m, 1) === 'string' || q(m, 2) === 'string' ? ' Converta o texto para número antes de comparar ou fazer conta.' : ''),
  CS0023: (m) => "O operador '" + q(m, 0) + "' não funciona com " + ty(q(m, 1)) + '.',
  CS0165: (m) => "A variável '" + q(m, 0) + "' foi usada antes de receber um valor. Dê um valor inicial, por exemplo = 0.",
  CS1061: (m) => ty(q(m, 0)) + " não tem nada chamado '" + q(m, 1) + "'. Confira a grafia (maiúsculas contam).",
  CS0117: (m) => ty(q(m, 0)) + " não tem nada chamado '" + q(m, 1) + "'. Confira a grafia (maiúsculas contam).",
  CS0120: (m) => "'" + q(m, 0).replace(/\(.*$/, '') + "' precisa ser chamado numa variável, não direto no tipo. Crie o objeto com new e use o nome da variável. Exemplo: Random dado = new Random(); e depois dado.Next(1, 7).",
  CS0176: (m) => "'" + q(m, 0).replace(/\(.*$/, '') + "' é chamado direto no tipo, não numa variável.",
  CS1501: (m) => "O método '" + q(m, 0) + "' não aceita " + ((/takes (\d+)/.exec(m) || [])[1] || 'essa quantidade de') + ' valor(es) entre os parênteses.',
  CS7036: (m) => "Falta informar o valor '" + q(m, 0) + "' ao chamar '" + q(m, 1).replace(/\(.*$/, '') + "'.",
  CS1503: (m) => 'O ' + ((/Argument (\d+)/.exec(m) || [])[1] || '') + 'º valor entre os parênteses é ' + ty(q(m, 0)) + ', mas o método espera ' + ty(q(m, 1)) + '.' + convertTip(q(m, 0), q(m, 1)),
  CS0246: (m) => "O C# não conhece o tipo '" + q(m, 0) + "'. Confira a grafia; se for uma classe sua, ela precisa existir no código.",
  CS0161: (m) => "O método '" + q(m, 0).replace(/\(.*$/, '') + "' precisa devolver um valor com return em todos os caminhos.",
  CS0126: () => 'Este return precisa devolver um valor.',
  CS0127: () => 'Este método é void, então o return não pode devolver um valor.',
  CS8803: () => 'Os comandos soltos precisam vir antes das classes. Mova as classes para o fim do arquivo.',
  CS5001: () => 'O programa não tem por onde começar. Escreva os comandos fora das classes, ou crie um método static void Main().',
  CS0201: () => 'Esta linha não faz nada sozinha. Faltou guardar o resultado numa variável ou chamar um método?',
  CS0131: () => 'Do lado esquerdo do = precisa ficar uma variável.',
  CS1955: (m) => "'" + q(m, 0) + "' não é um método: use sem parênteses.",
  CS0428: (m) => "Faltaram os parênteses para chamar '" + q(m, 0) + "()'.",
  CS0815: () => 'Com var o C# precisa descobrir o tipo pelo valor. Troque var pelo tipo, ou dê um valor que tenha tipo.',
  CS0818: () => 'Com var é preciso dar um valor na mesma linha. Ou troque var pelo tipo, como int ou string.',
  CS0152: () => 'Este case está repetido dentro do mesmo switch.',
  CS0163: () => 'Faltou um break; no fim deste case.',
  CS8070: () => 'Faltou um break; no fim deste case.',
  CS0021: (m) => 'Não dá para usar [ ] com ' + ty(q(m, 0)) + '. Os colchetes só funcionam em arrays, listas e textos.',
  CS0122: (m) => "'" + q(m, 0).replace(/\(.*$/, '') + "' é privado. Escreva public na frente dele para usar fora da classe.",
  CS0200: (m) => "'" + q(m, 0) + "' só pode ser lido, não alterado.",
  CS1519: () => 'Dentro de uma classe só ficam variáveis e métodos. Comandos como este precisam estar dentro de um método.',
  CS0116: () => 'Variáveis e métodos precisam ficar dentro de uma classe, ou antes de todas as classes.',
  CS0101: (m) => "Já existe uma classe chamada '" + q(m, 1) + "'.",
  CS0111: (m) => "Já existe um método '" + q(m, 1) + "' igual a este na classe.",
  CS0841: (m) => "A variável '" + q(m, 0) + "' foi usada antes da linha em que é criada.",
  CS0844: (m) => "A variável '" + q(m, 0) + "' foi usada antes da linha em que é criada.",
  CS1023: () => 'Depois de um if, for ou while sem chaves não dá para criar variável. Coloque o bloco entre { }.',
  CS0030: (m) => 'Não dá para transformar ' + ty(q(m, 0)) + ' em ' + ty(q(m, 1)) + ' desse jeito.' + convertTip(q(m, 0), q(m, 1)),
  CS0077: () => 'Este as não funciona com esse tipo.',
  CS0118: (m) => "'" + q(m, 0) + "' é " + (/is a type/.test(m) ? 'um tipo' : 'outra coisa') + ', e aqui foi usado como se fosse ' + (/like a variable/.test(m) ? 'uma variável' : 'outra coisa') + '.',
  CS0119: (m) => "'" + q(m, 0) + "' é um tipo ou método, e não pode ser usado desse jeito aqui.",
  CS0150: () => 'Aqui precisa de um valor fixo (um número ou texto escrito direto).',
  CS0236: () => 'Uma variável da classe não pode usar outra na hora de ser criada. Dê o valor dentro de um método ou construtor.',
  CS0501: (m) => "O método '" + q(m, 0).replace(/\(.*$/, '') + "' precisa de um corpo entre { }.",
  CS1529: () => 'As linhas com using precisam ficar no topo do arquivo.',
  CS0106: (m) => "A palavra '" + q(m, 0) + "' não pode ser usada aqui.",
  CS0162: () => 'Este trecho nunca é executado: o programa nunca chega até aqui.',
  CS0219: (m) => "A variável '" + q(m, 0) + "' recebe um valor mas nunca é usada.",
  CS0168: (m) => "A variável '" + q(m, 0) + "' foi criada mas nunca é usada.",
  CS0642: () => 'Tem um ponto e vírgula logo depois do if, for ou while, então o bloco abaixo não pertence a ele. Apague esse ;.',
  CS0665: () => 'Aqui foi usado = (guardar um valor). Para comparar, use ==.',
  CS1717: () => 'A variável está recebendo ela mesma. Era outra variável do lado direito?',
  CS0164: () => 'Este rótulo não é usado.',
  CS8321: (m) => "A função '" + q(m, 0) + "' foi criada mas nunca é chamada.",
  CS0649: (m) => "A variável '" + q(m, 0) + "' nunca recebe um valor.",
  CS0169: (m) => "A variável '" + q(m, 0) + "' nunca é usada.",
  CS0414: (m) => "A variável '" + q(m, 0) + "' recebe um valor mas nunca é usada.",
  CS1998: () => 'Este método é async mas não tem nenhum await dentro.',
  CS4014: () => 'Faltou um await na frente desta chamada.',
};
export function explain(d) {
  const f = ERR[d.id];
  if (!f) return null;
  try { return f(d.message); } catch (e) { return null; }
}
export const RUNTIME = [
  [/DivideByZeroException/, () => 'Divisão por zero: o número de baixo da divisão valia 0.'],
  [/IndexOutOfRangeException/, () => 'Você tentou usar uma posição que não existe no array. As posições vão de 0 até Length - 1.'],
  [/ArgumentOutOfRangeException/, () => 'Você usou uma posição ou um valor fora do permitido. Em listas e textos as posições vão de 0 até o tamanho - 1.'],
  [/FormatException/, (m) => { const t = /'([^']*)'/.exec(m); return (t ? "O texto '" + t[1] + "' não é um número" : 'O texto digitado não estava no formato esperado') + ', então a conversão falhou. Para não quebrar, use int.TryParse.'; }],
  [/NullReferenceException/, () => 'Você usou uma variável que está vazia (null). Ela foi criada com new? Recebeu um valor antes de ser usada?'],
  [/KeyNotFoundException/, () => 'Essa chave não existe no dicionário. Confira com ContainsKey antes de buscar.'],
  [/OverflowException/, () => 'O número ficou grande (ou pequeno) demais para o tipo da variável.'],
  [/InvalidCastException/, () => 'Não foi possível converter o valor para o tipo pedido.'],
  [/StackOverflowException|InsufficientExecutionStackException/, () => 'Um método ficou chamando a si mesmo sem parar.'],
  [/InvalidOperationException: Collection was modified/, () => 'A lista foi alterada dentro do foreach que estava passando por ela. Use um for, ou percorra uma cópia (lista.ToList()).'],
  [/InvalidOperationException: Sequence contains no/, () => 'A lista estava vazia (ou nenhum item combinava) e você pediu First, Last, Max ou parecido.'],
  [/ArgumentNullException/, () => 'Um método recebeu null onde precisava de um valor.'],
  [/FileNotFoundException|DirectoryNotFoundException/, () => 'O arquivo não foi encontrado. Aqui os arquivos só existem enquanto o programa roda: crie com File.WriteAllText antes de ler.'],
  [/PlatformNotSupportedException|Cannot wait on monitors/, () => 'Este recurso não funciona dentro do navegador (threads, rede e esperas com .Wait() ou .Result).'],
  [/NotImplementedException/, () => 'O programa chegou num throw new NotImplementedException(): essa parte ainda não foi escrita.'],
];
export function explainRuntime(first) {
  for (const [re, f] of RUNTIME) if (re.test(first)) { try { return f(first); } catch (e) { return null; } }
  return null;
}

// Alguns erros do Roslyn enganam quem está começando. Falta de ; num "int y = 5" seguido de outra linha
// vira "esperava uma vírgula": aqui isso volta a ser o que de fato é, um ponto e vírgula que faltou.
export function refine(d, source) {
  if (!d.line || !source) return d;
  if (d.id === 'CS1003' && /'[,;]' expected/.test(d.message)) {
    const line = source.split('\n')[d.line - 1] || '';
    const rest = line.slice(Math.max(0, d.col - 1)).replace(/\/\/.*$/, '').trim();
    if (rest === '') return { ...d, id: 'CS1002', message: '; expected' };
  }
  return d;
}
