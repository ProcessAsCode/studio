let bpmnViewer = null;
let dmnViewer = null;
let cmmnViewer = null;

function resetContainer(containerEl) {
  if (!containerEl) return;
  containerEl.innerHTML = '';
  containerEl.style.pointerEvents = 'none';
}

function fitViewerViewport(viewer, containerEl) {
  if (!viewer) return;
  if (containerEl && (containerEl.offsetWidth === 0 || containerEl.offsetHeight === 0)) return;
  try {
    const canvas = viewer.get('canvas');
    if (canvas && typeof canvas.zoom === 'function') canvas.zoom('fit-viewport');
  } catch (err) { /* hidden tab — ignore */ }
}

function syncDmnNavButtons(activeViewType) {
  const backBtn = document.getElementById('btn-dmn-back-to-table');
  if (backBtn) {
    backBtn.style.display = activeViewType === 'drd' ? 'inline-block' : 'none';
  }
}

export function destroyViewers() {
  if (bpmnViewer) { bpmnViewer.destroy(); bpmnViewer = null; }
  if (dmnViewer)  { dmnViewer.destroy();  dmnViewer  = null; }
  if (cmmnViewer) { cmmnViewer.destroy(); cmmnViewer = null; }
  window._activeDmnViewer = null;
  syncDmnNavButtons(null);
}

export function renderBpmnViewer(containerEl, xml) {
  const BpmnCtor = window.BpmnJS;
  if (!BpmnCtor || !containerEl) return null;
  if (bpmnViewer) bpmnViewer.destroy();
  resetContainer(containerEl);
  bpmnViewer = new BpmnCtor({ container: containerEl, keyboard: { bindTo: null } });
  bpmnViewer.importXML(xml).then(() => {
    fitViewerViewport(bpmnViewer, containerEl);
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

  dmnViewer.on('views.changed', ({ activeView }) => {
    syncDmnNavButtons(activeView ? activeView.type : null);
  });

  dmnViewer.importXML(xml).then(async () => {
    const views = dmnViewer.getViews();
    if (views && views.length) {
      const v = views.find(v => v.type === 'decisionTable') || views[0];
      await dmnViewer.open(v);
      syncDmnNavButtons(v.type);
    }
  }).catch(err => console.error('Failed to render DMN viewer', err));

  window._activeDmnViewer = dmnViewer;
  return dmnViewer;
}

export function renderCmmnViewer(containerEl, xml) {
  const CmmnCtor = window.CmmnJS;
  if (!CmmnCtor || !containerEl) return null;
  if (cmmnViewer) cmmnViewer.destroy();
  resetContainer(containerEl);
  cmmnViewer = new CmmnCtor({ container: containerEl, keyboard: { bindTo: null } });
  cmmnViewer.importXML(xml, function(err) {
    if (err) { console.error('Failed to render CMMN viewer', err); return; }
    fitViewerViewport(cmmnViewer, containerEl);
  });
  return cmmnViewer;
}
