# Plano e andamento

Objetivo: o melhor app de bolso para escrever C# no celular e no iPad — completo, organizado, que abre em tela cheia
e roda o que for escrito.

## Fase 1 — Virar um app de verdade ✅

- [x] Hospedagem própria no GitHub Pages (https://htoledo30.github.io/csharp-pocket/)
- [x] Ícone na tela inicial, tela cheia, sem barra de endereço (iPhone, iPad e Android)
- [x] Funciona sem internet (o .NET fica guardado no aparelho)
- [x] Código organizado por função (`src/js/`, `src/css/`, `engine/`)
- [x] Montagem automática a cada `git push` (GitHub Actions)
- [x] Fontes guardadas junto (nada vem de servidores de fora)
- [x] Avisa quando sai versão nova e atualiza com um toque
- [ ] Subir para o .NET 10 (veja `ARQUITETURA.md`)

## Fase 2 — Escrever sem dor no celular ✅

- [x] Sugestões do próprio compilador: depois do ponto, Linq, classes do programa, `new`
- [x] Ajuda dos parâmetros (qual forma da chamada, parâmetro ativo)
- [x] Erros sublinhados enquanto se digita, explicados em português
- [x] Conserto de um toque (`;`, `)`, `}`, nome parecido, `using` que faltou, `int.Parse`, `(int)`, `.ToString()`)
- [x] Barra de teclas refeita: executar, setas, início/fim, desfazer/refazer, símbolos
- [x] Menu "Mais": duplicar, apagar, mover, comentar, recuar, selecionar linha
- [x] Buscar e trocar, ir para a linha, renomear nome em todos os arquivos
- [x] Par de chaves destacado, fecho automático, recuo automático
- [x] Atalhos de teclado para iPad com teclado

## Fase 3 — Rodar o que for escrito ✅

- [x] Console real (ao vivo): `ReadLine`, `ReadKey`, `KeyAvailable`, `Thread.Sleep` de verdade
- [x] Vários arquivos por programa, com abas (uma classe por arquivo)
- [x] Arquivos que persistem (`File.WriteAllText` guarda entre execuções)
- [x] Exemplos que mostram tudo: forca, calculadora, batalha (4 arquivos), cobrinha em tempo real, recorde salvo
- [x] Modo jogo: terminal em tela cheia com as teclas escolhidas nos Ajustes (setas, Enter, WASD, números...)

## Fase 4 — Não perder nada ✅

- [x] Exportar (backup `.json`, `.zip` com os `.cs`, um programa) e importar (`.cs`, `.zip`, backup)
- [x] Histórico de versões por programa
- [x] Sincronizar iPhone, iPad e PC pelo GitHub (gist secreto)
- [x] Programas do artefato antigo do Claude recuperados (`_meus-programas/`, fora do repositório)

## Como acompanhar

- `node tests/run.mjs` roda todos os testes (Chrome); `BROWSER=webkit node tests/run.mjs` roda no motor do Safari.
- Cada teste mostra `ok` ou `FALHA`. Os testes cobrem o app instalável, o console ao vivo, as sugestões, os arquivos,
  a sincronização (com um GitHub de mentira), a atualização e os exemplos.

## Rodada de interface (celular e iPad) ✅

Pergunta que guiou: "o que uma pessoa com um iPhone ou iPad precisa ter sempre na cara?"

- [x] Barra de ações fixa, sempre à vista acima das teclas de símbolos: **Executar, Formatar, Desfazer, Refazer, Esconder teclado, Mais**
      (botões grandes, com ícone e nome; ícone ao lado do nome quando o painel é largo)
- [x] Os botões da barra são escolhidos nos Ajustes (Buscar, Cola, Copiar, Duplicar linha, Comentar, Ir para a linha...)
- [x] Barra de símbolos só com símbolos e setas; as setas repetem enquanto o dedo está em cima
- [x] Formatar mantém o cursor no lugar e não abre o teclado; opção "Formatar sozinho ao executar"
- [x] Cabeçalho do celular em uma linha só (mais tela para o código)
- [x] Botões maiores em tela de toque; faixa de erro compacta (toque para ler tudo); sem a faixa de arquivos quando há um só
- [x] Pinça com dois dedos no código muda o tamanho da letra
- [x] Tocar na bolinha de estado mostra o texto do estado
