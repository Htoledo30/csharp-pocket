// Batalha em quatro arquivos: este usa as classes Heroi, Monstro e Personagem, cada uma no seu arquivo.
var heroi = new Heroi("Teseu");
var monstros = new List<Monstro>
{
    new Monstro("Rato gigante", 15, 0),
    new Monstro("Harpia", 25, 2),
    new Monstro("Minotauro", 40, 4),
};

foreach (Monstro monstro in monstros)
{
    Console.WriteLine();
    Console.WriteLine($"=== {monstro.Nome} aparece! ===");

    while (monstro.Vivo && heroi.Vivo)
    {
        Console.WriteLine($"{heroi}  x  {monstro}   poções: {heroi.Pocoes}");
        Console.Write("[1] Atacar  [2] Beber poção > ");
        string escolha = Console.ReadLine();

        if (escolha == "2")
        {
            Console.WriteLine(heroi.BeberPocao() ? "Você bebe uma poção (+15)." : "Sem poções!");
        }
        else
        {
            int dano = heroi.Atacar();
            monstro.Ferir(dano);
            Console.WriteLine($"Você causa {dano} de dano.");
        }

        if (monstro.Vivo)
        {
            int golpe = monstro.Atacar();
            heroi.Ferir(golpe);
            Console.WriteLine($"{monstro.Nome} causa {golpe} de dano.");
        }
    }

    if (!heroi.Vivo)
    {
        Console.WriteLine("Você caiu no labirinto...");
        return;
    }
    Console.WriteLine($"{monstro.Nome} foi derrotado!");
}

Console.WriteLine();
Console.WriteLine("Você venceu todos os monstros!");
