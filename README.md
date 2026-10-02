# C# Pocket

Editor e terminal de C# que roda **inteiro no navegador**: o compilador (Roslyn) e o runtime do
.NET são carregados como WebAssembly. Não há servidor, e depois da primeira abertura também não
precisa de internet.

Feito para escrever C# no celular e no iPad: teclado com os símbolos difíceis, sugestões, erros em
português, passo a passo e terminal com cores, `ReadKey` e `Console.Clear`.

## Usar no celular ou no iPad

1. Abra o endereço do app no Safari (iPhone/iPad) ou no Chrome (Android).
2. **iPhone/iPad:** toque em Compartilhar → **Adicionar à Tela de Início**. **Android:** menu ⋮ → **Instalar app**.
3. Abra pelo ícone da tela inicial: o app abre em tela cheia, sem barra de endereço.

A primeira abertura baixa o .NET (cerca de 25 MB). Faça isso no Wi-Fi. Depois fica guardado no aparelho.

> O que roda: programas de console em C# (jogos de texto, lógica, classes, arquivos em memória).
> Não rodam: Unity, janelas do Windows (WinForms/WPF) e pacotes NuGet.

## Como o projeto está organizado

```
src/                  tudo o que o navegador recebe (é servido como está, sem bundler)
  index.html          a página
  manifest.webmanifest, sw.js, icons/   o app instalável e o funcionamento sem internet
  css/                visual, um arquivo por parte da tela
  js/                 o código da página, um módulo por função (veja abaixo)
  worker.js           roda em segundo plano: liga o .NET, compila e executa
  examples/           programas de exemplo e a "cola" de C#
  fonts/              fontes (JetBrains Mono e Instrument Sans, licença OFL)
  framework/          runtime do .NET 9 e Roslyn em WebAssembly (não se edita)
engine/               o motor em C# (vira o Pocket.dll)
tools/                build, servidor local e gerador de ícones
tests/                testes que abrem o app num navegador de verdade
.github/workflows/    publica no GitHub Pages a cada mudança na branch main
```

### Módulos de `src/js/`

| Arquivo | Função |
| --- | --- |
| `main.js` | liga tudo e inicia o app |
| `editor.js` | o editor: texto colorido, números de linha, marcas de erro, fecho automático de `( { [ "` |
| `highlight.js`, `format.js` | colorir e ajustar o recuo |
| `suggest.js`, `hints.js` | sugestões ao digitar; a dica em português da palavra sob o cursor |
| `keybar.js`, `editing.js`, `shortcuts.js` | barra de teclas, comandos de edição e atalhos |
| `terminal.js` | o terminal (cores, cursor, limpar tela) |
| `engine.js`, `run.js`, `steps.js` | o motor, executar o programa e o passo a passo |
| `projects.js`, `projects-ui.js`, `examples.js` | os programas guardados e a janela "Meus programas" |
| `cola.js` | modelos prontos de código |
| `settings.js`, `pwa.js`, `status.js`, `tabs.js`, `util.js` | ajustes, app instalável, estado e utilitários |
| `data/` | textos: explicações, erros em português, listas de sugestões |

## Trabalhar no projeto

Precisa de Node 20+ e do SDK do .NET 8 (ou mais novo).

```bash
npm install                 # só para os testes (playwright-core)
node tools/build.mjs engine # compila engine/ e coloca src/framework/Pocket.dll
node tools/serve.mjs        # abre http://localhost:8080 (service worker desligado em localhost)
node tools/build.mjs dist   # monta dist/ como será publicado
node tests/run.mjs          # testes (usam o Chrome instalado)
```

- Mudanças na página (visual, teclas, textos, exemplos): arquivos de `src/`.
- Mudanças no motor (o que o C# faz ao rodar, dicas, passo a passo): arquivos de `engine/`, depois `node tools/build.mjs engine`.
- Publicar: `git push` na branch `main`. O GitHub Actions compila o motor, monta o site e publica.

## Créditos

- Runtime do .NET 9 para WebAssembly e Roslyn 4.13 — Microsoft, licença MIT.
- Os arquivos de `src/framework/` vêm da publicação do projeto [LostBeard/BlazorWASMScriptLoader](https://github.com/LostBeard/BlazorWASMScriptLoader).
- JetBrains Mono e Instrument Sans — licença SIL Open Font License 1.1.
