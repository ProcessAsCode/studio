// Algomation Studio – enhanced version with UAPF import/export and persistence

let bpmnModeler = null;
let dmnModeler = null;
let cmmnModeler = null;
let currentProject = null;
let projects = [];

// ---------------------------------------------------------------------------
// Correct minimal templates (fixed CMMN + proper namespaces)
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
</bpmn:definitions>`;

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
</definitions>`;

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
</definitions>`;

const LS_KEY_PROJECTS = "algomationStudio.projects";

function loadProjectsFromLocalStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY_PROJECTS);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    console.warn("Failed to parse projects from localStorage", e);
    return [];
  }
}

function saveProjectsToLocalStorage(projectsToSave) {
  try {
    localStorage.setItem(LS_KEY_PROJECTS, JSON.stringify(projectsToSave));
  } catch (e) {
    console.warn("Failed to save projects to localStorage", e);
  }
}

// ---------------------------------------------------------------------------
// Project & UI code (unchanged, only tiny robustness improvements)
// ---------------------------------------------------------------------------

function createNewProject(name = "Untitled Project", description = "Algomation Studio project") {
  const id = "proj-" + Date.now();
  const now = new Date().toISOString();
  return {
    id,
    name,
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
          to: { type: "dmn", id: "Decision_main" },
          relation: "uses-decision"
        }
      ],
      createdAt: now,
      updatedAt: now
    }
  };
}

function setProject(p) {
  currentProject = p;

  if (p && p.id) {
    const idx = projects.findIndex(pr => pr.id === p.id);
    if (idx >= 0) {
      projects[idx] = p;
    } else {
      projects.push(p);
    }
    saveProjectsToLocalStorage(projects);
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
    li.classList.add("project-item", "py-1", "px-2", "rounded");
    if (currentProject && currentProject.id === p.id) {
      li.classList.add("active", "bg-primary-subtle");
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

function showToast(message, timeout = 3000) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("fade-out");
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, timeout);
}

// Tabs
function setupUI() {
  document.querySelectorAll(".tab-button").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-button").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      const panel = document.getElementById("tab-" + btn.dataset.tab);
      if (panel) panel.classList.add("active");

      // Fit viewport when tab becomes visible
      setTimeout(() => {
        if (btn.dataset.tab === "bpmn" && bpmnModeler) bpmnModeler.get("canvas")?.zoom("fit-viewport");
        if (btn.dataset.tab === "cmmn" && cmmnModeler) cmmnModeler.get("canvas")?.zoom("fit-viewport");
      }, 100);
    });
  });

  document.getElementById("btn-new-project")?.addEventListener("click", async () => {
    const name = prompt("Project name:", "New project");
    if (name === null) return;

    const description = prompt("Project description:", "") || "";

    const proj = createNewProject(name.trim() || "Untitled Project", description);
    setProject(proj);
    await loadProjectIntoEditors();
  });

  document.getElementById("btn-export-uapf")?.addEventListener("click", exportUapf);

  const importBtn = document.getElementById("btn-import-uapf");
  const fileInput = document.getElementById("uapf-file-input");

  if (importBtn && fileInput) {
    importBtn.addEventListener("click", () => {
      fileInput.value = "";
      fileInput.click();
    });

    fileInput.addEventListener("change", (event) => {
      if (!event.target.files || !event.target.files[0]) return;
      importUapf(event.target.files[0]);
    });
  }

  const aboutBtn = document.getElementById("btn-about");
  const aboutModal = document.getElementById("about-modal");
  const aboutClose = document.getElementById("about-close");

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
}

async function initModelers() {
  // BPMN
  bpmnModeler = new BpmnJS({ container: "#bpmn-canvas" });

  // DMN
  dmnModeler = new DmnJS({
    container: "#dmn-canvas",
    drd: { width: "100%", height: "100%" },
    decisionTable: { width: "100%", height: "100%" },
    literalExpression: { width: "100%", height: "100%" }
  });

  // CMMN
  cmmnModeler = new CmmnJS({ container: "#cmmn-canvas" });
}

async function loadProjectIntoEditors() {
  if (!currentProject) return;

  if (bpmnModeler) await bpmnModeler.importXML(currentProject.bpmnXml);
  if (dmnModeler) {
    const { warnings } = await dmnModeler.importXML(currentProject.dmnXml);
    console.log("DMN warnings:", warnings);
    const views = dmnModeler.getViews();
    if (views && views.length) {
      // Prefer decision table view if available
      let viewToOpen = views[0];
      const decisionView = views.find(v => v.type === "decisionTable");
      if (decisionView) viewToOpen = decisionView;

      await dmnModeler.open(viewToOpen);
    }
  }
  if (cmmnModeler) await cmmnModeler.importXML(currentProject.cmmnXml);

  updateManifestEditor();
}

async function syncProjectXmlFromEditors() {
  if (!currentProject) return;

  if (bpmnModeler) {
    const { xml } = await bpmnModeler.saveXML({ format: true });
    currentProject.bpmnXml = xml;
  }
  if (dmnModeler) {
    const { xml } = await dmnModeler.saveXML();
    currentProject.dmnXml = xml;
  }
  if (cmmnModeler) {
    const { xml } = await cmmnModeler.saveXML({ format: true });
    currentProject.cmmnXml = xml;
  }

  const now = new Date().toISOString();
  currentProject.updatedAt = now;
  if (currentProject.manifest) {
    currentProject.manifest.updatedAt = now;
  }
}

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
  currentProject.bpmnXml && zip.file("bpmn/main.bpmn.xml", currentProject.bpmnXml);
  currentProject.dmnXml && zip.file("dmn/main.dmn.xml", currentProject.dmnXml);
  currentProject.cmmnXml && zip.file("cmmn/main.cmmn.xml", currentProject.cmmnXml);

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = (currentProject.name || "project").replace(/[^a-z0-9]/gi, "_") + ".uapf";
  a.click();
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
    } catch (e) {
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
      id: manifest.projectId || ("proj-import-" + Date.now()),
      name: manifest.name || file.name.replace(/\.uapf$/i, ""),
      createdAt: manifest.createdAt || now,
      updatedAt: now,
      bpmnXml: bpmnXml || EMPTY_BPMN_XML,
      dmnXml: dmnXml || EMPTY_DMN_XML,
      cmmnXml: cmmnXml || EMPTY_CMMN_XML,
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

function initApp() {
  setupUI();

  projects = loadProjectsFromLocalStorage();

  if (projects.length === 0) {
    const proj = createNewProject();
    projects = [proj];
    saveProjectsToLocalStorage(projects);
    setProject(proj);
  } else {
    setProject(projects[0]);
  }

  renderProjectList();

  initModelers().then(loadProjectIntoEditors);
}

document.addEventListener("DOMContentLoaded", initApp);

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

// expose for console/debugging
window.exportUapf = exportUapf;
window.importUapf = importUapf;
