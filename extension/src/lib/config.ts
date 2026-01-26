// Configuration for the extension
// Settings are stored in Chrome storage and can be configured via the popup

export interface Config {
  apiUrl: string;
  apiKey: string;
}

const DEFAULT_CONFIG: Config = {
  apiUrl: "http://localhost:3000",
  apiKey: "",
};

export async function getConfig(): Promise<Config> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["apiUrl", "apiKey"], (result) => {
      resolve({
        apiUrl: result.apiUrl || DEFAULT_CONFIG.apiUrl,
        apiKey: result.apiKey || DEFAULT_CONFIG.apiKey,
      });
    });
  });
}

export async function saveConfig(config: Partial<Config>): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.set(config, resolve);
  });
}
