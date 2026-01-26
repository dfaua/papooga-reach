// Background service worker for the extension
// Handles API requests from content scripts (to bypass CORS)

import { getConfig } from "../lib/config";

// Keep service worker alive to prevent slow wake-up times
const KEEP_ALIVE_INTERVAL = "papooga-keep-alive";

chrome.runtime.onInstalled.addListener(() => {
  console.log("Papooga extension installed");
  // Set up keep-alive alarm (every 20 seconds)
  chrome.alarms.create(KEEP_ALIVE_INTERVAL, { periodInMinutes: 0.33 });
});

// Also set up alarm on startup (in case extension was already installed)
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(KEEP_ALIVE_INTERVAL, { periodInMinutes: 0.33 });
});

// Handle keep-alive alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEP_ALIVE_INTERVAL) {
    // Just log to keep the service worker active
    console.log("Papooga: Keep-alive ping");
  }
});

// Ensure alarm exists on service worker start
chrome.alarms.get(KEEP_ALIVE_INTERVAL, (alarm) => {
  if (!alarm) {
    chrome.alarms.create(KEEP_ALIVE_INTERVAL, { periodInMinutes: 0.33 });
    console.log("Papooga: Keep-alive alarm created");
  }
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Handle ping to wake up service worker
  if (message.type === "PING") {
    sendResponse({ pong: true });
    return false;
  }

  if (message.type === "API_REQUEST") {
    console.log(`Papooga SW: Received request for ${message.endpoint}`);
    const startTime = Date.now();
    handleApiRequest(message.endpoint, message.options)
      .then((result) => {
        console.log(`Papooga SW: Request completed in ${Date.now() - startTime}ms`);
        sendResponse({ success: true, data: result });
      })
      .catch((error) => {
        console.log(`Papooga SW: Request failed in ${Date.now() - startTime}ms`);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }
  return false;
});

async function handleApiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<unknown> {
  console.log(`Papooga SW: 1 - Getting config...`);
  const config = await getConfig();
  console.log(`Papooga SW: 2 - Config loaded`);

  if (!config.apiKey) {
    throw new Error("API key not configured. Please set it in the extension popup.");
  }

  console.log(`Papooga SW: 3 - Fetching ${endpoint}...`);
  const response = await fetch(`${config.apiUrl}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": config.apiKey,
      ...options.headers,
    },
  });
  console.log(`Papooga SW: 4 - Fetch complete, status ${response.status}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  console.log(`Papooga SW: 5 - Parsing JSON...`);
  const data = await response.json();
  console.log(`Papooga SW: 6 - Done`);
  return data;
}
