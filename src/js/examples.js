// Os programas de exemplo (a pasta examples/ do site).
export const EXAMPLES = [
  { id: 'ola', title: 'Olá, mundo' },
  { id: 'nome', title: 'Ler um nome' },
  { id: 'combate', title: 'Combate' },
  { id: 'labirinto', title: 'Labirinto' },
];

const cache = new Map();
export async function exampleCode(id) {
  if (cache.has(id)) return cache.get(id);
  const res = await fetch('examples/' + id + '.cs');
  if (!res.ok) throw new Error('exemplo não encontrado: ' + id);
  const text = await res.text();
  cache.set(id, text);
  return text;
}
