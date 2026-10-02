// Janelinhas simples: pedir um texto e confirmar uma ação. Sobem de baixo no celular (veja modals.css).
function build(title, bodyNodes, buttons) {
  const back = document.createElement('div');
  back.className = 'modal-back';
  const box = document.createElement('div');
  box.className = 'modal small';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  const head = document.createElement('div');
  head.className = 'modal-head';
  const h = document.createElement('h2');
  h.textContent = title;
  head.append(h);
  const body = document.createElement('div');
  body.className = 'modal-body';
  body.append(...bodyNodes);
  const row = document.createElement('div');
  row.className = 'dialog-buttons';
  row.append(...buttons);
  body.append(row);
  box.append(head, body);
  back.append(box);
  document.body.append(back);
  return back;
}

export function askText({ title, label, value = '', ok = 'Salvar', placeholder = '', check }) {
  return new Promise((resolve) => {
    const form = document.createElement('form');
    form.className = 'dialog-form';
    const text = document.createElement('label');
    text.textContent = label;
    const input = document.createElement('input');
    input.value = value; input.placeholder = placeholder; input.maxLength = 60;
    input.autocomplete = 'off'; input.spellcheck = false; input.autocapitalize = 'off';
    input.setAttribute('aria-label', label);
    const error = document.createElement('p');
    error.className = 'dialog-error';
    error.hidden = true;
    form.append(text, input, error);
    const cancel = document.createElement('button');
    cancel.type = 'button'; cancel.className = 'mini'; cancel.textContent = 'Cancelar';
    const okButton = document.createElement('button');
    okButton.type = 'submit'; okButton.className = 'mini strong'; okButton.textContent = ok;
    okButton.setAttribute('form', 'dialog-form');
    form.id = 'dialog-form';
    const back = build(title, [form], [cancel, okButton]);
    const close = (result) => { back.remove(); resolve(result); };
    cancel.addEventListener('click', () => close(null));
    back.addEventListener('click', (e) => { if (e.target === back) close(null); });
    back.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(null); });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const answer = input.value.trim();
      const problem = check ? check(answer) : '';
      if (problem) { error.textContent = problem; error.hidden = false; return; }
      close(answer);
    });
    setTimeout(() => { input.focus(); input.select(); }, 0);
  });
}

export function confirmDialog({ title, text, ok = 'Confirmar', danger = false }) {
  return new Promise((resolve) => {
    const p = document.createElement('p');
    p.className = 'dialog-text';
    p.textContent = text;
    const cancel = document.createElement('button');
    cancel.className = 'mini'; cancel.textContent = 'Cancelar';
    const okButton = document.createElement('button');
    okButton.className = 'mini ' + (danger ? 'danger' : 'strong'); okButton.textContent = ok;
    const back = build(title, [p], [cancel, okButton]);
    const close = (result) => { back.remove(); resolve(result); };
    cancel.addEventListener('click', () => close(false));
    okButton.addEventListener('click', () => close(true));
    back.addEventListener('click', (e) => { if (e.target === back) close(false); });
    back.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(false); });
    setTimeout(() => okButton.focus(), 0);
  });
}

// Lista de ações (como o menu "Mais"): devolve a escolhida ou null.
export function chooseAction({ title, actions }) {
  return new Promise((resolve) => {
    const list = document.createElement('div');
    list.className = 'action-list';
    const cancel = document.createElement('button');
    cancel.className = 'mini'; cancel.textContent = 'Fechar';
    const back = build(title, [list], [cancel]);
    const close = (result) => { back.remove(); resolve(result); };
    for (const action of actions) {
      const b = document.createElement('button');
      b.className = 'action' + (action.danger ? ' danger' : '');
      b.textContent = action.label;
      b.addEventListener('click', () => close(action.id));
      list.append(b);
    }
    cancel.addEventListener('click', () => close(null));
    back.addEventListener('click', (e) => { if (e.target === back) close(null); });
    back.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(null); });
  });
}
