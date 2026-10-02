// Pinça com dois dedos no código: aumenta ou diminui a letra (e o app lembra o tamanho).
import { $, toast } from './util.js';
import { setFontSize, fontSize } from './editor.js';
import { settings, saveSettings } from './settings.js';

const distance = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

export function initPinch() {
  const area = $('scroller');
  let start = 0, base = 0, last = 0;

  area.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) { start = distance(e.touches); base = fontSize(); last = base; }
  }, { passive: true });

  area.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 2 || !start) return;
    e.preventDefault();                               // sem isso a página inteira dá zoom
    const px = Math.round(base * (distance(e.touches) / start));
    if (px !== last) { last = setFontSize(px); }
  }, { passive: false });

  const done = () => {
    if (!start) return;
    start = 0;
    settings.font = Math.round(fontSize());
    saveSettings();
    toast('Tamanho da letra: ' + settings.font);
  };
  area.addEventListener('touchend', (e) => { if (e.touches.length < 2) done(); });
  area.addEventListener('touchcancel', done);
  // O Safari tem um evento próprio de pinça da página: bloquear dentro do editor.
  area.addEventListener('gesturestart', (e) => e.preventDefault());
  area.addEventListener('gesturechange', (e) => e.preventDefault());
}
