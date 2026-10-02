// Cobrinha em tempo real. Setas ou W A S D movem a cobra; Esc sai.
// O jogo anda sozinho enquanto espera a próxima tecla, por isso precisa do console ao vivo
// (Ajustes mostra se está ligado). Console.KeyAvailable diz se há uma tecla esperando.
using System.Text;

const int Largura = 30, Altura = 14;
var dado = new Random();
var corpo = new List<(int x, int y)> { (5, 5), (4, 5), (3, 5) };
(int dx, int dy) direcao = (1, 0);
(int x, int y) comida = (15, 7);
int pontos = 0;
bool vivo = true;

Console.Clear();
Console.CursorVisible = false;

while (vivo)
{
    while (Console.KeyAvailable)
    {
        ConsoleKey tecla = Console.ReadKey(true).Key;
        if ((tecla == ConsoleKey.UpArrow || tecla == ConsoleKey.W) && direcao.dy == 0) direcao = (0, -1);
        else if ((tecla == ConsoleKey.DownArrow || tecla == ConsoleKey.S) && direcao.dy == 0) direcao = (0, 1);
        else if ((tecla == ConsoleKey.LeftArrow || tecla == ConsoleKey.A) && direcao.dx == 0) direcao = (-1, 0);
        else if ((tecla == ConsoleKey.RightArrow || tecla == ConsoleKey.D) && direcao.dx == 0) direcao = (1, 0);
        else if (tecla == ConsoleKey.Escape) vivo = false;
    }
    if (!vivo) break;

    var cabeca = (x: corpo[0].x + direcao.dx, y: corpo[0].y + direcao.dy);
    if (cabeca.x < 0 || cabeca.y < 0 || cabeca.x >= Largura || cabeca.y >= Altura || corpo.Contains(cabeca))
    {
        vivo = false;
        break;
    }

    corpo.Insert(0, cabeca);
    if (cabeca == comida)
    {
        pontos++;
        comida = (dado.Next(Largura), dado.Next(Altura));
    }
    else
    {
        corpo.RemoveAt(corpo.Count - 1);
    }

    // Desenha o quadro inteiro de uma vez e escreve por cima do anterior.
    var quadro = new StringBuilder();
    quadro.AppendLine($"Pontos: {pontos}   (setas ou WASD, Esc sai)");
    quadro.AppendLine("+" + new string('-', Largura) + "+");
    for (int y = 0; y < Altura; y++)
    {
        quadro.Append('|');
        for (int x = 0; x < Largura; x++)
        {
            char c = ' ';
            if ((x, y) == comida) c = '*';
            else if ((x, y) == corpo[0]) c = '@';
            else if (corpo.Contains((x, y))) c = 'o';
            quadro.Append(c);
        }
        quadro.AppendLine("|");
    }
    quadro.AppendLine("+" + new string('-', Largura) + "+");

    Console.SetCursorPosition(0, 0);
    Console.Write(quadro.ToString());
    Thread.Sleep(120);
}

Console.CursorVisible = true;
Console.SetCursorPosition(0, Altura + 4);
Console.WriteLine($"Fim de jogo! Pontos: {pontos}");
