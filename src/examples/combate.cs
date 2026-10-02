// Combate por turnos: você contra o Minotauro.
var dado = new Random();
int vida = 30, vidaMinotauro = 40, pocoes = 2;

Console.ForegroundColor = ConsoleColor.Yellow;
Console.WriteLine("=== O MINOTAURO BLOQUEIA O CORREDOR ===");
Console.ResetColor();

while (vida > 0 && vidaMinotauro > 0)
{
    Console.WriteLine();
    Console.WriteLine($"Você: {vida} | Minotauro: {vidaMinotauro} | Poções: {pocoes}");
    Console.Write("[1] Atacar  [2] Beber poção  > ");
    string escolha = Console.ReadLine();

    if (escolha == "1")
    {
        int dano = dado.Next(4, 11);
        vidaMinotauro -= dano;
        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine($"Você acerta o Minotauro e causa {dano} de dano.");
    }
    else if (escolha == "2" && pocoes > 0)
    {
        pocoes--;
        vida += 12;
        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.WriteLine("Você bebe uma poção e recupera 12 de vida.");
    }
    else
    {
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.WriteLine("Você hesita e perde o turno.");
    }
    Console.ResetColor();

    if (vidaMinotauro <= 0) break;

    Thread.Sleep(500);
    int golpe = dado.Next(3, 9);
    vida -= golpe;
    Console.ForegroundColor = ConsoleColor.Red;
    Console.WriteLine($"O Minotauro investe e causa {golpe} de dano.");
    Console.ResetColor();
}

Console.WriteLine();
Console.WriteLine(vida > 0 ? "Vitória! O caminho está livre." : "Você caiu no labirinto...");
