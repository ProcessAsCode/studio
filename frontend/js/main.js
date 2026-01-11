// Algomation Studio – auth + demo mode implementation

import { authManager } from './auth.js';
import { apiClient } from './api-client.js';
import { loadDemoCatalog, loadDemoProjectById } from './demo.js';
import { renderBpmnViewer, renderDmnViewer, renderCmmnViewer, destroyViewers } from './viewers.js';
import {
  uiSetMode,
  uiRenderProjectList,
  uiSelectProject,
  uiShowToast,
  uiSetProjectName,
  uiSetUser
} from './ui.js';

const MODE_GUEST = 'guest';
const MODE_AUTH = 'auth';

const APP = {
  mode: 'guest',
  projects: [],
  currentProjectId: null,
  currentProject: null,
  demo: { catalog: [], currentDemoId: null },
  user: null
};

window.APP = APP;

const DEV_OFFLINE_OK = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

let bpmnModeler = null;
let dmnModeler = null;
let cmmnModeler = null;

// ---------------------------------------------------------------------------
// Default XML templates
// ---------------------------------------------------------------------------

const EMPTY_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_1"
                  targetNamespace="http://algomation.io/bpmn">
  <bpmn:process id="Process_main" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" name="Start">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:task id="Task_1" name="Do work">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:task>
    <bpmn:endEvent id="EndEvent_1" name="End">
      <bpmn:incoming>Flow_2</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_1" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="EndEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_main">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="179" y="79" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1">
        <dc:Bounds x="250" y="69" width="100" height="56" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1">
        <dc:Bounds x="379" y="79" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="215" y="97" />
        <di:waypoint x="250" y="97" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="350" y="97" />
        <di:waypoint x="379" y="97" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
`;

const EMPTY_DMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/"
             xmlns:dmndi="https://www.omg.org/spec/DMN/20191111/DMNDI/"
             xmlns:dc="http://www.omg.org/spec/DMN/20180521/DC/"
             id="definitions"
             name="Risk Decisions"
             namespace="http://algomation.io/dmn">
  <decision id="Decision_main" name="Risk rating">
    <decisionTable id="decisionTable_1">
      <input id="Input_1" label="Score">
        <inputExpression id="InputExpression_1" typeRef="number">
          <text>score</text>
        </inputExpression>
      </input>
      <output id="Output_1" label="Risk" name="risk" typeRef="string" />
      <rule id="Rule_low">
        <inputEntry id="InputEntry_low"><text>&lt; 30</text></inputEntry>
        <outputEntry id="OutputEntry_low"><text>"Low"</text></outputEntry>
      </rule>
      <rule id="Rule_med">
        <inputEntry id="InputEntry_med"><text>[30..70]</text></inputEntry>
        <outputEntry id="OutputEntry_med"><text>"Medium"</text></outputEntry>
      </rule>
      <rule id="Rule_high">
        <inputEntry id="InputEntry_high"><text>&gt; 70</text></inputEntry>
        <outputEntry id="OutputEntry_high"><text>"High"</text></outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>
`;

const EMPTY_CMMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/CMMN/20151109/MODEL"
             id="Definitions_1"
             targetNamespace="http://algomation.io/cmmn">
  <case id="Case_main" name="Example case">
    <casePlanModel id="CasePlanModel_1" name="Main plan">
      <stage id="Stage_intake" name="Intake" />
      <stage id="Stage_processing" name="Processing" />
    </casePlanModel>
  </case>
</definitions>
`;

// ---------------------------------------------------------------------------
// Local storage helpers
// ---------------------------------------------------------------------------

const LS_KEY_PROJECTS = 'algomationStudio.projects';

// LEGACY: dev-only fallback; not used in production
function loadProjectsFromLocalStorage() {
  if (!DEV_OFFLINE_OK) return [];
  try {
    const raw = localStorage.getItem(LS_KEY_PROJECTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to load projects from localStorage', err);
    return [];
  }
}

// LEGACY: dev-only fallback; not used in production
function saveProjectsToLocalStorage(arr) {
  if (!DEV_OFFLINE_OK) return;
  try {
    localStorage.setItem(LS_KEY_PROJECTS, JSON.stringify(arr));
  } catch (err) {
    console.warn('Failed to save projects to localStorage', err);
  }
}

// ---------------------------------------------------------------------------
// Project helpers
// ---------------------------------------------------------------------------

function createNewProject(name = 'Untitled Project', description = 'Algomation Studio project') {
  const id = 'proj-' + Date.now();
  const now = new Date().toISOString();

  return {
    id,
    name,
    description,
    createdAt: now,
    updatedAt: now,
    bpmnXml: EMPTY_BPMN_XML,
    dmnXml: EMPTY_DMN_XML,
    cmmnXml: EMPTY_CMMN_XML,
    manifest: {
      uapfVersion: '1.0.0',
      projectId: id,
      name,
      description,
      models: {
        bpmn: [{ id: 'Process_main', file: 'bpmn/main.bpmn.xml' }],
        dmn: [{ id: 'Decision_main', file: 'dmn/main.dmn.xml' }],
        cmmn: [{ id: 'Case_main', file: 'cmmn/main.cmmn.xml' }]
      },
      links: [
        {
          from: { type: 'bpmn', id: 'Task_1' },
          to: { type: 'dmn', id: 'Decision_main' },
          relation: 'uses-decision'
        }
      ],
      createdAt: now,
      updatedAt: now
    }
  };
}

function getCurrentProject() {
  return APP.currentProject;
}

function setCurrentProject(project, options = {}) {
  const { updateList = true } = options;
  APP.currentProject = project;
  APP.currentProjectId = project ? project.id : null;

  if (project && updateList) {
    const idx = APP.projects.findIndex((pr) => pr.id === project.id);
    if (idx >= 0) {
      APP.projects[idx] = project;
    }
  }

  uiSetProjectName(project ? project.name || 'Untitled Project' : 'No project selected');
  uiSelectProject(project ? project.id : null);
}

// ---------------------------------------------------------------------------
// UI setup (tabs, buttons, modals, toasts, shortcuts)
// ---------------------------------------------------------------------------

function setupTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const panels = document.querySelectorAll('.tab-panel');

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (!tab) return;

      tabButtons.forEach((b) => b.classList.remove('active'));
      panels.forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      const panel = document.getElementById(`tab-${tab}`);
      if (panel) panel.classList.add('active');

      fitTabView(tab);
    });
  });
}

function setupButtons() {
  const newBtn = document.getElementById('btn-new-project');
  const saveBtn = document.getElementById('btn-save-project');
  const deleteBtn = document.getElementById('btn-delete-project');
  const exportBtn = document.getElementById('btn-export-uapf');
  const importBtn = document.getElementById('btn-import-uapf');
  const fileInput = document.getElementById('uapf-file-input');
  const aboutBtn = document.getElementById('btn-about');
  const aboutModal = document.getElementById('about-modal');
  const aboutClose = document.getElementById('about-close');
  const manifestEditor = document.getElementById('manifest-editor');

  const signInBtn = document.getElementById('btn-sign-in');
  const signUpBtn = document.getElementById('btn-sign-up');
  const logoutBtn = document.getElementById('btn-logout');
  const profileBtn = document.getElementById('btn-profile');

  const bpmnXmlToggleBtn = document.getElementById('btn-bpmn-toggle-xml');
  const dmnXmlToggleBtn = document.getElementById('btn-dmn-toggle-xml');
  const cmmnXmlToggleBtn = document.getElementById('btn-cmmn-toggle-xml');

  const bpmnXmlContainer = document.getElementById('bpmn-xml-container');
  const dmnXmlContainer = document.getElementById('dmn-xml-container');
  const cmmnXmlContainer = document.getElementById('cmmn-xml-container');

  const bpmnImportBtn = document.getElementById('btn-bpmn-import-xml');
  const dmnImportBtn = document.getElementById('btn-dmn-import-xml');
  const cmmnImportBtn = document.getElementById('btn-cmmn-import-xml');

  const bpmnExportBtn = document.getElementById('btn-bpmn-export-xml');
  const dmnExportBtn = document.getElementById('btn-dmn-export-xml');
  const cmmnExportBtn = document.getElementById('btn-cmmn-export-xml');

  const bpmnFileInput = document.getElementById('bpmn-xml-file-input');
  const dmnFileInput = document.getElementById('dmn-xml-file-input');
  const cmmnFileInput = document.getElementById('cmmn-xml-file-input');

  if (newBtn) {
    newBtn.addEventListener('click', async () => {
      if (!ensureAuthAction('Create a new project')) return;
      await handleNewProject();
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      if (!ensureAuthAction('Save a project')) return;
      await handleSaveProject();
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!ensureAuthAction('Delete a project')) return;
      await handleDeleteProject();
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      if (!ensureAuthAction('Export UAPF')) return;
      exportUapf().catch((err) => {
        console.error('Export error', err);
        uiShowToast('Export failed');
      });
    });
  }

  if (importBtn && fileInput) {
    importBtn.addEventListener('click', () => {
      if (!ensureAuthAction('Import UAPF')) return;
      fileInput.value = '';
      fileInput.click();
    });

    fileInput.addEventListener('change', (event) => {
      if (!ensureAuthAction('Import UAPF')) return;
      const files = event.target.files;
      if (!files || !files[0]) return;
      importUapf(files[0]).catch((err) => {
        console.error('Import error', err);
        uiShowToast('Import failed');
      });
    });
  }

  function setupXmlToggle(btn, container, kind) {
    if (!btn || !container) return;

    btn.addEventListener('click', async () => {
      const visible = container.style.display === 'block';

      if (visible) {
        container.style.display = 'none';
        btn.textContent = 'Show XML';
      } else {
        container.style.display = 'block';
        btn.textContent = 'Hide XML';
        await updateXmlPreview(kind);
      }
    });
  }

  setupXmlToggle(bpmnXmlToggleBtn, bpmnXmlContainer, 'bpmn');
  setupXmlToggle(dmnXmlToggleBtn, dmnXmlContainer, 'dmn');
  setupXmlToggle(cmmnXmlToggleBtn, cmmnXmlContainer, 'cmmn');

  function setupXmlImport(importBtnEl, input, kind) {
    if (!importBtnEl || !input) return;

    importBtnEl.addEventListener('click', () => {
      if (!ensureAuthAction('Import XML')) return;
      input.value = '';
      input.click();
    });

    input.addEventListener('change', async (event) => {
      if (!ensureAuthAction('Import XML')) return;
      const files = event.target.files;
      if (!files || !files[0]) return;

      try {
        await importSingleXml(kind, files[0]);
        await loadProjectIntoEditors();
        await updateXmlPreview(kind);
        uiShowToast(kind.toUpperCase() + ' XML imported');
      } catch (err) {
        console.error('Import ' + kind + ' XML failed', err);
        uiShowToast('Import ' + kind.toUpperCase() + ' XML failed');
      }
    });
  }

  setupXmlImport(bpmnImportBtn, bpmnFileInput, 'bpmn');
  setupXmlImport(dmnImportBtn, dmnFileInput, 'dmn');
  setupXmlImport(cmmnImportBtn, cmmnFileInput, 'cmmn');

  function setupXmlExport(exportBtnEl, kind) {
    if (!exportBtnEl) return;

    exportBtnEl.addEventListener('click', () => {
      if (!ensureAuthAction('Export XML')) return;
      exportSingleXml(kind).catch((err) => {
        console.error('Export ' + kind + ' XML failed', err);
        uiShowToast('Export ' + kind.toUpperCase() + ' XML failed');
      });
    });
  }

  setupXmlExport(bpmnExportBtn, 'bpmn');
  setupXmlExport(dmnExportBtn, 'dmn');
  setupXmlExport(cmmnExportBtn, 'cmmn');

  if (signInBtn) {
    signInBtn.addEventListener('click', () => authManager.login());
  }

  if (signUpBtn) {
    signUpBtn.addEventListener('click', () => authManager.signup());
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => authManager.logout());
  }

  if (profileBtn) {
    profileBtn.addEventListener('click', () => {
      window.open('https://algomation.io/', '_blank', 'noopener');
    });
  }

  if (aboutBtn && aboutModal) {
    aboutBtn.addEventListener('click', () => {
      aboutModal.style.display = 'flex';
    });
  }

  if (aboutClose && aboutModal) {
    aboutClose.addEventListener('click', () => {
      aboutModal.style.display = 'none';
    });
  }

  if (aboutModal) {
    aboutModal.addEventListener('click', (e) => {
      if (e.target === aboutModal) {
        aboutModal.style.display = 'none';
      }
    });
  }

  if (manifestEditor) {
    manifestEditor.addEventListener('input', () => {
      const currentProject = getCurrentProject();
      if (!currentProject || APP.mode !== MODE_AUTH) return;
      try {
        const parsed = JSON.parse(manifestEditor.value);
        currentProject.manifest = parsed;
      } catch (err) {
        // ignore live JSON errors; keep last valid manifest
      }
    });
  }
}

function setupShortcuts() {
  document.addEventListener('keydown', async (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (!ensureAuthAction('Save a project')) return;
      await handleSaveProject();
    }
  });
}

function ensureAuthAction(actionLabel) {
  if (APP.mode === MODE_AUTH) {
    return true;
  }

  uiShowToast(`${actionLabel} is disabled in demo mode.`);
  return false;
}

// ---------------------------------------------------------------------------
// Modeler init and loading
// ---------------------------------------------------------------------------

function initModelers() {
  const BpmnCtor = window.BpmnJS;
  const DmnCtor = window.DmnJS;
  const CmmnCtor = window.CmmnJS;

  if (!BpmnCtor || !DmnCtor || !CmmnCtor) {
    console.error('Modeler constructors missing', { BpmnCtor, DmnCtor, CmmnCtor });
  }

  bpmnModeler = new BpmnCtor({ container: '#bpmn-canvas' });

  dmnModeler = new DmnCtor({
    container: '#dmn-canvas',
    drd: { width: '100%', height: '100%' },
    decisionTable: { width: '100%', height: '100%' },
    literalExpression: { width: '100%', height: '100%' }
  });

  cmmnModeler = new CmmnCtor({ container: '#cmmn-canvas' });

  if (bpmnModeler && bpmnModeler.on) {
    bpmnModeler.on('commandStack.changed', () => {
      updateXmlPreview('bpmn').catch((err) =>
        console.error('Failed to update BPMN XML preview', err)
      );
    });
  }

  if (dmnModeler && dmnModeler.on) {
    dmnModeler.on('commandStack.changed', () => {
      updateXmlPreview('dmn').catch((err) =>
        console.error('Failed to update DMN XML preview', err)
      );
    });
  }

  if (cmmnModeler && cmmnModeler.on) {
    cmmnModeler.on('commandStack.changed', () => {
      updateXmlPreview('cmmn').catch((err) =>
        console.error('Failed to update CMMN XML preview', err)
      );
    });
  }
}

async function loadProjectIntoEditors() {
  const currentProject = getCurrentProject();
  if (!currentProject) return;

  if (bpmnModeler && currentProject.bpmnXml) {
    await bpmnModeler.importXML(currentProject.bpmnXml);
    fitModelerViewport(bpmnModeler, 'bpmn-canvas');
  }

  if (dmnModeler && currentProject.dmnXml) {
    const { warnings } = await dmnModeler.importXML(currentProject.dmnXml);
    if (warnings && warnings.length) {
      console.warn('DMN warnings', warnings);
    }

    const views = dmnModeler.getViews();
    if (views && views.length) {
      let viewToOpen = views[0];
      const decisionTableView = views.find((v) => v.type === 'decisionTable');
      if (decisionTableView) {
        viewToOpen = decisionTableView;
      }
      await dmnModeler.open(viewToOpen);
    }
  }

  if (cmmnModeler && currentProject.cmmnXml) {
    try {
      await cmmnModeler.importXML(currentProject.cmmnXml);
      fitModelerViewport(cmmnModeler, 'cmmn-canvas');
    } catch (err) {
      console.error('CMMN import error', err);
    }
  }

  updateManifestEditor();
}

function saveCmmnXml(modeler, options = { format: true }) {
  return new Promise((resolve, reject) => {
    if (!modeler) {
      return resolve({ xml: null });
    }

    modeler.saveXML(options, (err, xml) => {
      if (err) {
        return reject(err);
      }
      resolve({ xml });
    });
  });
}

async function syncProjectXmlFromEditors() {
  const currentProject = getCurrentProject();
  if (!currentProject) return;

  if (bpmnModeler) {
    const { xml } = await bpmnModeler.saveXML({ format: true });
    currentProject.bpmnXml = xml;
  }

  if (dmnModeler) {
    const { xml } = await dmnModeler.saveXML({ format: true });
    currentProject.dmnXml = xml;
  }

  if (cmmnModeler) {
    try {
      const { xml } = await saveCmmnXml(cmmnModeler, { format: true });
      currentProject.cmmnXml = xml;
    } catch (err) {
      console.error('Failed to save CMMN XML', err);
    }
  }

  const now = new Date().toISOString();
  currentProject.updatedAt = now;
  if (currentProject.manifest) {
    currentProject.manifest.updatedAt = now;
  }
}

async function updateXmlPreview(kind) {
  const currentProject = getCurrentProject();
  if (!currentProject) return;

  if (APP.mode === MODE_AUTH) {
    await syncProjectXmlFromEditors();
  }

  const map = {
    bpmn: { key: 'bpmnXml', editorId: 'bpmn-xml-editor' },
    dmn: { key: 'dmnXml', editorId: 'dmn-xml-editor' },
    cmmn: { key: 'cmmnXml', editorId: 'cmmn-xml-editor' }
  };

  const cfg = map[kind];
  if (!cfg) return;

  const ta = document.getElementById(cfg.editorId);
  if (!ta) return;

  ta.value = currentProject[cfg.key] || '';
}

// ---------------------------------------------------------------------------
// View helpers
// ---------------------------------------------------------------------------

function fitModelerViewport(modeler, canvasId) {
  if (!modeler) return;
  try {
    const canvas = modeler.get('canvas');
    if (canvas && typeof canvas.zoom === 'function') {
      canvas.zoom('fit-viewport');
    }
  } catch (err) {
    console.warn('Could not fit viewport for', canvasId, err);
  }
}

function fitTabView(tab) {
  if (APP.mode === MODE_GUEST) {
    return;
  }

  if (tab === 'bpmn') {
    fitModelerViewport(bpmnModeler, 'bpmn-canvas');
  } else if (tab === 'cmmn') {
    fitModelerViewport(cmmnModeler, 'cmmn-canvas');
  }
}

// ---------------------------------------------------------------------------
// XML import/export helpers
// ---------------------------------------------------------------------------

async function importSingleXml(kind, file) {
  if (!file || APP.mode !== MODE_AUTH) return;

  const text = await file.text();
  const currentProject = getCurrentProject();

  if (!currentProject) return;

  if (kind === 'bpmn') {
    currentProject.bpmnXml = text;
  } else if (kind === 'dmn') {
    currentProject.dmnXml = text;
  } else if (kind === 'cmmn') {
    currentProject.cmmnXml = text;
  }

  const now = new Date().toISOString();
  currentProject.updatedAt = now;
  if (currentProject.manifest) {
    currentProject.manifest.updatedAt = now;
  }
}

async function exportSingleXml(kind) {
  const currentProject = getCurrentProject();
  if (!currentProject) {
    uiShowToast('No project loaded');
    return;
  }

  await syncProjectXmlFromEditors();

  let xml = '';
  let defaultExt = '';
  if (kind === 'bpmn') {
    xml = currentProject.bpmnXml || EMPTY_BPMN_XML;
    defaultExt = '.bpmn.xml';
  } else if (kind === 'dmn') {
    xml = currentProject.dmnXml || EMPTY_DMN_XML;
    defaultExt = '.dmn.xml';
  } else if (kind === 'cmmn') {
    xml = currentProject.cmmnXml || EMPTY_CMMN_XML;
    defaultExt = '.cmmn.xml';
  } else {
    return;
  }

  const name = (currentProject.name || 'project') + defaultExt;

  const blob = new Blob([xml], { type: 'application/xml' });
  downloadBlob(blob, name);
}

// ---------------------------------------------------------------------------
// UAPF import/export
// ---------------------------------------------------------------------------

async function exportUapf() {
  const currentProject = getCurrentProject();
  if (!currentProject) {
    uiShowToast('No project loaded');
    return;
  }

  const blob = await apiClient.exportProject(currentProject.id);
  const safeName = (currentProject.name || 'project').replace(/[^a-z0-9_\-]/gi, '_');
  downloadBlob(blob, `${safeName}.uapf`);
  uiShowToast('UAPF exported');
}

async function importUapf(file) {
  if (!file) return;

  const response = await apiClient.importProject(file);
  await loadAuthWorkspace();

  if (response?.id) {
    await selectAuthProject(response.id);
  }

  uiShowToast('UAPF imported');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Demo / Auth workspace loading
// ---------------------------------------------------------------------------

async function loadAuthWorkspace() {
  uiSetMode(MODE_AUTH);
  destroyViewers();

  if (!bpmnModeler || !dmnModeler || !cmmnModeler) {
    initModelers();
  }

  const response = await apiClient.getProjects();
  APP.projects = response.projects || [];

  uiRenderProjectList({
    items: APP.projects.map((p) => ({ id: p.id, title: p.name || p.id })),
    activeId: APP.currentProjectId,
    emptyMessage: 'No projects yet',
    onSelect: async (id) => {
      await selectAuthProject(id);
    }
  });

  if (!APP.projects.length) {
    setCurrentProject(null, { updateList: false });
    updateManifestEditor();
    return;
  }

  await selectAuthProject(APP.projects[0].id);
}

async function selectAuthProject(projectId) {
  const project = await apiClient.getProject(projectId);
  setCurrentProject(project, { updateList: true });
  await loadProjectIntoEditors();
}

async function loadGuestDemo() {
  uiSetMode(MODE_GUEST);
  APP.demo.currentDemoId = null;
  APP.currentProject = null;
  APP.currentProjectId = null;
  uiSetProjectName('Demo (read-only)');

  await loadDemoCatalog();

  uiRenderProjectList({
    items: APP.demo.catalog.map((example) => ({ id: example.id, title: example.title })),
    activeId: APP.demo.currentDemoId,
    emptyMessage: 'No demos available',
    onSelect: async (id) => {
      await selectDemoProject(id);
    }
  });

  const firstExample = APP.demo.catalog[0];
  if (firstExample) {
    await selectDemoProject(firstExample.id);
  }
}

async function selectDemoProject(exampleId) {
  APP.demo.currentDemoId = exampleId;
  uiSelectProject(exampleId);

  const demoProject = await loadDemoProjectById(exampleId);
  APP.currentProject = demoProject;
  uiSetProjectName(demoProject.title || 'Demo');

  renderBpmnViewer(document.getElementById('bpmn-canvas'), demoProject.bpmnXml || EMPTY_BPMN_XML);
  renderDmnViewer(document.getElementById('dmn-canvas'), demoProject.dmnXml || EMPTY_DMN_XML);
  renderCmmnViewer(document.getElementById('cmmn-canvas'), demoProject.cmmnXml || EMPTY_CMMN_XML);

  updateManifestEditor();
  await updateXmlPreview('bpmn');
  await updateXmlPreview('dmn');
  await updateXmlPreview('cmmn');
}

// ---------------------------------------------------------------------------
// Manifest rendering
// ---------------------------------------------------------------------------

function updateManifestEditor() {
  const editor = document.getElementById('manifest-editor');
  const linksContainer = document.getElementById('manifest-links');
  const currentProject = getCurrentProject();

  if (!currentProject || !currentProject.manifest) {
    if (editor) editor.value = '';
    if (linksContainer) linksContainer.innerHTML = '';
    return;
  }

  if (editor) {
    editor.value = JSON.stringify(currentProject.manifest, null, 2);
  }

  if (linksContainer) {
    const links = currentProject.manifest.links || [];
    if (!links.length) {
      linksContainer.innerHTML = '<p><em>No cross-links defined yet.</em></p>';
    } else {
      const ul = document.createElement('ul');
      links.forEach((lnk) => {
        const li = document.createElement('li');
        li.textContent = `${lnk.from.type}:${lnk.from.id} -> ${lnk.to.type}:${lnk.to.id} (${lnk.relation})`;
        ul.appendChild(li);
      });
      linksContainer.innerHTML = '';
      linksContainer.appendChild(ul);
    }
  }
}

// ---------------------------------------------------------------------------
// Auth CRUD handlers
// ---------------------------------------------------------------------------

async function handleNewProject() {
  const name = prompt('Project name:', 'New project');
  if (name === null) return;
  const description = prompt('Project description:', '') || '';

  const template = createNewProject(name.trim() || 'Untitled Project', description);
  const payload = {
    name: template.name,
    description: template.description,
    bpmnXml: template.bpmnXml,
    dmnXml: template.dmnXml,
    cmmnXml: template.cmmnXml,
    manifest: template.manifest
  };

  const created = await apiClient.createProject(payload);
  await loadAuthWorkspace();

  if (created?.id) {
    await selectAuthProject(created.id);
  }

  uiShowToast('New project created');
}

async function handleSaveProject() {
  const currentProject = getCurrentProject();
  if (!currentProject) {
    uiShowToast('No project loaded');
    return;
  }

  await syncProjectXmlFromEditors();

  await apiClient.updateProject(currentProject.id, {
    name: currentProject.name,
    description: currentProject.description,
    bpmnXml: currentProject.bpmnXml,
    dmnXml: currentProject.dmnXml,
    cmmnXml: currentProject.cmmnXml,
    manifest: currentProject.manifest
  });

  uiShowToast('Project saved');
}

async function handleDeleteProject() {
  const currentProject = getCurrentProject();
  if (!currentProject) {
    uiShowToast('No project loaded');
    return;
  }

  const confirmed = confirm(`Delete project "${currentProject.name || currentProject.id}"?`);
  if (!confirmed) return;

  await apiClient.deleteProject(currentProject.id);
  await loadAuthWorkspace();
  uiShowToast('Project deleted');
}

// ---------------------------------------------------------------------------
// App init
// ---------------------------------------------------------------------------

async function initApp() {
  setupTabs();
  setupButtons();
  setupShortcuts();
  uiSetMode('loading');

  try {
    await authManager.init();
  } catch (e) {
    console.error('Auth init failed', e);
  }

  if (authManager.isAuthenticated) {
    APP.mode = MODE_AUTH;
    APP.user = authManager.user;
    uiSetUser(authManager.user);
    await loadAuthWorkspace();
    return;
  }

  APP.mode = MODE_GUEST;
  await loadGuestDemo();
}

document.addEventListener('DOMContentLoaded', initApp);

window.exportUapf = exportUapf;
window.importUapf = importUapf;
