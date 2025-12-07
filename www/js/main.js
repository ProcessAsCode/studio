// main.js (Step 1: basic UI behavior, no modelers yet)

document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupButtons();
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
        alert("UAPF import not implemented yet (Step 3).");
      }
    });

  document
    .getElementById("btn-export-uapf")
    .addEventListener("click", () => {
      // UAPF export logic will be implemented later
      alert("UAPF export not implemented yet (Step 3).");
    });
}

function onNewProject() {
  // Placeholder for now: later this will create a new AlgomationProject,
  // reset canvases, and populate default XML templates.
  alert("New project functionality will be implemented in Step 2+.");
}
