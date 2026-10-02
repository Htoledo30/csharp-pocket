// A classe base: todo personagem tem nome, vida e sabe atacar (cada tipo ataca do seu jeito).
abstract class Personagem
{
    protected static readonly Random Dado = new Random();

    public string Nome { get; }
    public int Vida { get; protected set; }
    public int VidaMaxima { get; }
    public bool Vivo => Vida > 0;

    protected Personagem(string nome, int vida)
    {
        Nome = nome;
        Vida = vida;
        VidaMaxima = vida;
    }

    public abstract int Atacar();

    public void Ferir(int dano)
    {
        Vida = Math.Max(0, Vida - dano);
    }

    public override string ToString() => $"{Nome} ({Vida}/{VidaMaxima})";
}
