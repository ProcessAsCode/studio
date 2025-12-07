// main.js – Step 3: BPMN + DMN + CMMN editors + basic project/manifest

let bpmnModeler = null;
let dmnModeler = null;
let cmmnModeler = null;

let currentProject = null;

// --- Default XML templates --------------------------------------------------

// Minimal BPMN diagram
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

// Minimal DMN decision table
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

// Minimal CMMN case model
const EMPTY_CMMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<cmmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  xmlns:cmmn="http://www.omg.org/spec/CMMN/20151109/MODEL"
                  xmlns:cmmndi="http://www.omg.org/spec/CMMN/20151109/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="CMMNDefinitions_1"
                  targetNamespace="http://algomation.io/cmmn">
  <cmmn:case id="Case_main" name="Example case">
    <cmmn:casePlanModel id="CasePlanModel_1" name="Case plan">
      <cmmn:stage id="Stage_1" name="Main stage" />
    </cmmn:casePlanModel>
  </cmmn:case>
  <cmmndi:CMMNDiagram id="CMMNDiagram_1">
    <cmmndi:CMMNPlane id="CMMNPlane_1" cmmnElementRef="CasePlanModel_1">
      <cmmndi:CMMNShape id="CasePlanModel_1_di" cmmnElementRef="CasePlanModel_1">
        <dc:Bounds x="150" y="80" width="400" height="250" />
      </cmmndi:CMMNShape>
    </cmmndi:CMMNPlane>
  </cmmndi:CMMNDiagram>
</cmmn:definitions>
`;

// --- Project helpers --------------------------------------------------------

function createNewProject() {
  const id = "proj-" + Date.now();
  const nowIso = new Date().toISOString();

  return {
    id,
    name: "Untitled Project",
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

function updateManifestEditor() {
  const manifestEditor = document.getElementById("manifest-editor");
  if (!manifestEditor || !currentProject) return;

  manifestEditor.value = JSON.stringify(currentProject.manifest, null, 2);
}

function setProject(project) {
  currentProject = project;
  if (!currentProject) return;

  currentProject.updatedAt = new Date().toISOString();
  if (currentProject.manifest) {
    currentProject.manifest.updatedAt = currentProject.updatedAt;
  }

  updateManifestEditor();
}

// --- App init ---------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupButtons();
  initBpmnModeler();
  initDmnModeler();
  initCmmnModeler();

  // Initialize first project
  const proj = createNewProject();
  setProject(proj);
  loadProjectIntoEditors();
});

// --- Tabs & buttons ---------------------------------------------------------

function setupTabs() {
  const buttons = document.querySelectorAll(".tab-button");
  const panels = document.querySelectorAll(".tab-panel");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-tab");

      buttons.forEach((b) => b.classList.remove("active"));
      panels.forEach((p) => p.classList.remove("active"));

      btn.classList.add("active");
      document.getElementById(`tab-${tab}`).classList.add("active");

      // Refit the currently visible canvas to avoid non-finite zoom values
      fitTabView(tab);
    });
  });
}

function setupButtons() {
  document
    .getElementById("btn-new-project")
    .addEventListener("click", onNewProject);

  document
    .getElementById("btn-import-uapf")
    .addEventListener("click", () => {
      document.getElementById("uapf-file-input").click();
    });

  document
    .getElementById("uapf-file-input")
    .addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        // UAPF import logic will be implemented in a later step
        alert("UAPF import not implemented yet.");
        e.target.value = "";
      }
    });

  document
    .getElementById("btn-export-uapf")
    .addEventListener("click", () => {
      // UAPF export logic will be implemented later
      alert("UAPF export not implemented yet.");
    });

  const manifestEditor = document.getElementById("manifest-editor");
  if (manifestEditor) {
    manifestEditor.addEventListener("input", () => {
      if (!currentProject) return;
      try {
        const parsed = JSON.parse(manifestEditor.value);
        currentProject.manifest = parsed;
      } catch (err) {
        // ignore invalid JSON while typing
      }
    });
  }
}

function isCanvasVisible(canvasEl) {
  if (!canvasEl) return false;
  const rect = canvasEl.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function fitModelerViewport(modeler, canvasId) {
  if (!modeler) return;
  const canvasEl = document.getElementById(canvasId);
  if (!isCanvasVisible(canvasEl)) return;

  try {
    const canvas = modeler.get("canvas");
    canvas.zoom("fit-viewport");
  } catch (err) {
    console.warn("Could not fit viewport for", canvasId, err);
  }
}

function fitTabView(tab) {
  if (tab === "bpmn") {
    fitModelerViewport(bpmnModeler, "bpmn-canvas");
  } else if (tab === "cmmn") {
    fitModelerViewport(cmmnModeler, "cmmn-canvas");
  } else if (tab === "dmn") {
    // DMN handles view activation separately but we still make sure canvases render
    if (dmnModeler) {
      const activeView = dmnModeler.getActiveView();
      if (activeView) {
        dmnModeler.open(activeView);
      }
    }
  }
}

// --- BPMN -------------------------------------------------------------------

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

// --- DMN --------------------------------------------------------------------

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

// --- CMMN -------------------------------------------------------------------

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

// --- Load project XML into editors -----------------------------------------

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
      await dmnModeler.importXML(currentProject.dmnXml);
      // dmn-js uses active viewer for different views (DRD, decision table etc.)
      const activeView = dmnModeler.getActiveView();
      if (activeView) {
        dmnModeler.open(activeView);
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

// --- New project ------------------------------------------------------------

async function onNewProject() {
  const proj = createNewProject();
  setProject(proj);
  await loadProjectIntoEditors();
}
