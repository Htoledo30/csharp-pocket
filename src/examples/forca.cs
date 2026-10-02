// Jogo da forca: descubra a palavra letra por letra. Cada erro conta; com 6 erros você perde.
string[] palavras = { "labirinto", "minotauro", "espada", "tesouro", "dragao", "caverna" };
var dado = new Random();
string segredo = palavras[dado.Next(palavras.Length)];
var acertos = new HashSet<char>();
var erros = new List<char>();
const int MaxErros = 6;

while (erros.Count < MaxErros)
{
    string mostrado = "";
    foreach (char letra in segredo)
    {
        mostrado += acertos.Contains(letra) ? letra + " " : "_ ";
    }

    Console.Clear();
    Console.WriteLine("=== FORCA ===");
    Console.WriteLine();
    Console.WriteLine(mostrado);
    Console.WriteLine();
    Console.WriteLine($"Erros ({erros.Count}/{MaxErros}): {string.Join(" ", erros)}");

    if (segredo.All(acertos.Contains))
    {
        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine("Você ganhou!");
        Console.ResetColor();
        return;
    }

    Console.Write("Uma letra: ");
    string entrada = (Console.ReadLine() ?? "").Trim().ToLower();
    if (entrada.Length != 1 || !char.IsLetter(entrada[0])) continue;

    char tentativa = entrada[0];
    if (acertos.Contains(tentativa) || erros.Contains(tentativa)) continue;

    if (segredo.Contains(tentativa)) acertos.Add(tentativa);
    else erros.Add(tentativa);
}

Console.ForegroundColor = ConsoleColor.Red;
Console.WriteLine($"Você perdeu. A palavra era {segredo}.");
Console.ResetColor();
