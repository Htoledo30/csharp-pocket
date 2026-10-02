// Um monstro: quanto mais fundo no labirinto, mais forte.
class Monstro : Personagem
{
    private readonly int forca;

    public Monstro(string nome, int vida, int forca) : base(nome, vida)
    {
        this.forca = forca;
    }

    public override int Atacar() => Dado.Next(2, 6) + forca;
}
