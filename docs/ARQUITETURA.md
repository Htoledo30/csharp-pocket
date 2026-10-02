# Como o C# Pocket funciona por dentro

Resumo para quem for mexer no código. O app não tem servidor: tudo roda no navegador.

## As peças

```
página (src/index.html + js/)  ⇄  worker.js  ⇄  Pocket.dll (engine/, C#)  +  Roslyn  +  runtime do .NET (WebAssembly)
```

- **A página** (`src/js/`) cuida da tela: editor, terminal, janelas, programas guardados.
- **O worker** (`src/worker.js`) roda em segundo plano e carrega o runtime do .NET. Assim a tela nunca trava enquanto
  o compilador trabalha.
- **O motor** (`engine/*.cs`, vira `Pocket.dll`) é o código C# que roda dentro do .NET em WebAssembly: compila com
  Roslyn, executa o programa, responde às perguntas de sugestão e erros.
- **`src/framework/`** é o runtime do .NET 9 e o Roslyn já em WebAssembly (não se edita).

## Compilar e executar (`Host.cs`, `Host.Workspace.cs`)

Os arquivos do programa viajam como um texto só (`nome\u0002código`, separados por `\u0001`). `Update()` mantém uma
compilação do Roslyn e, quando só um arquivo muda, troca só aquela árvore de sintaxe — por isso erros e sugestões
respondem em dezenas de milissegundos.

Antes dos arquivos do usuário entra um arquivo invisível com os `global using` (System, Linq, Collections.Generic...) e os
substitutos de `Console`, `Random` e `Thread`, que fazem `ReadKey`, `Clear`, cores e cursor funcionarem no navegador.

## Console real (ao vivo) e reexecutar

O navegador não deixa um programa "esperar" pelo teclado. Há dois jeitos de contornar, escolhidos sozinhos:

1. **Ao vivo** (`crossOriginIsolated` ligado): a página e o worker dividem um `SharedArrayBuffer` com uma fila de teclas.
   `Console.ReadLine/ReadKey` chamam `read()` no worker, que dorme em `Atomics.wait` até a página escrever na fila.
   `KeyAvailable` olha a fila (`poll()`), `Thread.Sleep` dorme com `Atomics.wait` (`sleep()`), e **Parar** liga um
   sinal na fila que desmonta o programa (`AbortProgram`). Se o programa estiver preso numa conta, o motor é reiniciado.
2. **Reexecutar** (sem isolamento): a cada resposta o programa roda de novo desde o começo, repetindo as respostas
   anteriores e escondendo a saída já mostrada. Funciona para programas comuns, mas `KeyAvailable` e jogos em tempo real
   não.

O isolamento vem do **service worker** (`src/sw.js`), que acrescenta os cabeçalhos `Cross-Origin-Opener-Policy` e
`Cross-Origin-Embedder-Policy` a todas as respostas (o GitHub Pages não deixa configurar cabeçalhos). Por isso, na
primeira abertura a página se registra e recarrega uma vez (`pwa.js: installFirstTime`).

## Sugestões, erros e ajuda dos parâmetros (`Host.Language.cs`, `language.js`, `suggest.js`)

- `Analyze` devolve os erros com posição exata (sublinhado) e, para nomes errados, palavras parecidas ("você quis dizer").
- `Complete` troca a palavra que está sendo digitada por um nome fixo (`__pocket__`) e pergunta ao modelo semântico o
  que existe naquela posição (`LookupSymbols`), inclusive os métodos de extensão (Linq) e as classes do próprio programa.
- `Signature` acha a chamada de método em que o cursor está e devolve as formas (sobrecargas) com o parâmetro ativo.
- A página só pergunta quando o motor está livre (`canAsk`) e só a última pergunta de cada tipo vale. Com um programa
  rodando ao vivo o motor está ocupado: as sugestões caem na lista pronta de `data/completions.js`.
- Os consertos de um toque (`fixes.js`) são montados na página a partir do erro.

## Arquivos do programa (`Host.Fs.cs`, `fsstore.js`)

`File.WriteAllText` & cia. escrevem numa pasta em memória (`/work`). Antes de cada execução a página entrega o último
estado guardado do programa (IndexedDB) e, no fim, o motor devolve a pasta inteira, que é guardada de novo.

## Passo a passo (`Marker.cs`, `Step.cs`, `steps.js`)

O programa é reescrito para que cada comando avise a sua linha e as variáveis visíveis; roda uma vez e grava tudo. Andar
pelos passos é navegar nessa gravação. O número da linha carrega também o arquivo (`arquivo * 1.000.000 + linha`).

## Dados do usuário

| O quê | Onde |
| --- | --- |
| programas e ajustes | `localStorage` (`pocket.projects`, `pocket.settings`) |
| arquivos gravados pelos programas | IndexedDB `pocket-files` |
| histórico de versões | IndexedDB `pocket-history` |
| o app e o .NET para usar sem internet | Cache Storage (service worker) |
| token da sincronização | `localStorage` (`pocket.sync`), só vai para `api.github.com` |

A sincronização (`sync.js`) usa um gist secreto: programa por programa vence quem foi mexido por último.

## Atualizações

`tools/build.mjs dist` calcula uma versão (hash dos arquivos do app) e a do runtime (hash do `framework/`) e grava no
`sw.js`. Uma versão nova do app baixa só o que mudou; o runtime só é baixado de novo se o próprio `framework/` mudar.
O app avisa ("Nova versão pronta — Atualizar") e troca de versão ao confirmar.

## Ideias que ficaram para depois

- **.NET 10 / C# 14**: a publicação de um projeto Blazor WebAssembly no .NET 10 funciona sem workloads, mas o formato do
  carregador mudou (configuração embutida no `dotnet.js`); seria preciso adaptar `worker.js` e `Host.AddReference`.
- Um segundo worker só para sugestões, para elas continuarem funcionando com um programa rodando ao vivo.
- `System.Console.ReadKey` escrito por extenso não passa pelo substituto (`Console.ReadKey` passa).
