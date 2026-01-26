// Content script for Sales Navigator company search results
// Adds badges to companies that are already in the database

import { api } from "../lib/api";

const BADGE_CLASS = "papooga-badge";
const BADGE_SAVED_CLASS = "papooga-badge-saved";
const BADGE_CONTACTED_CLASS = "papooga-badge-contacted";

function createBadge(text: string, isContacted: boolean): HTMLElement {
  const badge = document.createElement("span");
  badge.className = `${BADGE_CLASS} ${isContacted ? BADGE_CONTACTED_CLASS : BADGE_SAVED_CLASS}`;
  badge.textContent = text;
  return badge;
}

function extractCompanyUrls(): { url: string; element: Element }[] {
  const results: { url: string; element: Element }[] = [];

  // Sales Navigator company search result cards
  // The structure may vary, so we look for links to company pages
  const companyLinks = document.querySelectorAll(
    'a[href*="/sales/company/"]'
  );

  companyLinks.forEach((link) => {
    const href = link.getAttribute("href");
    if (!href) return;

    // Build full URL
    const fullUrl = href.startsWith("http")
      ? href
      : `https://www.linkedin.com${href}`;

    // Clean URL (remove query params)
    const cleanUrl = fullUrl.split("?")[0];

    // Find the parent card element to attach the badge
    const card = link.closest('[data-anonymize="company-name"]') ||
      link.closest(".artdeco-entity-lockup") ||
      link.closest(".search-results__result-item") ||
      link.parentElement;

    if (card && !card.querySelector(`.${BADGE_CLASS}`)) {
      results.push({ url: cleanUrl, element: card });
    }
  });

  return results;
}

async function addBadgesToResults() {
  const companies = extractCompanyUrls();
  if (companies.length === 0) return;

  const urls = companies.map((c) => c.url);

  try {
    const checkResults = await api.checkCompanies(urls);

    companies.forEach(({ url, element }) => {
      const result = checkResults[url];
      if (result?.exists) {
        const badge = createBadge(
          result.is_contacted ? "Contacted" : "Saved",
          result.is_contacted
        );

        // Insert badge at the beginning of the element
        const titleElement = element.querySelector('[data-anonymize="company-name"]') ||
          element.querySelector('.artdeco-entity-lockup__title') ||
          element.firstElementChild;

        if (titleElement) {
          titleElement.insertAdjacentElement("afterend", badge);
        } else {
          element.insertAdjacentElement("afterbegin", badge);
        }
      }
    });
  } catch (error) {
    console.error("Papooga: Error checking companies:", error);
  }
}

export function initSearchBadges() {
  // Initial check
  addBadgesToResults();

  // Watch for new results being loaded (infinite scroll, pagination)
  const observer = new MutationObserver((mutations) => {
    // Debounce - only run if there are actual new nodes
    const hasNewNodes = mutations.some(
      (m) => m.addedNodes.length > 0 && m.type === "childList"
    );
    if (hasNewNodes) {
      setTimeout(addBadgesToResults, 300);
    }
  });

  // Observe the results container
  const resultsContainer =
    document.querySelector(".search-results__result-list") ||
    document.querySelector('[data-view-name="search-results-list"]') ||
    document.body;

  observer.observe(resultsContainer, {
    childList: true,
    subtree: true,
  });
}
