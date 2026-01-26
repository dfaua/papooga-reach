import { getConfig, saveConfig } from "../lib/config";

async function checkApiConnection(
  apiUrl: string,
  apiKey: string
): Promise<boolean> {
  if (!apiKey) return false;

  try {
    const response = await fetch(`${apiUrl}/api/companies`, {
      headers: {
        "X-API-Key": apiKey,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function getStats(
  apiUrl: string,
  apiKey: string
): Promise<{ companies: number; people: number }> {
  try {
    const [companiesRes, peopleRes] = await Promise.all([
      fetch(`${apiUrl}/api/companies`, {
        headers: { "X-API-Key": apiKey },
      }),
      fetch(`${apiUrl}/api/people`, {
        headers: { "X-API-Key": apiKey },
      }),
    ]);

    const companies = companiesRes.ok ? (await companiesRes.json()).length : 0;
    const people = peopleRes.ok ? (await peopleRes.json()).length : 0;

    return { companies, people };
  } catch {
    return { companies: 0, people: 0 };
  }
}

async function updateStatus(apiUrl: string, apiKey: string) {
  const statusDot = document.getElementById("status-dot");
  const statusText = document.getElementById("status-text");
  const companiesCount = document.getElementById("companies-count");
  const peopleCount = document.getElementById("people-count");
  const dashboardLink = document.getElementById(
    "dashboard-link"
  ) as HTMLAnchorElement;

  // Update dashboard link
  if (dashboardLink) {
    dashboardLink.href = apiUrl;
  }

  if (!apiKey) {
    if (statusDot && statusText) {
      statusDot.classList.remove("connected");
      statusDot.classList.add("error");
      statusText.textContent = "API key not set";
    }
    if (companiesCount) companiesCount.textContent = "-";
    if (peopleCount) peopleCount.textContent = "-";
    return;
  }

  // Check API connection
  const isConnected = await checkApiConnection(apiUrl, apiKey);

  if (statusDot && statusText) {
    if (isConnected) {
      statusDot.classList.remove("error");
      statusDot.classList.add("connected");
      statusText.textContent = "Connected";
    } else {
      statusDot.classList.remove("connected");
      statusDot.classList.add("error");
      statusText.textContent = "API offline - start server";
    }
  }

  // Get stats
  if (isConnected) {
    const stats = await getStats(apiUrl, apiKey);
    if (companiesCount) companiesCount.textContent = stats.companies.toString();
    if (peopleCount) peopleCount.textContent = stats.people.toString();
  } else {
    if (companiesCount) companiesCount.textContent = "-";
    if (peopleCount) peopleCount.textContent = "-";
  }
}

async function init() {
  const config = await getConfig();

  const apiUrlInput = document.getElementById("api-url") as HTMLInputElement;
  const apiKeyInput = document.getElementById("api-key") as HTMLInputElement;
  const saveBtn = document.getElementById("save-settings");
  const settingsToggle = document.getElementById("settings-toggle");
  const settingsPanel = document.getElementById("settings-panel");

  // Load saved config into inputs
  if (apiUrlInput) apiUrlInput.value = config.apiUrl;
  if (apiKeyInput) apiKeyInput.value = config.apiKey;

  // Toggle settings panel
  settingsToggle?.addEventListener("click", () => {
    settingsPanel?.classList.toggle("hidden");
    settingsToggle.textContent = settingsPanel?.classList.contains("hidden")
      ? "Settings"
      : "Hide";
  });

  // Save settings
  saveBtn?.addEventListener("click", async () => {
    const newApiUrl = apiUrlInput?.value.trim() || "http://localhost:3000";
    const newApiKey = apiKeyInput?.value.trim() || "";

    await saveConfig({ apiUrl: newApiUrl, apiKey: newApiKey });

    // Update status with new config
    await updateStatus(newApiUrl, newApiKey);

    // Brief visual feedback
    if (saveBtn) {
      const originalText = saveBtn.textContent;
      saveBtn.textContent = "Saved!";
      setTimeout(() => {
        saveBtn.textContent = originalText;
      }, 1000);
    }
  });

  // Initial status check
  await updateStatus(config.apiUrl, config.apiKey);
}

init();
