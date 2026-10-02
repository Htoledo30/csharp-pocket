// Os programas de exemplo (a pasta examples/ do site).
// `files`: exemplos com vários arquivos ficam numa pasta com o mesmo nome do id (examples/batalha/Program.cs...).
export const EXAMPLES = [
  { id: 'ola', title: 'Olá, mundo' },
  { id: 'nome', title: 'Ler um nome' },
  { id: 'adivinhe', title: 'Adivinhe o número' },
  { id: 'calculadora', title: 'Calculadora' },
  { id: 'forca', title: 'Forca' },
  { id: 'combate', title: 'Combate' },
  { id: 'labirinto', title: 'Labirinto' },
  { id: 'cobrinha', title: 'Cobrinha (tempo real)' },
  { id: 'salvar', title: 'Guardar recorde (arquivos)' },
  { id: 'batalha', title: 'Batalha (4 arquivos)', files: ['Program.cs', 'Personagem.cs', 'Heroi.cs', 'Monstro.cs'] },
];

const cache = new Map();

async function fetchText(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error('exemplo não encontrado: ' + path);
  return res.text();
}

// Os arquivos de um exemplo: [{ name, code }]
export async function exampleFiles(id) {
  if (cache.has(id)) return cache.get(id).map((f) => ({ ...f }));
  const entry = EXAMPLES.find((e) => e.id === id);
  const names = entry && entry.files ? entry.files : null;
  const files = names
    ? await Promise.all(names.map(async (name) => ({ name, code: await fetchText('examples/' + id + '/' + name) })))
    : [{ name: 'Program.cs', code: await fetchText('examples/' + id + '.cs') }];
  cache.set(id, files);
  return files.map((f) => ({ ...f }));
}

export async function exampleCode(id) {
  return (await exampleFiles(id))[0].code;
}
