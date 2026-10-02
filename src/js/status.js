// A bolinha e o texto no canto: carregando, pronto, executando, esperando você.
import { $ } from './util.js';

export const engineState = { ready: false, version: '', loading: true, live: false };
let busyProbe = () => false;
export const setBusyProbe = (fn) => { busyProbe = fn; };
export const isBusy = () => busyProbe();

export function setStatus(state, text) {
  $('status').dataset.state = state;
  $('statusText').textContent = text;
}

export function idleStatus() {
  if (engineState.ready) setStatus('ready', engineState.version || 'Pronto');
  else setStatus('loading', 'Carregando o .NET…');
}
