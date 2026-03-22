
function normalizePath(path) {
  if (!path) return null;
  return path.startsWith('/') ? path.slice(1) : path;
}

function resolveModelFile(manifest, type, fallbackPaths = []) {
  const entries = manifest?.models?.[type];
  if (Array.isArray(entries) && entries.length) {
    return normalizePath(entries[0].file);
  }
  return fallbackPaths.find(Boolean);
}

export async function loadDemoCatalog() {
  const response = await fetch('/demo/examples.json');
  if (!response.ok) {
    throw new Error('Failed to load demo catalog');
  }
  const data = await response.json();
  return Array.isArray(data.examples) ? data.examples : [];
}

export async function loadDemoProjectById(exampleId) {
  const example = (window.APP?.demo?.catalog || []).find((entry) => entry.id === exampleId);
  if (!example) {
    throw new Error('Demo example not found');
  }

  if (example.file.endsWith('.json')) {
    const response = await fetch(`/demo/${example.file}`);
    if (!response.ok) {
      throw new Error('Failed to load demo project file');
    }

    const data = await response.json();
    return {
      id: example.id,
      title: example.title,
      bpmnXml: data.bpmnXml || '',
      dmnXml: data.dmnXml || '',
      cmmnXml: data.cmmnXml || '',
      manifest: data.manifest || {
        name: example.title,
        description: example.description,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        links: []
      }
    };
  }

  if (typeof JSZip === 'undefined') {
    throw new Error('JSZip is not available. Cannot load demo project.');
  }

  const response = await fetch(`/demo/${example.file}`);
  if (!response.ok) {
    throw new Error('Failed to load demo project file');
  }

  const arrayBuffer = await response.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const manifestFile = zip.files['manifest.json'];
  let manifest = null;
  if (manifestFile) {
    const manifestText = await manifestFile.async('string');
    try {
      manifest = JSON.parse(manifestText);
    } catch (err) {
      manifest = null;
    }
  }

  const bpmnPath = resolveModelFile(manifest, 'bpmn', ['bpmn/main.bpmn.xml', 'bpmn/main.bpmn', 'bpmn/process.bpmn']);
  const dmnPath = resolveModelFile(manifest, 'dmn', ['dmn/main.dmn.xml', 'dmn/main.dmn', 'dmn/decision.dmn']);
  const cmmnPath = resolveModelFile(manifest, 'cmmn', ['cmmn/main.cmmn.xml', 'cmmn/main.cmmn', 'cmmn/case.cmmn']);

  const bpmnXml = bpmnPath && zip.files[bpmnPath]
    ? await zip.files[bpmnPath].async('string')
    : '';
  const dmnXml = dmnPath && zip.files[dmnPath]
    ? await zip.files[dmnPath].async('string')
    : '';
  const cmmnXml = cmmnPath && zip.files[cmmnPath]
    ? await zip.files[cmmnPath].async('string')
    : '';

  return {
    id: example.id,
    title: example.title,
    bpmnXml,
    dmnXml,
    cmmnXml,
    manifest: manifest || {
      name: example.title,
      description: example.description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      links: []
    }
  };
}
