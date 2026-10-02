// Calculadora com menu. Mostra: laço, switch, double.TryParse e funções locais.
double LerNumero(string pergunta)
{
    while (true)
    {
        Console.Write(pergunta);
        string texto = (Console.ReadLine() ?? "").Replace(',', '.');
        if (double.TryParse(texto, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out double valor))
        {
            return valor;
        }
        Console.WriteLine("Digite um número, por exemplo 3,5.");
    }
}

while (true)
{
    Console.WriteLine();
    Console.WriteLine("[+] somar  [-] subtrair  [*] multiplicar  [/] dividir  [s] sair");
    Console.Write("> ");
    string opcao = (Console.ReadLine() ?? "s").Trim().ToLower();
    if (opcao == "s") break;

    if (opcao != "+" && opcao != "-" && opcao != "*" && opcao != "/")
    {
        Console.WriteLine("Opção inválida.");
        continue;
    }

    double a = LerNumero("Primeiro número: ");
    double b = LerNumero("Segundo número: ");

    switch (opcao)
    {
        case "+": Console.WriteLine($"{a} + {b} = {a + b}"); break;
        case "-": Console.WriteLine($"{a} - {b} = {a - b}"); break;
        case "*": Console.WriteLine($"{a} * {b} = {a * b}"); break;
        case "/":
            if (b == 0) Console.WriteLine("Não dá para dividir por zero.");
            else Console.WriteLine($"{a} / {b} = {a / b:0.####}");
            break;
    }
}

Console.WriteLine("Até logo!");
