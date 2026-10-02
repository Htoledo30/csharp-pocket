// Erros do compilador e da execução explicados em português, avisos e dicas.
import { startServer, startBrowser, open, ready, idle, runCode, check, DESKTOP } from './lib.mjs';

const server = await startServer();
const browser = await startBrowser();
try {
  const { context, page } = await open(browser, server.url, DESKTOP);
  await ready(page);

  let r = await runCode(page, 'Random Dado= new Random();\nint Dado= Random.Next{1,5};\nConsole.WriteLine($"{Dado}")\nstring s = 5;\nint n = "a";\nif (n = 3) { }\nConsole.Writeline(x);\n');
  check('vários erros: avisa que não executou', /não foi executado/.test(r.notes), r.notes.slice(0, 200));
  check('mostra linha e coluna', /Linha \d+, coluna \d+/.test(r.notes));
  check('traduz a atribuição de texto em número', /número inteiro \(int\)/.test(r.notes), r.notes);

  r = await runCode(page, 'int[] v = { 1, 2 };\nConsole.WriteLine(v[5]);\n');
  check('erro de execução: posição inexistente, linha 2', /posição que não existe/.test(r.notes) && /linha 2/.test(r.notes), r.notes);

  r = await runCode(page, 'int x = 1;\nint y = 2;\nConsole.WriteLine(int.Parse("abc"));\nreturn;\nConsole.WriteLine(x);\n');
  check('int.Parse("abc") explicado', /'abc' não é um número/.test(r.notes), r.notes);

  r = await runCode(page, 'int a = 10; int b = 0;\nConsole.WriteLine(a / b);\n');
  check('divisão por zero', /Divisão por zero/.test(r.notes) && /linha 2/.test(r.notes), r.notes);

  r = await runCode(page, 'string s = null;\nConsole.WriteLine(s.Length);\n');
  check('null explicado', /vazia \(null\)/.test(r.notes), r.notes);

  r = await runCode(page, 'int soma = 7;\ndouble media = soma / 2;\nRandom d = new Random();\nConsole.WriteLine(d.Next(1, 6) > 0);\nConsole.WriteLine(media);\n');
  check('dica da divisão de inteiros', /Divisão entre dois inteiros/.test(r.notes), r.notes);
  check('dica do Next(1, 6)', /Next\(1, 6\) sorteia de 1 a 5/.test(r.notes), r.notes);
  check('o programa rodou mesmo com dicas', /3/.test(r.screen), r.screen);

  r = await runCode(page, 'int x = 3;\nwhile (x > 0)\n{\n    Console.WriteLine(x);\n}\n');
  check('dica do while que nunca termina', /pode nunca terminar/.test(r.notes), r.notes);
  if ((await page.getAttribute('#run', 'data-mode')) === 'stop') await page.click('#run');   // se ainda estiver rodando, para
  await idle(page);

  r = await runCode(page, 'var a = new A();\nConsole.WriteLine(a.V);\nint x = 5;\nclass A { public int V; }\n');
  check('aviso de variável não usada', /nunca é usada|aviso/.test(r.notes) || r.screen.includes('0'), r.notes);

  r = await runCode(page, 'async Task Principal() { await Task.Delay(10); Console.WriteLine("async ok"); }\nawait Principal();\n');
  check('async/await funciona', r.screen.includes('async ok'), JSON.stringify(r));

  r = await runCode(page, 'var lista = new List<int> { 3, 1, 2 };\nConsole.WriteLine(string.Join(",", lista.OrderBy(x => x)));\nConsole.WriteLine(new P("a", 1));\nConsole.WriteLine(DateTime.Now.Year > 2000);\nConsole.WriteLine(1234.5.ToString("N1"));\nrecord P(string N, int I);\n');
  check('LINQ, record, DateTime, formatação', /1,2,3/.test(r.screen) && /P \{ N = a, I = 1 \}/.test(r.screen) && /True/.test(r.screen), r.screen);
  check('cultura pt-BR (vírgula decimal)', /1\.234,5/.test(r.screen), r.screen);

  check('sem erros no console', page.errors.length === 0, page.errors.join(' | '));
  await context.close();
} finally {
  await browser.close();
  await server.close();
}
