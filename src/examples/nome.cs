Console.Write("Qual é o seu nome? ");
string nome = Console.ReadLine();

Console.Write("Quantos anos você tem? ");
int idade = int.Parse(Console.ReadLine());

Console.WriteLine($"Prazer, {nome}! Daqui a 10 anos você terá {idade + 10}.");
