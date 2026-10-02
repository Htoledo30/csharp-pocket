// Sugestões prontas: o que aparece depois do ponto, os modelos (cw, if, for...) e as palavras mais usadas.
// Servem de apoio enquanto o compilador não responde (por exemplo, com um programa rodando).
export const M = (l, i, d) => ({ l, i: i || l, d: d || '' });
export const NUMBER_TYPE = [M('Parse', 'Parse(|)', 'texto para número'), M('TryParse', 'TryParse(|, out var valor)', 'converte sem dar erro'), M('MaxValue'), M('MinValue')];
export const STATIC = {
  Console: [
    M('WriteLine', 'WriteLine(|);', 'escreve e pula a linha'), M('Write', 'Write(|);', 'escreve sem pular a linha'),
    M('ReadLine', 'ReadLine()', 'lê um texto digitado'), M('ReadKey', 'ReadKey(true)', 'espera uma tecla'),
    M('Clear', 'Clear();', 'limpa a tela'), M('ForegroundColor', 'ForegroundColor = ConsoleColor.', 'cor do texto'),
    M('BackgroundColor', 'BackgroundColor = ConsoleColor.', 'cor do fundo'), M('ResetColor', 'ResetColor();', 'volta às cores normais'),
    M('SetCursorPosition', 'SetCursorPosition(|);', 'coluna, linha'), M('CursorVisible', 'CursorVisible = false;', 'mostra ou esconde o cursor'),
    M('Title', 'Title = "|";', 'título do terminal'), M('Beep', 'Beep();', 'toca um bipe'),
    M('WindowWidth', '', 'largura em colunas'), M('WindowHeight', '', 'altura em linhas'),
  ],
  Math: [
    M('Abs', 'Abs(|)', 'valor absoluto'), M('Max', 'Max(|)', 'o maior de dois'), M('Min', 'Min(|)', 'o menor de dois'),
    M('Pow', 'Pow(|)', 'potência'), M('Sqrt', 'Sqrt(|)', 'raiz quadrada'), M('Round', 'Round(|)', 'arredonda'),
    M('Floor', 'Floor(|)', 'arredonda para baixo'), M('Ceiling', 'Ceiling(|)', 'arredonda para cima'),
    M('Clamp', 'Clamp(|)', 'valor, mínimo, máximo'), M('PI', '', '3,14159…'),
  ],
  Convert: [
    M('ToInt32', 'ToInt32(|)', 'para int'), M('ToDouble', 'ToDouble(|)', 'para double'), M('ToDecimal', 'ToDecimal(|)', 'para decimal'),
    M('ToString', 'ToString(|)', 'para texto'), M('ToBoolean', 'ToBoolean(|)', 'para bool'), M('ToChar', 'ToChar(|)', 'para char'),
  ],
  int: NUMBER_TYPE, double: NUMBER_TYPE, float: NUMBER_TYPE, decimal: NUMBER_TYPE, long: NUMBER_TYPE,
  bool: [M('Parse', 'Parse(|)', 'texto para bool'), M('TryParse', 'TryParse(|, out var valor)', 'converte sem dar erro')],
  string: [
    M('IsNullOrEmpty', 'IsNullOrEmpty(|)', 'vazio ou nulo?'), M('IsNullOrWhiteSpace', 'IsNullOrWhiteSpace(|)', 'só espaços?'),
    M('Join', 'Join(", ", |)', 'junta uma lista em um texto'), M('Empty', '', 'texto vazio'),
  ],
  char: [
    M('IsDigit', 'IsDigit(|)', 'é um número?'), M('IsLetter', 'IsLetter(|)', 'é uma letra?'), M('IsWhiteSpace', 'IsWhiteSpace(|)', 'é espaço?'),
    M('ToUpper', 'ToUpper(|)', 'maiúscula'), M('ToLower', 'ToLower(|)', 'minúscula'),
  ],
  ConsoleColor: ['Black', 'White', 'Gray', 'DarkGray', 'Red', 'DarkRed', 'Green', 'DarkGreen', 'Blue', 'DarkBlue', 'Yellow', 'DarkYellow', 'Cyan', 'DarkCyan', 'Magenta', 'DarkMagenta'].map((c) => M(c)),
  ConsoleKey: ['UpArrow', 'DownArrow', 'LeftArrow', 'RightArrow', 'Enter', 'Spacebar', 'Escape', 'Backspace', 'W', 'A', 'S', 'D'].map((c) => M(c)),
  Thread: [M('Sleep', 'Sleep(|);', 'pausa em milissegundos')],
  File: [
    M('ReadAllText', 'ReadAllText(|)', 'lê o arquivo inteiro'), M('WriteAllText', 'WriteAllText(|);', 'caminho, texto'),
    M('ReadAllLines', 'ReadAllLines(|)', 'lê linha por linha'), M('AppendAllText', 'AppendAllText(|);', 'acrescenta no fim'), M('Exists', 'Exists(|)', 'o arquivo existe?'),
  ],
  DateTime: [M('Now', '', 'data e hora de agora'), M('Today', '', 'data de hoje')],
  Environment: [M('NewLine', '', 'quebra de linha'), M('Exit', 'Exit(0);', 'encerra o programa')],
  Array: [M('Sort', 'Sort(|);', 'ordena'), M('Reverse', 'Reverse(|);', 'inverte'), M('IndexOf', 'IndexOf(|)', 'posição de um item')],
  Task: [M('Delay', 'Delay(|)', 'espera (use com await)')],
};
export const INSTANCE = {
  string: [
    M('Length', '', 'quantidade de letras'), M('ToUpper', 'ToUpper()', 'maiúsculas'), M('ToLower', 'ToLower()', 'minúsculas'),
    M('Trim', 'Trim()', 'tira espaços das pontas'), M('Contains', 'Contains(|)', 'tem esse trecho?'), M('Replace', 'Replace(|)', 'troca um trecho por outro'),
    M('Split', "Split(' ')", 'separa em partes'), M('Substring', 'Substring(|)', 'início, tamanho'),
    M('StartsWith', 'StartsWith(|)', 'começa com?'), M('EndsWith', 'EndsWith(|)', 'termina com?'), M('IndexOf', 'IndexOf(|)', 'posição de um trecho'),
  ],
  number: [M('ToString', 'ToString()', 'para texto'), M('ToString("F2")', 'ToString("F2")', 'com 2 casas decimais'), M('CompareTo', 'CompareTo(|)', 'compara com outro')],
  array: [M('Length', '', 'quantidade de itens'), M('Contains', 'Contains(|)', 'tem esse item?'), M('Sum', 'Sum()', 'soma'), M('Max', 'Max()', 'maior'), M('Min', 'Min()', 'menor')],
  List: [
    M('Add', 'Add(|);', 'acrescenta um item'), M('Count', '', 'quantidade de itens'), M('Remove', 'Remove(|);', 'tira um item'),
    M('RemoveAt', 'RemoveAt(|);', 'tira pela posição'), M('Contains', 'Contains(|)', 'tem esse item?'), M('Clear', 'Clear();', 'esvazia'),
    M('IndexOf', 'IndexOf(|)', 'posição de um item'), M('Insert', 'Insert(|);', 'posição, item'), M('Sort', 'Sort();', 'ordena'),
  ],
  Dictionary: [
    M('Add', 'Add(|);', 'chave, valor'), M('ContainsKey', 'ContainsKey(|)', 'tem essa chave?'), M('Remove', 'Remove(|);', 'tira pela chave'),
    M('Count', '', 'quantidade de itens'), M('Keys', '', 'todas as chaves'), M('Values', '', 'todos os valores'), M('TryGetValue', 'TryGetValue(|, out var valor)', 'busca sem dar erro'),
  ],
  Random: [M('Next', 'Next(|)', 'inteiro: mínimo, máximo'), M('NextDouble', 'NextDouble()', 'entre 0 e 1')],
  StringBuilder: [M('Append', 'Append(|);', 'acrescenta texto'), M('AppendLine', 'AppendLine(|);', 'acrescenta uma linha'), M('ToString', 'ToString()', 'texto final'), M('Length', '', 'tamanho'), M('Clear', 'Clear();', 'esvazia')],
  ConsoleKeyInfo: [M('Key', '', 'qual tecla (ConsoleKey)'), M('KeyChar', '', 'o caractere digitado')],
  DateTime: [M('Day'), M('Month'), M('Year'), M('Hour'), M('Minute'), M('ToString("dd/MM/yyyy")', 'ToString("dd/MM/yyyy")', 'data como texto'), M('AddDays', 'AddDays(|)', 'soma dias')],
};
export const TYPE_KEY = { string: 'string', int: 'number', double: 'number', float: 'number', decimal: 'number', long: 'number', short: 'number', byte: 'number', uint: 'number',
  List: 'List', Dictionary: 'Dictionary', Random: 'Random', StringBuilder: 'StringBuilder', ConsoleKeyInfo: 'ConsoleKeyInfo', DateTime: 'DateTime' };
export const SNIPPETS = [
  { l: 'cw', i: 'Console.WriteLine(|);', d: 'modelo: escrever na tela', snip: true },
  { l: 'if', i: 'if (|)\n{\n    \n}', d: 'modelo com chaves', snip: true },
  { l: 'for', i: 'for (int i = 0; i < |; i++)\n{\n    \n}', d: 'modelo: repetir N vezes', snip: true },
  { l: 'foreach', i: 'foreach (var item in |)\n{\n    \n}', d: 'modelo: percorrer uma lista', snip: true },
  { l: 'while', i: 'while (|)\n{\n    \n}', d: 'modelo: repetir enquanto', snip: true },
  { l: 'switch', i: 'switch (|)\n{\n    case 1:\n        break;\n    default:\n        break;\n}', d: 'modelo com case', snip: true },
];
export const COMMON_WORDS = ('bool break case char class const continue decimal default double else false float foreach int long namespace new null private public ' +
  'return static string switch true using var void while List Dictionary Random Console Math Convert ConsoleColor ConsoleKey Thread DateTime File').split(' ');
export const NOT_A_TYPE = new Set(['return', 'new', 'class', 'struct', 'else', 'using', 'namespace', 'throw', 'await', 'case', 'goto', 'in', 'is', 'as', 'yield', 'record', 'enum']);
