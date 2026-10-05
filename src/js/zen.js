// Código em tela cheia: some tudo (cabeçalho, abas, terminal) e sobra só o editor com as barras de ações e de teclas.
// Igual ao "Tela cheia" do terminal, mas para quem está escrevendo.
import { $, bus } from './util.js';
import { showTab } from './tabs.js';

const EXPAND = 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5';
const COLLAPSE = 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5';

export const inZen = () => $('app').classList.contains('zen');

export function setZen(on) {
  if (on === inZen()) return;
  if (on) showTab('code');
  $('app').classList.toggle('zen', on);
  const b = $('zenBtn');
  b.setAttribute('aria-pressed', String(on));
  const label = on ? 'Sair da tela cheia' : 'Código em tela cheia';
  b.setAttribute('aria-label', label);
  b.title = label;
  $('zenIcon').setAttribute('d', on ? COLLAPSE : EXPAND);
  bus.emit('zen:mode', on);
}

export const toggleZen = () => setZen(!inZen());

export function initZen() {
  const tools = $('zenTools');
  // Tocar nos botões não pode tirar o foco do editor (senão o teclado do celular fecha ao entrar na tela cheia).
  tools.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
  $('zenBtn').addEventListener('click', toggleZen);
  $('zenKb').addEventListener('click', () => { const a = document.activeElement; if (a && a.blur) a.blur(); });
  // O programa escreve no terminal: ao executar, a tela cheia do código termina.
  bus.on('run:state', (running) => { if (running) setZen(false); });
}
