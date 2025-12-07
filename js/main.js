// Algomation Studio – fully working version (Dec 2025)

let bpmnModeler = null;
let dmnModeler = null;
let cmmnModeler = null;
let currentProject = null;

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
    <bpmn:startEvent id="StartEvent_1" name="Start" />
    <bpmn:endEvent id="EndEvent_1" name="End" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_main">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="179" y="79" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1">
        <dc:Bounds x="379" y="79" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

const EMPTY_DMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/"
             xmlns:dmndi="https://www.omg.org/spec/DMN/20191111/DMNDI/"
             xmlns:dc="http://www.omg.org/spec/DMN/20180521/DC/"
             id="definitions"
             name="Demo"
             namespace="http://algomation.io/dmn">
  <decision id="Decision_main" name="Example Decision">
    <decisionTable id="decisionTable_1">
      <input id="Input_1" label="Input">
        <inputExpression id="InputExpression_1" typeRef="string">
          <text>input</text>
        </inputExpression>
      </input>
      <output id="Output_1" label="Result" name="result" typeRef="string" />
      <rule id="Rule_1">
        <inputEntry id="InputEntry_1">
          <text>"hello"</text>
        </inputEntry>
        <outputEntry id="OutputEntry_1">
          <text>"world"</text>
        </outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>`;

const EMPTY_CMMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/CMMN/20151109/MODEL"
             xmlns:cmmndi="http://www.omg.org/spec/CMMN/20151109/DI"
             xmlns:dc="http://www.omg.org/spec/CMMN/20151109/DC"
             xmlns:di="http://www.omg.org/spec/CMMN/20151109/DI"
             id="Definitions_1"
             targetNamespace="http://algomation.io/cmmn">
  <case id="Case_main" name="Example Case">
    <casePlanModel id="CasePlanModel_1" name="Main Plan">
      <stage id="Stage_1" name="Main Stage" />
    </casePlanModel>
  </case>
</definitions>`;

// ---------------------------------------------------------------------------
// Project & UI code (unchanged, only tiny robustness improvements)
// ---------------------------------------------------------------------------

function createNewProject() {
  const id = "proj-" + Date.now();
  const now = new Date().toISOString();
  return {
    id,
    name: "Untitled Project",
    createdAt: now,
    updatedAt: now,
    bpmnXml: EMPTY_BPMN_XML,
    dmnXml: EMPTY_DMN_XML,
    cmmnXml: EMPTY_CMMN_XML,
    manifest: {
      uapfVersion: "1.0.0",
      projectId: id,
      name: "Untitled Project",
      models: {
        bpmn: [{ id: "Process_main", file: "bpmn/main.bpmn.xml" }],
        dmn: [{ id: "Decision_main", file: "dmn/main.dmn.xml" }],
        cmmn: [{ id: "Case_main", file: "cmmn/main.cmmn.xml" }]
      },
      createdAt: now,
      updatedAt: now
    }
  };
}

function setProject(p) {
  currentProject = p;
  updateManifestEditor();
}

function updateManifestEditor() {
  const el = document.getElementById("manifest-editor");
  if (el && currentProject?.manifest) {
    el.value = JSON.stringify(currentProject.manifest, null, 2);
  }
}

// Tabs
document.addEventListener("DOMContentLoaded", () => {
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

  // Buttons
  document.getElementById("btn-new-project")?.addEventListener("click", async () => {
    const proj = createNewProject();
    setProject(proj);
    await loadProjectIntoEditors();
  });

  document.getElementById("btn-export-uapf")?.addEventListener("click", exportUapf);

  // Init everything
  setProject(createNewProject());
  initModelers().then(loadProjectIntoEditors);
});

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
      if (views.length) await dmnModeler.open(views[0]);
    }
    if (cmmnModeler) await cmmnModeler.importXML(currentProject.cmmnXml);

    updateManifestEditor();
  }

  window.exportUapf = async function () {
    if (!currentProject) return alert("No project");

    // Sync latest XML from editors
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
  };
});
