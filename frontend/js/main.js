// Algomation Studio – clean implementation with BPMN / DMN / CMMN modelers,
// UAPF import/export, localStorage projects, About modal and toasts.

import { authManager } from './auth.js';
import { apiClient } from './api-client.js';

let bpmnModeler = null;
let dmnModeler = null;
let cmmnModeler = null;

let currentProject = null;
let projects = [];

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

const LS_KEY_PROJECTS = "algomationStudio.projects";

function loadProjectsFromLocalStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY_PROJECTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("Failed to load projects from localStorage", err);
    return [];
  }
}

function saveProjectsToLocalStorage(arr) {
  try {
    localStorage.setItem(LS_KEY_PROJECTS, JSON.stringify(arr));
  } catch (err) {
    console.warn("Failed to save projects to localStorage", err);
  }
}

// ---------------------------------------------------------------------------
// Project helpers
// ---------------------------------------------------------------------------

function createNewProject(name = "Untitled Project", description = "Algomation Studio project") {
  const id = "proj-" + Date.now();
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
      uapfVersion: "1.0.0",
      projectId: id,
      name,
      description,
      models: {
        bpmn: [{ id: "Process_main", file: "bpmn/main.bpmn.xml" }],
        dmn: [{ id: "Decision_main", file: "dmn/main.dmn.xml" }],
        cmmn: [{ id: "Case_main", file: "cmmn/main.cmmn.xml" }]
      },
      links: [
        {
          from: { type: "bpmn", id: "Task_1" },
          to:   { type: "dmn",  id: "Decision_main" },
          relation: "uses-decision"
        }
      ],
      createdAt: now,
      updatedAt: now
    }
  };
}

function setProject(p, options = {}) {
  const { persist = true, updateList = true } = options;
  currentProject = p;

  // NEW: update header project name
  const projNameEl = document.getElementById("current-project-name");
  if (projNameEl) {
    if (p) {
      projNameEl.textContent = p.name || "Untitled Project";
    } else {
      projNameEl.textContent = "No project selected";
    }
  }

  if (p && p.id && updateList) {
    const idx = projects.findIndex(pr => pr.id === p.id);
    if (idx >= 0) {
      projects[idx] = p;
    } else {
      projects.push(p);
    }
    if (persist) {
      saveProjectsToLocalStorage(projects);
    }
    renderProjectList();
  }

  updateManifestEditor();
}

function renderProjectList() {
  const list = document.getElementById("project-list");
  if (!list) return;

  list.innerHTML = "";

  if (!projects.length) {
    const li = document.createElement("li");
    li.textContent = "No projects yet";
    list.appendChild(li);
    return;
  }

  projects.forEach((p) => {
    const li = document.createElement("li");
    li.textContent = p.name || p.id;
    li.dataset.projectId = p.id;
    li.classList.add("project-item", "py-1", "px-2");

    if (currentProject && currentProject.id === p.id) {
      li.classList.add("active");
    }

    li.addEventListener("click", async () => {
      const target = projects.find(x => x.id === p.id);
      if (!target) return;
      setProject(target);
      await loadProjectIntoEditors();
    });

    list.appendChild(li);
  });
}

function updateManifestEditor() {
  const editor = document.getElementById("manifest-editor");
  const linksContainer = document.getElementById("manifest-links");

  if (!currentProject || !currentProject.manifest) {
    if (editor) editor.value = "";
    if (linksContainer) linksContainer.innerHTML = "";
    return;
  }

  if (editor) {
    editor.value = JSON.stringify(currentProject.manifest, null, 2);
  }

  if (linksContainer) {
    const links = currentProject.manifest.links || [];
    if (!links.length) {
      linksContainer.innerHTML = "<p><em>No cross-links defined yet.</em></p>";
    } else {
      const ul = document.createElement("ul");
      links.forEach((lnk) => {
        const li = document.createElement("li");
        li.textContent = `${lnk.from.type}:${lnk.from.id} -> ${lnk.to.type}:${lnk.to.id} (${lnk.relation})`;
        ul.appendChild(li);
      });
      linksContainer.innerHTML = "";
      linksContainer.appendChild(ul);
    }
  }
}

// ---------------------------------------------------------------------------
// UI setup (tabs, buttons, modals, toasts, shortcuts)
// ---------------------------------------------------------------------------

function setupTabs() {
  const tabButtons = document.querySelectorAll(".tab-button");
  const panels = document.querySelectorAll(".tab-panel");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      if (!tab) return;

      tabButtons.forEach(b => b.classList.remove("active"));
      panels.forEach(p => p.classList.remove("active"));

      btn.classList.add("active");
      const panel = document.getElementById(`tab-${tab}`);
      if (panel) panel.classList.add("active");

      fitTabView(tab);
    });
  });
}

function setupButtons() {
  const newBtn         = document.getElementById("btn-new-project");
  const exportBtn      = document.getElementById("btn-export-uapf");
  const importBtn      = document.getElementById("btn-import-uapf");
  const fileInput      = document.getElementById("uapf-file-input");
  const aboutBtn       = document.getElementById("btn-about");
  const aboutModal     = document.getElementById("about-modal");
  const aboutClose     = document.getElementById("about-close");
  const manifestEditor = document.getElementById("manifest-editor");

  // NEW: XML toggle buttons and containers
  const bpmnXmlToggleBtn = document.getElementById("btn-bpmn-toggle-xml");
  const dmnXmlToggleBtn  = document.getElementById("btn-dmn-toggle-xml");
  const cmmnXmlToggleBtn = document.getElementById("btn-cmmn-toggle-xml");

  const bpmnXmlContainer = document.getElementById("bpmn-xml-container");
  const dmnXmlContainer  = document.getElementById("dmn-xml-container");
  const cmmnXmlContainer = document.getElementById("cmmn-xml-container");

  // NEW: per-type import/export buttons
  const bpmnImportBtn = document.getElementById("btn-bpmn-import-xml");
  const dmnImportBtn  = document.getElementById("btn-dmn-import-xml");
  const cmmnImportBtn = document.getElementById("btn-cmmn-import-xml");

  const bpmnExportBtn = document.getElementById("btn-bpmn-export-xml");
  const dmnExportBtn  = document.getElementById("btn-dmn-export-xml");
  const cmmnExportBtn = document.getElementById("btn-cmmn-export-xml");

  const bpmnFileInput = document.getElementById("bpmn-xml-file-input");
  const dmnFileInput  = document.getElementById("dmn-xml-file-input");
  const cmmnFileInput = document.getElementById("cmmn-xml-file-input");

  if (newBtn) {
    newBtn.addEventListener("click", async () => {
      const name = prompt("Project name:", "New project");
      if (name === null) return;
      const description = prompt("Project description:", "") || "";
      const proj = createNewProject(name.trim() || "Untitled Project", description);
      setProject(proj);
      await loadProjectIntoEditors();
      showToast("New project created");
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      exportUapf().catch(err => {
        console.error("Export error", err);
        showToast("Export failed");
      });
    });
  }

  if (importBtn && fileInput) {
    importBtn.addEventListener("click", () => {
      fileInput.value = "";
      fileInput.click();
    });

    fileInput.addEventListener("change", (event) => {
      const files = event.target.files;
      if (!files || !files[0]) return;
      importUapf(files[0]).catch(err => {
        console.error("Import error", err);
        showToast("Import failed");
      });
    });
  }

  // --- XML PREVIEW TOGGLE HELPERS ---

  function setupXmlToggle(btn, container, kind) {
    if (!btn || !container) return;

    btn.addEventListener("click", async () => {
      const visible = container.style.display === "block";

      if (visible) {
        container.style.display = "none";
        btn.textContent = "Show XML";
      } else {
        container.style.display = "block";
        btn.textContent = "Hide XML";
        await updateXmlPreview(kind);
      }
    });
  }

  setupXmlToggle(bpmnXmlToggleBtn, bpmnXmlContainer, "bpmn");
  setupXmlToggle(dmnXmlToggleBtn,  dmnXmlContainer,  "dmn");
  setupXmlToggle(cmmnXmlToggleBtn, cmmnXmlContainer, "cmmn");

  // --- SINGLE XML IMPORT HELPERS ---

  function setupXmlImport(importBtn, input, kind) {
    if (!importBtn || !input) return;

    importBtn.addEventListener("click", () => {
      input.value = "";
      input.click();
    });

    input.addEventListener("change", async (event) => {
      const files = event.target.files;
      if (!files || !files[0]) return;

      try {
        await importSingleXml(kind, files[0]);
        await loadProjectIntoEditors();
        await updateXmlPreview(kind);
        showToast(kind.toUpperCase() + " XML imported");
      } catch (err) {
        console.error("Import " + kind + " XML failed", err);
        showToast("Import " + kind.toUpperCase() + " XML failed");
      }
    });
  }

  setupXmlImport(bpmnImportBtn, bpmnFileInput, "bpmn");
  setupXmlImport(dmnImportBtn,  dmnFileInput,  "dmn");
  setupXmlImport(cmmnImportBtn, cmmnFileInput, "cmmn");

  // --- SINGLE XML EXPORT HELPERS ---

  function setupXmlExport(exportBtn, kind) {
    if (!exportBtn) return;

    exportBtn.addEventListener("click", () => {
      exportSingleXml(kind).catch(err => {
        console.error("Export " + kind + " XML failed", err);
        showToast("Export " + kind.toUpperCase() + " XML failed");
      });
    });
  }

  setupXmlExport(bpmnExportBtn, "bpmn");
  setupXmlExport(dmnExportBtn,  "dmn");
  setupXmlExport(cmmnExportBtn, "cmmn");

  if (aboutBtn && aboutModal) {
    aboutBtn.addEventListener("click", () => {
      aboutModal.style.display = "flex";
    });
  }

  if (aboutClose && aboutModal) {
    aboutClose.addEventListener("click", () => {
      aboutModal.style.display = "none";
    });
  }

  if (aboutModal) {
    aboutModal.addEventListener("click", (e) => {
      if (e.target === aboutModal) {
        aboutModal.style.display = "none";
      }
    });
  }

  if (manifestEditor) {
    manifestEditor.addEventListener("input", () => {
      if (!currentProject) return;
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
  document.addEventListener("keydown", async (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      await syncProjectXmlFromEditors();
      if (currentProject && currentProject.id) {
        const idx = projects.findIndex(p => p.id === currentProject.id);
        if (idx >= 0) {
          projects[idx] = currentProject;
        }
        saveProjectsToLocalStorage(projects);
      }
      showToast("Project saved");
    }
  });
}

function showToast(message, timeout = 3000) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "toast-item";
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("fade-out");
    setTimeout(() => toast.remove(), 300);
  }, timeout);
}

// ---------------------------------------------------------------------------
// Modeler init and loading
// ---------------------------------------------------------------------------

function initModelers() {
  const BpmnCtor = window.BpmnJS;
  const DmnCtor  = window.DmnJS;
  const CmmnCtor = window.CmmnJS;

  if (!BpmnCtor || !DmnCtor || !CmmnCtor) {
    console.error("Modeler constructors missing", { BpmnCtor, DmnCtor, CmmnCtor });
  }

  bpmnModeler = new BpmnCtor({ container: "#bpmn-canvas" });

  dmnModeler = new DmnCtor({
    container: "#dmn-canvas",
    drd: { width: "100%", height: "100%" },
    decisionTable: { width: "100%", height: "100%" },
    literalExpression: { width: "100%", height: "100%" }
  });

  cmmnModeler = new CmmnCtor({ container: "#cmmn-canvas" });

  // NEW: auto-sync XML + preview when diagrams change
  if (bpmnModeler && bpmnModeler.on) {
    bpmnModeler.on("commandStack.changed", () => {
      updateXmlPreview("bpmn").catch(err =>
        console.error("Failed to update BPMN XML preview", err)
      );
    });
  }

  if (dmnModeler && dmnModeler.on) {
    dmnModeler.on("commandStack.changed", () => {
      updateXmlPreview("dmn").catch(err =>
        console.error("Failed to update DMN XML preview", err)
      );
    });
  }

  if (cmmnModeler && cmmnModeler.on) {
    cmmnModeler.on("commandStack.changed", () => {
      updateXmlPreview("cmmn").catch(err =>
        console.error("Failed to update CMMN XML preview", err)
      );
    });
  }
}

async function loadProjectIntoEditors() {
  if (!currentProject) return;

  // BPMN
  if (bpmnModeler && currentProject.bpmnXml) {
    await bpmnModeler.importXML(currentProject.bpmnXml);
    fitModelerViewport(bpmnModeler, "bpmn-canvas");
  }

  // DMN
  if (dmnModeler && currentProject.dmnXml) {
    const { warnings } = await dmnModeler.importXML(currentProject.dmnXml);
    if (warnings && warnings.length) {
      console.warn("DMN warnings", warnings);
    }

    const views = dmnModeler.getViews();
    if (views && views.length) {
      let viewToOpen = views[0];
      const decisionTableView = views.find(v => v.type === "decisionTable");
      if (decisionTableView) {
        viewToOpen = decisionTableView;
      }
      await dmnModeler.open(viewToOpen);
    }
  }

  // CMMN
  if (cmmnModeler && currentProject.cmmnXml) {
    try {
      await cmmnModeler.importXML(currentProject.cmmnXml);
      fitModelerViewport(cmmnModeler, "cmmn-canvas");
    } catch (err) {
      console.error("CMMN import error", err);
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
      console.error("Failed to save CMMN XML", err);
    }
  }

  const now = new Date().toISOString();
  currentProject.updatedAt = now;
  if (currentProject.manifest) {
    currentProject.manifest.updatedAt = now;
  }
}

async function updateXmlPreview(kind) {
  if (!currentProject) return;

  // First sync all XML from editors back into currentProject
  await syncProjectXmlFromEditors();

  const map = {
    bpmn: { key: "bpmnXml", editorId: "bpmn-xml-editor" },
    dmn:  { key: "dmnXml",  editorId: "dmn-xml-editor" },
    cmmn: { key: "cmmnXml", editorId: "cmmn-xml-editor" }
  };

  const cfg = map[kind];
  if (!cfg) return;

  const ta = document.getElementById(cfg.editorId);
  if (!ta) return;

  ta.value = currentProject[cfg.key] || "";
}

// ---------------------------------------------------------------------------
// View helpers
// ---------------------------------------------------------------------------

function fitModelerViewport(modeler, canvasId) {
  if (!modeler) return;
  try {
    const canvas = modeler.get("canvas");
    if (canvas && typeof canvas.zoom === "function") {
      canvas.zoom("fit-viewport");
    }
  } catch (err) {
    console.warn("Could not fit viewport for", canvasId, err);
  }
}

function fitTabView(tab) {
  if (tab === "bpmn") {
    fitModelerViewport(bpmnModeler, "bpmn-canvas");
  } else if (tab === "cmmn") {
    fitModelerViewport(cmmnModeler, "cmmn-canvas");
  }
}

// ---------------------------------------------------------------------------
// XML import/export helpers
// ---------------------------------------------------------------------------

async function importSingleXml(kind, file) {
  if (!file) return;

  const text = await file.text();

  if (!currentProject) {
    const proj = createNewProject();
    setProject(proj);
  }

  if (kind === "bpmn") {
    currentProject.bpmnXml = text;
  } else if (kind === "dmn") {
    currentProject.dmnXml = text;
  } else if (kind === "cmmn") {
    currentProject.cmmnXml = text;
  }

  const now = new Date().toISOString();
  currentProject.updatedAt = now;
  if (currentProject.manifest) {
    currentProject.manifest.updatedAt = now;
  }

  // Persist into projects array
  if (currentProject && currentProject.id) {
    const idx = projects.findIndex(p => p.id === currentProject.id);
    if (idx >= 0) {
      projects[idx] = currentProject;
    } else {
      projects.push(currentProject);
    }
    saveProjectsToLocalStorage(projects);
    renderProjectList();
  }
}

async function exportSingleXml(kind) {
  if (!currentProject) {
    showToast("No project loaded");
    return;
  }

  await syncProjectXmlFromEditors();

  let xml = "";
  let defaultExt = "";
  if (kind === "bpmn") {
    xml = currentProject.bpmnXml || EMPTY_BPMN_XML;
    defaultExt = ".bpmn.xml";
  } else if (kind === "dmn") {
    xml = currentProject.dmnXml || EMPTY_DMN_XML;
    defaultExt = ".dmn.xml";
  } else if (kind === "cmmn") {
    xml = currentProject.cmmnXml || EMPTY_CMMN_XML;
    defaultExt = ".cmmn.xml";
  } else {
    return;
  }

  const name = (currentProject.name || "project") + defaultExt;

  const blob = new Blob([xml], { type: "application/xml" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// UAPF import/export
// ---------------------------------------------------------------------------

async function exportUapf() {
  if (!currentProject) {
    showToast("No project loaded");
    return;
  }

  if (typeof JSZip === "undefined") {
    showToast("JSZip is not available. Cannot export.");
    return;
  }

  await syncProjectXmlFromEditors();

  const zip = new JSZip();
  zip.file("manifest.json", JSON.stringify(currentProject.manifest, null, 2));

  if (currentProject.bpmnXml) {
    zip.file("bpmn/main.bpmn.xml", currentProject.bpmnXml);
  }
  if (currentProject.dmnXml) {
    zip.file("dmn/main.dmn.xml", currentProject.dmnXml);
  }
  if (currentProject.cmmnXml) {
    zip.file("cmmn/main.cmmn.xml", currentProject.cmmnXml);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = (currentProject.name || "project").replace(/[^a-z0-9_\-]/gi, "_");
  a.download = safeName + ".uapf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  showToast("UAPF exported");
}

async function importUapf(file) {
  if (!file) return;

  if (typeof JSZip === "undefined") {
    showToast("JSZip is not available. Cannot import UAPF.");
    return;
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    if (!zip.files["manifest.json"]) {
      showToast("Invalid UAPF: manifest.json is missing.");
      return;
    }

    const manifestText = await zip.files["manifest.json"].async("string");
    let manifest;
    try {
      manifest = JSON.parse(manifestText);
    } catch (err) {
      showToast("Invalid UAPF: manifest.json is not valid JSON.");
      return;
    }

    const bpmnXml = zip.files["bpmn/main.bpmn.xml"]
      ? await zip.files["bpmn/main.bpmn.xml"].async("string")
      : null;

    const dmnXml = zip.files["dmn/main.dmn.xml"]
      ? await zip.files["dmn/main.dmn.xml"].async("string")
      : null;

    const cmmnXml = zip.files["cmmn/main.cmmn.xml"]
      ? await zip.files["cmmn/main.cmmn.xml"].async("string")
      : null;

    const now = new Date().toISOString();

    const project = {
      id:          manifest.projectId || ("proj-import-" + Date.now()),
      name:        manifest.name || file.name.replace(/\.uapf$/i, ""),
      description: manifest.description || "",
      createdAt:   manifest.createdAt || now,
      updatedAt:   now,
      bpmnXml:     bpmnXml || EMPTY_BPMN_XML,
      dmnXml:      dmnXml || EMPTY_DMN_XML,
      cmmnXml:     cmmnXml || EMPTY_CMMN_XML,
      manifest
    };

    setProject(project);
    await loadProjectIntoEditors();
    showToast("UAPF imported");
  } catch (err) {
    console.error("Failed to import UAPF", err);
    showToast("Failed to import UAPF. See console for details.");
  }
}

// ---------------------------------------------------------------------------
// App init
// ---------------------------------------------------------------------------

async function initApp() {
  setupTabs();
  setupButtons();
  setupShortcuts();

  // Initialize authentication (FAIL CLOSED: no offline fallback in production)
  await authManager.init();

  // If init() triggers login redirect, the browser navigates away;
  // this is here as a defensive stop if execution continues.
  if (!authManager.isAuthenticated) {
    return;
  }

  console.log('Authenticated, loading projects from API...');

  // Load projects from backend API ONLY
  const response = await apiClient.getProjects();
  projects = response.projects || [];

  // Do NOT auto-create offline projects in production.
  // If you want an empty state, render empty list and prompt user to create first project.
  if (!projects.length) {
    renderProjectList();
    initModelers();

    // Create a clean empty project in-memory (NOT saved to localStorage)
    const proj = createNewProject();
    setProject(proj, { persist: false, updateList: false });
    await loadProjectIntoEditors();
    return;
  }

  setProject(projects[0]);

  renderProjectList();
  initModelers();
  await loadProjectIntoEditors();
}

document.addEventListener("DOMContentLoaded", initApp);

// expose for manual debugging from console
window.exportUapf = exportUapf;
window.importUapf = importUapf;
