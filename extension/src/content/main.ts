// Main content script entry point
// Loads appropriate functionality based on current URL

import "../styles/content.css";
import { initSearchBadges } from "./sales-nav-search";
import { initCompanyPage } from "./sales-nav-company";
import { initProfilePage } from "./sales-nav-profile";
import { initConnectionModal } from "./linkedin-connect";

// Pre-warm the service worker so it's ready when user clicks save
function warmUpServiceWorker() {
  chrome.runtime.sendMessage({ type: "PING" }, () => {
    // Ignore errors - just want to wake up the service worker
    if (chrome.runtime.lastError) {
      // Silently ignore
    }
  });
}

function init() {
  // Wake up service worker immediately
  warmUpServiceWorker();
  const url = window.location.href;

  // Sales Navigator company search results
  if (url.includes("/sales/search/company")) {
    initSearchBadges();
  }

  // Sales Navigator company page
  if (url.includes("/sales/company/")) {
    initCompanyPage();
  }

  // Sales Navigator lead/person profile
  if (url.includes("/sales/lead/")) {
    initProfilePage();
  }

  // Always init connection modal watcher (works on any LinkedIn page)
  initConnectionModal();

  console.log("Papooga extension loaded");
}

// Run on page load
init();

// Re-run on URL changes (LinkedIn is a SPA)
let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    // Small delay to let the page render
    setTimeout(init, 500);
  }
});

observer.observe(document.body, { childList: true, subtree: true });
