// Shared missing fields panel component

const PANEL_ID = "papooga-missing-fields-panel";

export function getMissingFields(
  data: Record<string, unknown>,
  fieldLabels: Record<string, string>
): string[] {
  const missing: string[] = [];
  for (const [key, label] of Object.entries(fieldLabels)) {
    if (!data[key]) {
      missing.push(label);
    }
  }
  return missing;
}

export function showMissingFieldsPanel(missingFields: string[], bottomPosition: number = 170) {
  // Remove existing panel if any
  document.getElementById(PANEL_ID)?.remove();

  if (missingFields.length === 0) return;

  const panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.className = "papooga-missing-panel";
  panel.style.bottom = `${bottomPosition}px`;
  panel.innerHTML = `
    <div class="papooga-missing-header">
      <span>Missing fields:</span>
      <button class="papooga-missing-close">&times;</button>
    </div>
    <div class="papooga-missing-list">
      ${missingFields.map(f => `<span class="papooga-missing-item">${f}</span>`).join("")}
    </div>
  `;

  // Close button handler
  panel.querySelector(".papooga-missing-close")?.addEventListener("click", () => {
    panel.classList.add("papooga-missing-panel-hiding");
    setTimeout(() => panel.remove(), 200);
  });

  document.body.appendChild(panel);

  // Trigger animation
  requestAnimationFrame(() => {
    panel.classList.add("papooga-missing-panel-visible");
  });

  // Auto-hide after 5 seconds
  setTimeout(() => {
    if (document.getElementById(PANEL_ID)) {
      panel.classList.add("papooga-missing-panel-hiding");
      setTimeout(() => panel.remove(), 200);
    }
  }, 5000);
}
