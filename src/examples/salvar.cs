// Guardar um recorde entre uma execução e outra.
// O arquivo fica salvo neste aparelho, junto com o programa: execute várias vezes e veja o recorde subir.
const string Arquivo = "recorde.txt";
int recorde = 0;
if (File.Exists(Arquivo) && int.TryParse(File.ReadAllText(Arquivo), out int lido))
{
    recorde = lido;
}

Console.WriteLine($"Recorde atual: {recorde}");

var dado = new Random();
int pontos = dado.Next(0, 101);
Console.WriteLine($"Você fez {pontos} pontos.");

if (pontos > recorde)
{
    File.WriteAllText(Arquivo, pontos.ToString());
    Console.ForegroundColor = ConsoleColor.Yellow;
    Console.WriteLine($"Novo recorde! Guardado em {Arquivo}.");
    Console.ResetColor();
}
else
{
    Console.WriteLine("Não bateu o recorde. Execute de novo.");
}
