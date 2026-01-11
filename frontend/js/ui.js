const writeActionSelectors = [
  '#btn-new-project',
  '#btn-save-project',
  '#btn-delete-project',
  '#btn-import-uapf',
  '#btn-export-uapf',
  '#btn-bpmn-import-xml',
  '#btn-dmn-import-xml',
  '#btn-cmmn-import-xml',
  '#btn-bpmn-export-xml',
  '#btn-dmn-export-xml',
  '#btn-cmmn-export-xml'
];

export function uiSetMode(mode) {
  const demoBanner = document.getElementById('demo-mode-banner');
  const authActions = document.getElementById('auth-actions');
  const userMenu = document.getElementById('user-menu');

  const manifestEditor = document.getElementById('manifest-editor');
  const bpmnXmlEditor = document.getElementById('bpmn-xml-editor');
  const dmnXmlEditor = document.getElementById('dmn-xml-editor');
  const cmmnXmlEditor = document.getElementById('cmmn-xml-editor');

  const isAuth = mode === 'auth';
  const isGuest = mode === 'guest';

  writeActionSelectors.forEach((selector) => {
    const btn = document.querySelector(selector);
    if (!btn) return;
    btn.disabled = !isAuth;
  });

  if (authActions) {
    authActions.classList.toggle('hidden', !isGuest);
  }

  if (userMenu) {
    userMenu.classList.toggle('hidden', !isAuth);
  }

  if (demoBanner) {
    demoBanner.classList.toggle('hidden', !isGuest);
  }

  const editors = [manifestEditor, bpmnXmlEditor, dmnXmlEditor, cmmnXmlEditor];
  editors.forEach((editor) => {
    if (!editor) return;
    editor.readOnly = !isAuth;
  });
}

export function uiSetAuthReady(isReady) {
  const signInBtn = document.getElementById('btn-sign-in');
  const signUpBtn = document.getElementById('btn-sign-up');

  if (signInBtn) {
    signInBtn.disabled = !isReady;
  }

  if (signUpBtn) {
    signUpBtn.disabled = !isReady;
  }
}

export function uiShowAuthError(message) {
  const demoBanner = document.getElementById('demo-mode-banner');
  if (!demoBanner) return;
  demoBanner.textContent = message;
  demoBanner.classList.remove('hidden');
}

export function uiRenderProjectList({ items, activeId, emptyMessage, onSelect }) {
  const list = document.getElementById('project-list');
  if (!list) return;

  list.innerHTML = '';

  if (!items.length) {
    const li = document.createElement('li');
    li.textContent = emptyMessage || 'No projects yet';
    list.appendChild(li);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item.title || item.id;
    li.dataset.projectId = item.id;
    li.classList.add('project-item', 'py-1', 'px-2');

    if (activeId && activeId === item.id) {
      li.classList.add('active');
    }

    li.addEventListener('click', async () => {
      if (onSelect) {
        await onSelect(item.id);
      }
    });

    list.appendChild(li);
  });
}

export function uiSelectProject(projectId) {
  const list = document.getElementById('project-list');
  if (!list) return;

  list.querySelectorAll('.project-item').forEach((item) => {
    if (item.dataset.projectId === projectId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}

export function uiShowToast(message, timeout = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast-item';
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, timeout);
}

export function uiSetProjectName(name) {
  const projNameEl = document.getElementById('current-project-name');
  if (projNameEl) {
    projNameEl.textContent = name || 'No project selected';
  }
}

export function uiSetUser(user) {
  const greeting = document.getElementById('user-greeting');
  if (!greeting) return;

  const displayName = user?.name || user?.email || 'User';
  greeting.textContent = displayName;
}
