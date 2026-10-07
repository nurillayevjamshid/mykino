(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const scrim = $('#menuScrim');
  const noteMenu = $('#noteMenu');
  const moveMenu = $('#moveMenu');
  const findPanel = $('#findPanel');
  const addMenu = $('#addMenu');
  const composerInput = $('#composerInput');
  const sendButton = $('#sendButton');
  const toast = $('#toast');
  const filePicker = $('#filePicker');
  const anyFilePicker = $('#anyFilePicker');
  let toastTimer;

  const closePanels = () => {
    [noteMenu, moveMenu, findPanel, addMenu].forEach((panel) => { panel.hidden = true; });
    scrim.hidden = true;
    $$('[data-menu-toggle]').forEach((button) => button.setAttribute('aria-expanded', 'false'));
    $('#addButton').setAttribute('aria-expanded', 'false');
  };

  const openPanel = (panel) => {
    closePanels();
    panel.hidden = false;
    if (panel === noteMenu || panel === moveMenu) scrim.hidden = false;
  };

  const announce = (message) => {
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2300);
  };

  $$('[data-menu-toggle]').forEach((button) => button.addEventListener('click', (event) => {
    event.stopPropagation();
    const wasOpen = !noteMenu.hidden;
    if (wasOpen) closePanels();
    else {
      openPanel(noteMenu);
      $$('[data-menu-toggle]').forEach((toggle) => toggle.setAttribute('aria-expanded', 'true'));
    }
  }));

  scrim.addEventListener('click', closePanels);
  $$('.menu-close').forEach((button) => button.addEventListener('click', closePanels));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closePanels();
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
      event.preventDefault();
      openFind();
    }
  });

  function openFind() {
    openPanel(findPanel);
    $('#findInput').focus();
  }

  $('[data-action="find"]').addEventListener('click', openFind);
  $('[data-action="move"]').addEventListener('click', () => openPanel(moveMenu));

  const findInput = $('#findInput');
  const findResult = $('#findResult');
  findInput.addEventListener('input', () => {
    const query = findInput.value.trim().toLowerCase();
    const cards = $$('.note-card');
    if (!query) {
      findResult.hidden = true;
      cards.forEach((card) => { card.style.opacity = ''; });
      return;
    }
    const matches = cards.filter((card) => card.innerText.toLowerCase().includes(query));
    cards.forEach((card) => { card.style.opacity = card.innerText.toLowerCase().includes(query) ? '1' : '.32'; });
    findResult.hidden = false;
    findResult.innerHTML = matches.length
      ? `<strong>${matches.length} ${matches.length === 1 ? 'note' : 'notes'} found</strong>${matches.map((card) => card.querySelector('strong').textContent).join(' · ')}`
      : '<strong>No notes found</strong>Try a different word or phrase.';
  });
  findPanel.querySelector('.menu-close').addEventListener('click', () => {
    findInput.value = '';
    findResult.hidden = true;
    $$('.note-card').forEach((card) => { card.style.opacity = ''; });
  });

  $$('.folder-option').forEach((option) => option.addEventListener('click', () => {
    $$('.folder-option').forEach((item) => item.classList.remove('is-selected'));
    option.classList.add('is-selected');
    const destination = option.dataset.folder;
    window.setTimeout(() => {
      closePanels();
      announce(`Note moved to ${destination}`);
    }, 220);
  }));

  const resizeInput = () => {
    composerInput.style.height = 'auto';
    composerInput.style.height = `${Math.min(composerInput.scrollHeight, 128)}px`;
    sendButton.disabled = composerInput.value.trim().length === 0;
  };
  composerInput.addEventListener('input', resizeInput);
  composerInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  function sendMessage() {
    const text = composerInput.value.trim();
    if (!text) return;
    const message = document.createElement('div');
    message.className = 'user-message glass-panel';
    message.textContent = text;
    $('#thread').append(message);
    composerInput.value = '';
    resizeInput();
    closePanels();
    announce('Your thought is here.');
    message.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  sendButton.addEventListener('click', sendMessage);

  $$('.suggestion-chip').forEach((chip) => chip.addEventListener('click', () => {
    composerInput.value = chip.dataset.prompt;
    resizeInput();
    composerInput.focus();
  }));

  $('#addButton').addEventListener('click', (event) => {
    event.stopPropagation();
    const opening = addMenu.hidden;
    closePanels();
    addMenu.hidden = !opening;
    $('#addButton').setAttribute('aria-expanded', String(opening));
  });
  document.addEventListener('click', (event) => {
    if (!addMenu.hidden && !addMenu.contains(event.target) && !$('#addButton').contains(event.target)) closePanels();
  });
  $$('[data-attach="image"]').forEach((button) => button.addEventListener('click', () => { closePanels(); filePicker.click(); }));
  $$('[data-attach="file"]').forEach((button) => button.addEventListener('click', () => { closePanels(); anyFilePicker.click(); }));
  $('#imageButton').addEventListener('click', () => filePicker.click());
  filePicker.addEventListener('change', () => {
    if (filePicker.files?.[0]) announce(`Image ready: ${filePicker.files[0].name}`);
    filePicker.value = '';
  });
  anyFilePicker.addEventListener('change', () => {
    if (anyFilePicker.files?.[0]) announce(`File ready: ${anyFilePicker.files[0].name}`);
    anyFilePicker.value = '';
  });
  $$('[data-toast]').forEach((button) => button.addEventListener('click', () => announce(button.dataset.toast)));
})();
