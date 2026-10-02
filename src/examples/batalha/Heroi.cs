// O herói: ataca forte e pode beber poções para recuperar vida.
class Heroi : Personagem
{
    public int Pocoes { get; private set; } = 2;

    public Heroi(string nome) : base(nome, 40)
    {
    }

    public override int Atacar() => Dado.Next(5, 12);

    public bool BeberPocao()
    {
        if (Pocoes == 0) return false;
        Pocoes--;
        Vida = Math.Min(VidaMaxima, Vida + 15);
        return true;
    }
}
