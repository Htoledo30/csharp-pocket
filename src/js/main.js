// C# Pocket: aqui tudo é ligado e o app começa.
import { $ } from './util.js';
import { initTabs } from './tabs.js';
import { initEditor } from './editor.js';
import { initShortcuts } from './shortcuts.js';
import { initSuggest } from './suggest.js';
import { initHints } from './hints.js';
import { initKeybar } from './keybar.js';
import { initEditing } from './editing.js';
import { initRun } from './run.js';
import { initSteps } from './steps.js';
import { initCola } from './cola.js';
import { initProjectsUi, bootProjects } from './projects-ui.js';
import { initProblems } from './problems.js';
import { initDiagnostics } from './diagnostics.js';
import { initLanguage } from './language.js';
import { initFind } from './find.js';
import { initMore } from './more.js';
import { initSettingsUi } from './settings-ui.js';
import { initBrackets } from './brackets.js';
import { initHistory } from './history.js';
import { initPad } from './pad.js';
import { initDataUi } from './data-ui.js';
import { applySettings } from './settings.js';
import { spawn } from './engine.js';
import { note } from './terminal.js';
import { installFirstTime, watchUpdates, keepStorage, offlineSupported, installHint, listenInstallPrompt, launchCount } from './pwa.js';

// Mantém o app dentro da área visível quando o teclado do celular abre.
function fitToKeyboard() {
  if (!window.visualViewport) return;
  const app = $('app');
  const fit = () => {
    const vv = window.visualViewport;
    // O teclado do celular encolhe a área visível (e o iOS ainda pode deslocá-la): o app acompanha as duas coisas.
    if (vv.height < window.innerHeight - 60) {
      app.style.setProperty('--app-h', vv.height + 'px');
      app.style.setProperty('--app-y', vv.offsetTop + 'px');
    } else {
      app.style.removeProperty('--app-h');
      app.style.removeProperty('--app-y');
    }
  };
  window.visualViewport.addEventListener('resize', fit);
  window.visualViewport.addEventListener('scroll', fit);
}

async function main() {
  if (await installFirstTime()) return;

  initTabs();
  initEditor();
  initShortcuts();
  initSuggest();
  initHints();
  initKeybar();
  initEditing();
  initPad();
  initRun();
  initSteps();
  initCola();
  initProjectsUi();
  initDiagnostics();
  initProblems();
  initLanguage();
  initFind();
  initMore();
  initSettingsUi();
  initBrackets();
  initHistory();
  initDataUi();
  applySettings();
  fitToKeyboard();
  listenInstallPrompt();
  await bootProjects();

  const offline = offlineSupported() ? ' Depois disso o app também funciona sem internet.' : '';
  const tip = installHint() && launchCount() <= 3 ? '\n\n<b>Dica:</b> ' + installHint() : '';
  note('hint', '<b>O compilador roda aqui no navegador.</b> A primeira abertura baixa o .NET (cerca de 25 MB); depois disso cada execução é local e leva uma fração de segundo.' + offline +
    '\n\nToque em <b>Executar</b>. Quando o programa pedir texto ou uma tecla, a resposta é digitada aqui embaixo, na hora.' + tip);
  spawn();
  watchUpdates();
  keepStorage();
}

main();
