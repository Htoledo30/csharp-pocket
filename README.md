# C# Pocket

Editor e terminal de C# que roda **inteiro no navegador**: o compilador (Roslyn) e o runtime do .NET são carregados como
WebAssembly. Não há servidor e, depois da primeira abertura, nem internet.

Feito para escrever C# no celular e no iPad: teclado com os símbolos difíceis, sugestões do próprio compilador, erros
sublinhados e explicados em português com conserto de um toque, passo a passo, vários arquivos por programa, console
de verdade (`ReadKey`, `KeyAvailable`, jogos em tempo real) e arquivos que ficam guardados entre uma execução e outra.

**Endereço do app:** https://htoledo30.github.io/csharp-pocket/

## Usar no celular ou no iPad (tela cheia, sem barra do navegador)

1. Abra o endereço acima no **Safari** (iPhone/iPad) ou no **Chrome** (Android).
2. **iPhone/iPad:** toque em Compartilhar → **Adicionar à Tela de Início**. **Android:** menu ⋮ → **Instalar app**.
3. Abra pelo ícone da tela inicial.

A primeira abertura baixa o .NET (cerca de 8 MB pela rede; 25 MB depois de descompactar). Faça no Wi-Fi. Depois fica guardado
no aparelho e o app funciona sem internet. Quando sai uma versão nova, o app avisa e atualiza com um toque.

> O que roda: programas de console em C# — jogos de texto, lógica, classes, LINQ, arquivos, `async/await`.
> O que não roda: Unity, janelas do Windows (WinForms/WPF), threads de verdade e pacotes NuGet.

### Meus programas em todos os aparelhos

Ajustes → **Sincronizar com o GitHub**: crie um token só com a permissão `gist` (o app abre a página certa), cole no app e
conecte. Os programas ficam num gist secreto da sua conta e aparecem em todo aparelho em que você conectar. Também dá para
**exportar** (`.json` de backup ou `.zip` com os `.cs`) e **importar**.

## Como o projeto está organizado

```
src/                  tudo o que o navegador recebe (é servido como está, sem bundler)
  index.html          a página
  manifest.webmanifest, sw.js, icons/   o app instalável e o funcionamento sem internet
  css/                visual, um arquivo por parte da tela
  js/                 o código da página, um módulo por função
  worker.js           roda em segundo plano: liga o .NET, compila e executa
  examples/           programas de exemplo e a "cola" de C#
  fonts/              fontes (JetBrains Mono e Instrument Sans, licença OFL)
  framework/          runtime do .NET 9 e Roslyn em WebAssembly (não se edita)
engine/               o motor em C# (vira o Pocket.dll)
tools/                build, servidor local, ícones e ferramentas de depuração
tests/                testes que abrem o app num navegador de verdade
docs/                 ARQUITETURA.md (como funciona por dentro) e PLANO.md (o que já foi feito)
.github/workflows/    publicar.yml (publica no GitHub Pages) e testes.yml
```

### Módulos de `src/js/`

| Arquivo | Função |
| --- | --- |
| `main.js` | liga tudo e inicia o app |
| `editor.js`, `highlight.js`, `format.js`, `brackets.js` | o editor: texto colorido, números de linha, marcas, fecho automático, recuo |
| `commands.js`, `find.js`, `keybar.js`, `more.js`, `shortcuts.js`, `editing.js` | comandos de linha, buscar/trocar, barra de teclas, menu Mais e atalhos |
| `suggest.js`, `language.js`, `diagnostics.js`, `problems.js`, `fixes.js`, `hints.js` | sugestões, erros ao digitar, consertos e a dica da palavra |
| `engine.js`, `run.js`, `steps.js`, `terminal.js` | o motor, executar, passo a passo e o terminal |
| `projects.js`, `projects-ui.js`, `filetabs.js`, `fsstore.js`, `examples.js`, `cola.js` | programas, arquivos do programa e exemplos |
| `backup.js`, `zip.js`, `history.js`, `history-ui.js`, `sync.js`, `data-ui.js` | exportar/importar, histórico e sincronização |
| `settings.js`, `settings-ui.js`, `pwa.js`, `status.js`, `tabs.js`, `dialog.js`, `util.js` | ajustes, app instalável e utilitários |
| `data/` | textos: explicações, erros em português, listas de sugestões |

Veja `docs/ARQUITETURA.md` para entender como as peças se falam.

## Trabalhar no projeto

Precisa de Node 20+ e do SDK do .NET 8 (ou mais novo).

```bash
npm install                  # só para os testes (playwright-core)
node tools/build.mjs engine  # compila engine/ e coloca src/framework/Pocket.dll
node tools/serve.mjs         # abre http://localhost:8080 (service worker desligado em localhost)
node tools/build.mjs dist    # monta dist/ como será publicado
node tests/run.mjs           # todos os testes (usam o Chrome instalado)
BROWSER=webkit node tests/run.mjs   # os mesmos no motor do Safari (npx playwright-core install webkit)
```

- Mudanças na página (visual, teclas, textos, exemplos): arquivos de `src/`.
- Mudanças no motor (o que o C# faz ao rodar, dicas, passo a passo): arquivos de `engine/`, depois `node tools/build.mjs engine`.
- Publicar: `git push` na branch `main`. O GitHub Actions compila o motor, monta o site e publica em alguns minutos.

## Créditos

- Runtime do .NET 9 para WebAssembly e Roslyn 4.13 — Microsoft, licença MIT.
- Os arquivos de `src/framework/` vêm da publicação do projeto [LostBeard/BlazorWASMScriptLoader](https://github.com/LostBeard/BlazorWASMScriptLoader).
- JetBrains Mono e Instrument Sans — licença SIL Open Font License 1.1.
