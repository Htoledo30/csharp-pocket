// Ajustes do app, guardados neste aparelho.
import { local } from './util.js';
import { setFontSize } from './editor.js';

const KEY = 'pocket.settings';

export const settings = Object.assign({ font: 0, theme: 'auto' }, local.getJson(KEY, {}));

export function saveSettings() { local.setJson(KEY, settings); }

export function applyTheme() {
  const root = document.documentElement;
  if (settings.theme === 'light' || settings.theme === 'dark') root.dataset.theme = settings.theme;
  else delete root.dataset.theme;
}

export function applySettings() {
  if (settings.font) setFontSize(settings.font);
  applyTheme();
}
