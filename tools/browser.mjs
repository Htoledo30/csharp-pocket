// Abre um navegador de verdade para os testes e para gerar imagens.
// Usa o Chrome (ou o Edge) que já está instalado; não baixa nada.
import fs from 'node:fs';
import { chromium, webkit } from 'playwright-core';

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

export function findChrome() {
  const found = CANDIDATES.find((p) => fs.existsSync(p));
  if (!found) throw new Error('Chrome ou Edge não encontrado. Defina CHROME_PATH com o caminho do navegador.');
  return found;
}

export function launchChrome(options = {}) {
  return chromium.launch({ executablePath: findChrome(), headless: true, ...options });
}

// O WebKit do Playwright (parecido com o Safari do iPhone), se estiver instalado: npx playwright-core install webkit
export async function launchWebKit(options = {}) {
  return webkit.launch({ headless: true, ...options });
}
