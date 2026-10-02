// Adivinhe o número: sorteio de 1 a 100, com 7 tentativas e dicas.
var dado = new Random();
int segredo = dado.Next(1, 101);
int tentativas = 7;

Console.WriteLine("Pensei em um número de 1 a 100.");

while (tentativas > 0)
{
    Console.Write($"Tentativa ({tentativas} restantes): ");
    if (!int.TryParse(Console.ReadLine(), out int palpite))
    {
        Console.WriteLine("Isso não é um número. Tente de novo.");
        continue;
    }

    if (palpite == segredo)
    {
        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine($"Acertou! O número era {segredo}.");
        Console.ResetColor();
        return;
    }

    tentativas--;
    Console.WriteLine(palpite < segredo ? "É maior..." : "É menor...");
}

Console.ForegroundColor = ConsoleColor.Red;
Console.WriteLine($"Acabaram as tentativas. O número era {segredo}.");
Console.ResetColor();
