// Labirinto: leve o @ até a saída (S) com as setas ou W A S D.
string[] mapa =
{
    "####################",
    "#    #       #     #",
    "# ## # ##### # ### #",
    "#  #   #   #   #   #",
    "## ##### # ##### # #",
    "#        #       #S#",
    "####################",
};
int linha = 1, coluna = 1, passos = 0;

while (true)
{
    Console.Clear();
    for (int y = 0; y < mapa.Length; y++)
    {
        for (int x = 0; x < mapa[y].Length; x++)
        {
            char c = mapa[y][x];
            if (y == linha && x == coluna)
            {
                Console.ForegroundColor = ConsoleColor.Yellow;
                Console.Write('@');
            }
            else if (c == '#')
            {
                Console.ForegroundColor = ConsoleColor.DarkCyan;
                Console.Write('█');
            }
            else if (c == 'S')
            {
                Console.ForegroundColor = ConsoleColor.Green;
                Console.Write('S');
            }
            else
            {
                Console.Write(' ');
            }
        }
        Console.WriteLine();
    }
    Console.ResetColor();
    Console.WriteLine($"Passos: {passos}");

    if (mapa[linha][coluna] == 'S') break;

    ConsoleKey tecla = Console.ReadKey(true).Key;
    int novaLinha = linha, novaColuna = coluna;
    if (tecla == ConsoleKey.UpArrow || tecla == ConsoleKey.W) novaLinha--;
    if (tecla == ConsoleKey.DownArrow || tecla == ConsoleKey.S) novaLinha++;
    if (tecla == ConsoleKey.LeftArrow || tecla == ConsoleKey.A) novaColuna--;
    if (tecla == ConsoleKey.RightArrow || tecla == ConsoleKey.D) novaColuna++;

    if (mapa[novaLinha][novaColuna] != '#')
    {
        linha = novaLinha;
        coluna = novaColuna;
        passos++;
    }
}

Console.ForegroundColor = ConsoleColor.Green;
Console.WriteLine("Você saiu do labirinto!");
Console.ResetColor();
