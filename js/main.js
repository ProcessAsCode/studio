// main.js – Step 2: basic UI behavior + BPMN modeler initialization

let bpmnModeler = null;

// Minimal default BPMN diagram XML
const EMPTY_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_1"
                  targetNamespace="http://algomation.io/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" name="Start" />
    <bpmn:endEvent id="EndEvent_1" name="End" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
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

document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupButtons();
  initBpmnModeler();
});

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
        alert("UAPF import not implemented yet (later step).");
      }
    });

  document
    .getElementById("btn-export-uapf")
    .addEventListener("click", () => {
      // UAPF export logic will be implemented later
      alert("UAPF export not implemented yet (later step).");
    });
}

// Initialize BPMN modeler on #bpmn-canvas with default diagram
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

  try {
    await bpmnModeler.importXML(EMPTY_BPMN_XML);
    // Center and zoom the diagram
    const canvas = bpmnModeler.get("canvas");
    canvas.zoom("fit-viewport");
  } catch (err) {
    console.error("Error importing default BPMN XML", err);
    alert("Failed to load default BPMN diagram. See console for details.");
  }
}

// "New Project" – for now just reset the BPMN diagram to the default template
async function onNewProject() {
  if (!bpmnModeler) {
    alert("BPMN modeler not initialized yet.");
    return;
  }

  try {
    await bpmnModeler.importXML(EMPTY_BPMN_XML);
    const canvas = bpmnModeler.get("canvas");
    canvas.zoom("fit-viewport");
  } catch (err) {
    console.error("Error resetting BPMN diagram", err);
    alert("Failed to reset BPMN diagram. See console for details.");
  }

  // Later, this will also:
  // - initialize DMN and CMMN templates
  // - create a new AlgomationProject with manifest.json
}
