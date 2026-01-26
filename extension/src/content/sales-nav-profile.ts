// Content script for Sales Navigator lead/person profile
// Adds "Save to Papooga" button to save person details

import { api } from "../lib/api";
import { getMissingFields, showMissingFieldsPanel } from "./missing-fields-panel";

const BUTTON_ID = "papooga-save-person-btn";

const PERSON_FIELD_LABELS: Record<string, string> = {
  title: "Title",
  company_name: "Company",
  company_linkedin_url: "Company URL",
  linkedin_profile_url: "LinkedIn URL",
  connections_count: "Connections",
};

// Parse number from text like "500+ connections" or "1,234 followers"
function parseCount(text: string | null | undefined): number | undefined {
  if (!text) return undefined;
  // Remove commas and plus signs, extract first number
  const match = text.replace(/,/g, "").match(/(\d+)/);
  return match ? parseInt(match[1], 10) : undefined;
}

function extractPersonData(): {
  linkedin_url: string;
  linkedin_profile_url?: string;
  name: string;
  title?: string;
  company_name?: string;
  company_linkedin_url?: string;
  connections_count?: number;
} | null {
  try {
    // Get the person's Sales Navigator URL (current page, cleaned)
    const linkedin_url = window.location.href.split("?")[0];

    // Person's name
    const nameElement =
      document.querySelector('[data-anonymize="person-name"]') ||
      document.querySelector(".artdeco-entity-lockup__title") ||
      document.querySelector("h1");
    const name = nameElement?.textContent?.trim() || "";

    if (!name) {
      console.error("Papooga: Could not find person name");
      return null;
    }

    // Title/Position - fixed selector
    const titleElement =
      document.querySelector('[data-anonymize="job-title"]') ||
      document.querySelector('[data-anonymize="title"]') ||
      document.querySelector(".artdeco-entity-lockup__subtitle");
    const title = titleElement?.textContent?.trim();

    // Company name
    const companyElement =
      document.querySelector('[data-anonymize="company-name"]') ||
      document.querySelector(".artdeco-entity-lockup__caption a");
    const company_name = companyElement?.textContent?.trim();

    // Company LinkedIn URL
    const companyLink = document.querySelector(
      'a[href*="/sales/company/"]'
    ) as HTMLAnchorElement | null;
    let company_linkedin_url: string | undefined;
    if (companyLink) {
      const href = companyLink.getAttribute("href") || "";
      company_linkedin_url = href.startsWith("http")
        ? href.split("?")[0]
        : `https://www.linkedin.com${href.split("?")[0]}`;
    }

    // Regular LinkedIn profile URL (linkedin.com/in/xxx)
    // DEBUG: Log all anchor tags to find LinkedIn profile URL pattern
    console.log("Papooga DEBUG: === All anchor hrefs on page ===");
    const allLinks = document.querySelectorAll("a[href]");
    allLinks.forEach((link, index) => {
      const href = (link as HTMLAnchorElement).getAttribute("href") || "";
      // Only log LinkedIn-related links to reduce noise
      if (href.includes("linkedin")) {
        console.log(`Papooga DEBUG: Link ${index}: ${href}`);
      }
    });
    console.log("Papooga DEBUG: === End of links ===");

    // Look for link to regular LinkedIn profile
    const profileLink = document.querySelector(
      'a[href*="linkedin.com/in/"]'
    ) as HTMLAnchorElement | null;
    let linkedin_profile_url: string | undefined;
    if (profileLink) {
      const href = profileLink.getAttribute("href") || "";
      linkedin_profile_url = href.split("?")[0];
      console.log("Papooga DEBUG: Found linkedin_profile_url:", linkedin_profile_url);
    } else {
      console.log("Papooga DEBUG: No linkedin.com/in/ link found");
    }

    // Connections count parsing
    // Use TreeWalker to find text nodes containing "connection"
    let connections_count: number | undefined;

    // Create a TreeWalker to iterate through all text nodes
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    );

    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      const text = node.textContent?.trim() || "";
      if (!text || text.length > 50) continue; // Skip empty or long text

      // Check for connections - matches "500+ connections", "1,234 connections", etc.
      if (!connections_count && /connection/i.test(text)) {
        const match = text.match(/(\d[\d,]*)\s*\+?\s*connection/i);
        if (match) {
          connections_count = parseCount(match[1]);
          console.log("Papooga: Found connections text:", text, "-> parsed:", connections_count);
          break;
        }
      }
    }

    console.log("Papooga: Final network stats -", { connections_count });

    return {
      linkedin_url,
      linkedin_profile_url,
      name,
      title,
      company_name,
      company_linkedin_url,
      connections_count,
    };
  } catch (error) {
    console.error("Papooga: Error extracting person data:", error);
    return null;
  }
}

function setButtonSaved(button: HTMLButtonElement) {
  button.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
    <span>Already saved</span>
  `;
  button.classList.add("papooga-save-btn-success");
  button.disabled = true;
}

function createSaveButton(): HTMLButtonElement {
  const button = document.createElement("button");
  button.id = BUTTON_ID;
  button.className = "papooga-save-btn papooga-save-btn-person";
  button.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
    <span>Save to Papooga</span>
  `;

  button.addEventListener("click", async () => {
    console.log("Papooga TIMING: 1 - Button clicked");
    const originalText = button.innerHTML;
    button.innerHTML = '<span>Saving...</span>';
    button.disabled = true;

    console.log("Papooga TIMING: 2 - Extracting person data...");
    const personData = extractPersonData();
    console.log("Papooga TIMING: 3 - Person data extracted");

    if (!personData) {
      button.innerHTML = '<span>Error: Could not extract data</span>';
      setTimeout(() => {
        button.innerHTML = originalText;
        button.disabled = false;
      }, 2000);
      return;
    }

    try {
      // Try to find and link company_id if we have company URL
      let company_id: string | undefined;
      if (personData.company_linkedin_url) {
        console.log("Papooga TIMING: 4 - Finding company by URL...");
        const company = await api.findCompanyByUrl(personData.company_linkedin_url);
        console.log("Papooga TIMING: 5 - Company lookup done");
        if (company) {
          company_id = company.id;
        }
      } else {
        console.log("Papooga TIMING: 4 - No company URL, skipping lookup");
      }

      console.log("Papooga TIMING: 6 - Saving person...");
      await api.savePerson({
        ...personData,
        company_id,
      });
      console.log("Papooga TIMING: 7 - Person saved");

      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>Saved!</span>
      `;
      button.classList.add("papooga-save-btn-success");

      // Show missing fields panel (person button is at 170px, so panel at 240px)
      console.log("Papooga TIMING: 8 - Getting missing fields...");
      const missingFields = getMissingFields(personData, PERSON_FIELD_LABELS);

      // Add note if company wasn't linked
      if (personData.company_linkedin_url && !company_id) {
        missingFields.push("Company not in DB");
      }

      showMissingFieldsPanel(missingFields, 240);
      console.log("Papooga TIMING: 9 - Done");
    } catch (error) {
      console.log("Papooga TIMING: ERROR", error);
      const errorMessage = error instanceof Error ? error.message : "Error";
      if (errorMessage.includes("already exists")) {
        setButtonSaved(button);
      } else {
        button.innerHTML = `<span>Error: ${errorMessage}</span>`;
        setTimeout(() => {
          button.innerHTML = originalText;
          button.disabled = false;
        }, 2000);
      }
    }
  });

  return button;
}

async function checkIfAlreadySaved(button: HTMLButtonElement) {
  const url = window.location.href.split("?")[0];
  try {
    const result = await api.checkPersonByUrl(url);
    if (result.exists) {
      setButtonSaved(button);
    }
  } catch (error) {
    console.error("Papooga: Error checking person:", error);
  }
}

export function initProfilePage() {
  // Remove any existing button first (handles SPA navigation)
  const existingButton = document.getElementById(BUTTON_ID);
  if (existingButton) {
    existingButton.remove();
  }

  // Wait a bit for the page to fully load
  setTimeout(() => {
    const button = createSaveButton();
    document.body.appendChild(button);

    // Check if already saved
    checkIfAlreadySaved(button);
  }, 500);
}
