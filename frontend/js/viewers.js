let bpmnViewer = null;
let dmnViewer = null;
let cmmnViewer = null;

function resetContainer(containerEl) {
  if (!containerEl) return;
  containerEl.innerHTML = '';
  containerEl.style.pointerEvents = 'none';
}

function fitViewerViewport(viewer) {
  if (!viewer) return;
  try {
    const canvas = viewer.get('canvas');
    if (canvas && typeof canvas.zoom === 'function') canvas.zoom('fit-viewport');
  } catch (err) { console.warn('Could not fit viewer viewport', err); }
}

export function destroyViewers() {
  if (bpmnViewer) { bpmnViewer.destroy(); bpmnViewer = null; }
  if (dmnViewer)  { dmnViewer.destroy();  dmnViewer  = null; }
  if (cmmnViewer) { cmmnViewer.destroy(); cmmnViewer = null; }
}

export function renderBpmnViewer(containerEl, xml) {
  const BpmnCtor = window.BpmnJS;
  if (!BpmnCtor || !containerEl) return null;
  if (bpmnViewer) bpmnViewer.destroy();
  resetContainer(containerEl);
  bpmnViewer = new BpmnCtor({ container: containerEl, keyboard: { bindTo: null } });
  bpmnViewer.importXML(xml).then(() => {
    fitViewerViewport(bpmnViewer);
  }).catch(err => console.error('Failed to render BPMN viewer', err));
  return bpmnViewer;
}

export function renderDmnViewer(containerEl, xml) {
  const DmnCtor = window.DmnJS;
  if (!DmnCtor || !containerEl) return null;
  if (dmnViewer) dmnViewer.destroy();
  resetContainer(containerEl);
  dmnViewer = new DmnCtor({
    container: containerEl,
    drd: { width: '100%', height: '100%' },
    decisionTable: { width: '100%', height: '100%' },
    literalExpression: { width: '100%', height: '100%' },
    keyboard: { bindTo: null }
  });
  dmnViewer.importXML(xml).then(async () => {
    const views = dmnViewer.getViews();
    if (views && views.length) {
      const v = views.find(v => v.type === 'decisionTable') || views[0];
      await dmnViewer.open(v);
    }
  }).catch(err => console.error('Failed to render DMN viewer', err));
  return dmnViewer;
}

export function renderCmmnViewer(containerEl, xml) {
  const CmmnCtor = window.CmmnJS;
  if (!CmmnCtor || !containerEl) return null;
  if (cmmnViewer) cmmnViewer.destroy();
  resetContainer(containerEl);
  cmmnViewer = new CmmnCtor({ container: containerEl, keyboard: { bindTo: null } });
  // cmmn-js@0.20.0 uses callbacks, not promises
  cmmnViewer.importXML(xml, function(err) {
    if (err) { console.error('Failed to render CMMN viewer', err); return; }
    fitViewerViewport(cmmnViewer);
  });
  return cmmnViewer;
}
