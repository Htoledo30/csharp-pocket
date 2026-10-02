// Abas Código / Terminal (só aparecem no celular; nas telas largas os dois painéis ficam juntos).
import { $, narrow } from './util.js';

export function showTab(which) {
  const codeOn = which === 'code';
  $('paneCode').classList.toggle('off', !codeOn);
  $('paneTerm').classList.toggle('off', codeOn);
  $('tabCode').setAttribute('aria-selected', String(codeOn));
  $('tabTerm').setAttribute('aria-selected', String(!codeOn));
  if (!codeOn) {
    $('pip').hidden = true;
    $('termScroll').scrollTop = $('termScroll').scrollHeight;
    if (narrow() && document.activeElement === $('code')) $('code').blur();
  }
}

export const termVisible = () => !$('paneTerm').classList.contains('off');

export function initTabs() {
  $('tabCode').addEventListener('click', () => showTab('code'));
  $('tabTerm').addEventListener('click', () => showTab('term'));
}
