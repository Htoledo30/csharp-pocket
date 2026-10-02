// Gera os ícones do app (PNG e SVG) em src/icons: node tools/make-icons.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChrome } from './browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'src', 'icons');
const font = 'data:font/woff2;base64,' + fs.readFileSync(path.join(root, 'src', 'fonts', 'JetBrainsMono-var.woff2')).toString('base64');
fs.mkdirSync(out, { recursive: true });

// `pad` é a margem em volta do desenho (o ícone "maskable" precisa de folga: o sistema corta as bordas).
// `round` arredonda os cantos (o iPhone arredonda sozinho, então o ícone dele vai quadrado).
const svg = ({ pad = 0, round = true, family = 'JetBrains Mono, ui-monospace, Menlo, Consolas, monospace' } = {}) => {
  const s = 512 - pad * 2;
  const k = s / 512;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6b4de0"/><stop offset="1" stop-color="#37228f"/></linearGradient></defs>
  <rect width="512" height="512" ${round ? 'rx="112"' : ''} fill="url(#g)"/>
  <g transform="translate(${pad} ${pad}) scale(${k})">
    <text x="256" y="312" text-anchor="middle" font-family="${family}" font-weight="800" font-size="230" fill="#ffffff" letter-spacing="-12">C#</text>
    <rect x="148" y="368" width="216" height="24" rx="12" fill="#b7a2ff"/>
  </g>
</svg>`;
};

const browser = await launchChrome();
const page = await browser.newPage();

async function png(name, size, markup) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>@font-face{font-family:"JetBrains Mono";src:url(${font});font-weight:100 800}html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${markup}`);
  await page.evaluate(() => document.fonts.load('800 100px "JetBrains Mono"'));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(out, name), omitBackground: true });
  console.log('icons/' + name);
}

await png('icon-512.png', 512, svg());
await png('icon-192.png', 192, svg());
await png('icon-32.png', 32, svg());
await png('icon-maskable-512.png', 512, svg({ pad: 64, round: false }));
await png('apple-touch-icon.png', 180, svg({ round: false }));
fs.writeFileSync(path.join(out, 'icon.svg'), svg());
console.log('icons/icon.svg');
await browser.close();
