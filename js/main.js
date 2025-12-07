// Algomation Studio - Frontend-only UAPF editor
// BPMN / DMN / CMMN editors + manifest + UAPF export (steps 1–4)

let bpmnModeler = null;
let dmnModeler = null;
let cmmnModeler = null;

let currentProject = null;

// ---------------------------------------------------------------------------
// Default XML templates
// ---------------------------------------------------------------------------

// Minimal BPMN diagram (BPMN 2.0)
const EMPTY_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_1"
                  targetNamespace="http://algomation.io/bpmn">
  <bpmn:process id="Process_main" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" name="Start" />
    <bpmn:endEvent id="EndEvent_1" name="End" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_main">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="150" y="100" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1">
        <dc:Bounds x="350" y="100" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
`;

// Minimal DMN decision table (DMN 1.3)
const EMPTY_DMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/"
             xmlns:dmndi="https://www.omg.org/spec/DMN/20191111/DMNDI/"
             xmlns:di="http://www.omg.org/spec/DMN/20180521/DI/"
             xmlns:dc="http://www.omg.org/spec/DMN/20180521/DC/"
             id="definitions_1"
             name="Demo Decisions"
             namespace="http://algomation.io/dmn">
  <decision id="Decision_main" name="Example decision">
    <decisionTable id="decisionTable_1">
      <input id="input_1" label="Input">
        <inputExpression id="inputExpression_1" typeRef="string">
          <text>input</text>
        </inputExpression>
      </input>
      <output id="output_1" label="Result" name="result" typeRef="string" />
      <rule id="rule_1">
        <inputEntry id="inputEntry_1">
          <text>"example"</text>
        </inputEntry>
        <outputEntry id="outputEntry_1">
          <text>"ok"</text>
        </outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>
`;

// Minimal CMMN case model (no DI / diagram section – keep it simple)
const EMPTY_CMMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<cmmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  xmlns:cmmn="http://www.omg.org/spec/CMMN/20151109/MODEL"
                  id="CMMNDefinitions_1"
                  targetNamespace="http://algomation.io/cmmn">
  <cmmn:case id="Case_main" name="Example case">
    <cmmn:casePlanModel id="CasePlanModel_1" name="Case plan">
      <cmmn:stage id="Stage_1" name="Main stage" />
    </cmmn:casePlanModel>
  </cmmn:case>
</cmmn:definitions>
`;

// ---------------------------------------------------------------------------
// Project helpers
// ---------------------------------------------------------------------------

function createNewProject() {
  const id = "proj-" + Date.now();
  const nowIso = new Date().toISOString();

  return {
    id,
    name: "Untitled Project",
    description: "Algomation Studio demo project.",
    createdAt: nowIso,
    updatedAt: nowIso,
    bpmnXml: EMPTY_BPMN_XML,
    dmnXml: EMPTY_DMN_XML,
    cmmnXml: EMPTY_CMMN_XML,
    manifest: {
      uapfVersion: "1.0.0",
      projectId: id,
      name: "Untitled Project",
      description: "Algomation Studio demo project.",
      models: {
        bpmn: [
          { id: "Process_main", file: "bpmn/main.bpmn.xml" }
        ],
        dmn: [
          { id: "Decision_main", file: "dmn/main.dmn.xml" }
        ],
        cmmn: [
          { id: "Case_main", file: "cmmn/main.cmmn.xml" }
        ]
      },
      createdAt: nowIso,
      updatedAt: nowIso
    }
  };
}

function setProject(project) {
  currentProject = project;
  updateManifestEditor();
}

function updateManifestEditor() {
  const editor = document.getElementById("manifest-editor");
  if (!editor) return;

  if (!currentProject || !currentProject.manifest) {
    editor.value = "";
    return;
  }

  editor.value = JSON.stringify(currentProject.manifest, null, 2);
}

// ---------------------------------------------------------------------------
// UI setup
// ---------------------------------------------------------------------------

function setupTabs() {
  const tabButtons = document.querySelectorAll(".tab-button");
  const tabPanels = document.querySelectorAll(".tab-panel");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-tab");
      if (!tab) return;

      tabButtons.forEach((b) => b.classList.remove("active"));
      tabPanels.forEach((p) => p.classList.remove("active"));

      btn.classList.add("active");
      const panel = document.getElementById(`tab-${tab}`);
      if (panel) {
        panel.classList.add("active");
      }

      fitTabView(tab);
    });
  });
}

function setupButtons() {
  const btnNew = document.getElementById("btn-new-project");
  const btnImport = document.getElementById("btn-import-uapf");
  const btnExport = document.getElementById("btn-export-uapf");
  const fileInput = document.getElementById("uapf-file-input");
  const manifestEditor = document.getElementById("manifest-editor");

  if (btnNew) {
    btnNew.addEventListener("click", () => {
      onNewProject().catch((err) => console.error("New project error", err));
    });
  }

  if (btnImport && fileInput) {
    btnImport.addEventListener("click", () => {
      fileInput.value = "";
      fileInput.click();
    });

    fileInput.addEventListener("change", (event) => {
      onImportUapf(event).catch((err) =>
        console.error("Import UAPF error", err)
      );
    });
  }

  if (btnExport) {
    btnExport.addEventListener("click", () => {
      exportUapf().catch((err) => console.error("Export UAPF error", err));
    });
  }

  if (manifestEditor) {
    manifestEditor.addEventListener("input", () => {
      if (!currentProject) return;
      try {
        const parsed = JSON.parse(manifestEditor.value);
        currentProject.manifest = parsed;
      } catch (err) {
        // keep last valid manifest; do not spam console
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Modeler init
// ---------------------------------------------------------------------------

async function initBpmnModeler() {
  const container = document.getElementById("bpmn-canvas");
  if (!container) {
    console.error("BPMN canvas element not found");
    return;
  }

  if (typeof BpmnJS === "undefined") {
    console.error("BpmnJS is not loaded. Check script tag in index.html.");
    alert("BPMN modeler library (bpmn-js) not loaded.");
    return;
  }

  bpmnModeler = new BpmnJS({
    container: "#bpmn-canvas"
  });
}

async function initDmnModeler() {
  const container = document.getElementById("dmn-canvas");
  if (!container) {
    console.error("DMN canvas element not found");
    return;
  }

  const DmnCtor = window.DmnJS;

  console.log("DMN ctor detected:", DmnCtor);

  if (!DmnCtor) {
    console.error("DmnJS global not available. Check dmn-js script tag / network.");
    alert("DMN modeler library (dmn-js) not loaded.");
    return;
  }

  dmnModeler = new DmnCtor({
    container: "#dmn-canvas",
    width: "100%",
    height: "100%"
  });
}

async function initCmmnModeler() {
  const container = document.getElementById("cmmn-canvas");
  if (!container) {
    console.error("CMMN canvas element not found");
    return;
  }

  if (typeof CmmnJS === "undefined") {
    console.error("CmmnJS is not loaded. Check script tag in index.html.");
    alert("CMMN modeler library (cmmn-js) not loaded.");
    return;
  }

  cmmnModeler = new CmmnJS({
    container: "#cmmn-canvas"
  });
}

// ---------------------------------------------------------------------------
// Load project XML into editors
// ---------------------------------------------------------------------------

async function loadProjectIntoEditors() {
  if (!currentProject) return;

  // BPMN
  if (bpmnModeler && currentProject.bpmnXml) {
    try {
      await bpmnModeler.importXML(currentProject.bpmnXml);
      fitModelerViewport(bpmnModeler, "bpmn-canvas");
    } catch (err) {
      console.error("Error importing BPMN XML", err);
    }
  }

  // DMN
  if (dmnModeler && currentProject.dmnXml) {
    try {
      const { warnings } = await dmnModeler.importXML(currentProject.dmnXml);
      if (warnings && warnings.length) {
        console.warn("DMN import warnings", warnings);
      }

      const views = dmnModeler.getViews && dmnModeler.getViews();
      if (views && views.length) {
        const activeView = dmnModeler.getActiveView && dmnModeler.getActiveView();
        const viewToOpen = activeView || views[0];
        await dmnModeler.open(viewToOpen);
      }
    } catch (err) {
      console.error("Error importing DMN XML", err);
    }
  }

  // CMMN
  if (cmmnModeler && currentProject.cmmnXml) {
    try {
      await cmmnModeler.importXML(currentProject.cmmnXml);
      fitModelerViewport(cmmnModeler, "cmmn-canvas");
    } catch (err) {
      console.error("Error importing CMMN XML", err);
    }
  }

  updateManifestEditor();
}

// ---------------------------------------------------------------------------
// View helpers
// ---------------------------------------------------------------------------

function isCanvasVisible(canvasEl) {
  if (!canvasEl) return false;
  const style = window.getComputedStyle(canvasEl);
  if (style.display === "none" || style.visibility === "hidden") {
    return false;
  }
  const rect = canvasEl.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function fitModelerViewport(modeler, canvasId) {
  if (!modeler) return;
  const canvasEl = document.getElementById(canvasId);
  if (!isCanvasVisible(canvasEl)) return;

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
  } else if (tab === "dmn") {
    // DMN uses its own internal layout; nothing special for now
  } else if (tab === "cmmn") {
    fitModelerViewport(cmmnModeler, "cmmn-canvas");
  }
}

// ---------------------------------------------------------------------------
// New project
// ---------------------------------------------------------------------------

async function onNewProject() {
  const project = createNewProject();
  setProject(project);
  await loadProjectIntoEditors();
}

// ---------------------------------------------------------------------------
// Sync editors -> project XML
// ---------------------------------------------------------------------------

async function syncProjectXmlFromEditors() {
  if (!currentProject) return;

  // BPMN
  if (bpmnModeler) {
    try {
      const { xml } = await bpmnModeler.saveXML({ format: true });
      currentProject.bpmnXml = xml;
    } catch (err) {
      console.error("Failed to save BPMN XML", err);
    }
  }

  // DMN
  if (dmnModeler) {
    try {
      const { xml } = await dmnModeler.saveXML({ format: true });
      currentProject.dmnXml = xml;
    } catch (err) {
      console.error("Failed to save DMN XML", err);
    }
  }

  // CMMN
  if (cmmnModeler) {
    try {
      const { xml } = await cmmnModeler.saveXML({ format: true });
      currentProject.cmmnXml = xml;
    } catch (err) {
      console.error("Failed to save CMMN XML", err);
    }
  }

  const nowIso = new Date().toISOString();
  currentProject.updatedAt = nowIso;
  if (currentProject.manifest) {
    currentProject.manifest.updatedAt = nowIso;
  }
  updateManifestEditor();
}

// ---------------------------------------------------------------------------
// UAPF export (ZIP)
// ---------------------------------------------------------------------------

async function exportUapf() {
  if (!currentProject) {
    alert("No project loaded.");
    return;
  }

  if (typeof JSZip === "undefined") {
    console.error("JSZip not loaded");
    alert("Export error: JSZip not available.");
    return;
  }

  await syncProjectXmlFromEditors();

  const zip = new JSZip();

  // Manifest
  const manifestJson = JSON.stringify(currentProject.manifest, null, 2);
  zip.file("manifest.json", manifestJson);

  // Models (single file per type for now)
  if (currentProject.bpmnXml) {
    zip.file("bpmn/main.bpmn.xml", currentProject.bpmnXml);
  }
  if (currentProject.dmnXml) {
    zip.file("dmn/main.dmn.xml", currentProject.dmnXml);
  }
  if (currentProject.cmmnXml) {
    zip.file("cmmn/main.cmmn.xml", currentProject.cmmnXml);
  }

  try {
    const blob = await zip.generateAsync({ type: "blob" });
    const safeName = (currentProject.name || "algomation-project").replace(
      /[^a-z0-9_\-]+/gi,
      "_"
    );
    const filename = safeName + ".uapf";

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Failed to generate UAPF ZIP", err);
    alert("Failed to export UAPF. See console for details.");
  }
}

// ---------------------------------------------------------------------------
// UAPF import (stub for now)
// ---------------------------------------------------------------------------

async function onImportUapf(event) {
  const file = event && event.target && event.target.files && event.target.files[0];
  if (!file) return;

  // Step 4 scope: export only. Import will be implemented in a later step.
  alert("UAPF import is not implemented yet in this demo build.");
}

// ---------------------------------------------------------------------------
// App bootstrap
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", async () => {
  setupTabs();
  setupButtons();

  const project = createNewProject();
  setProject(project);

  await initBpmnModeler();
  await initDmnModeler();
  await initCmmnModeler();

  await loadProjectIntoEditors();
});
