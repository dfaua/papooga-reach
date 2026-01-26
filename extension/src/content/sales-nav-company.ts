// Content script for Sales Navigator company page
// Adds "Save to Papooga" button to save company details

import { api } from "../lib/api";
import { getMissingFields, showMissingFieldsPanel } from "./missing-fields-panel";

const BUTTON_ID = "papooga-save-company-btn";

const COMPANY_FIELD_LABELS: Record<string, string> = {
  industry: "Industry",
  employee_count: "Size",
  description: "Description",
  website: "Website",
  location: "Location",
  revenue_range: "Revenue",
};

function extractCompanyData(): {
  linkedin_url: string;
  name: string;
  industry?: string;
  employee_count?: string;
  description?: string;
  website?: string;
  location?: string;
  revenue_range?: string;
} | null {
  try {
    // Get the company URL (current page, cleaned)
    const linkedin_url = window.location.href.split("?")[0];

    // Company name - try multiple selectors
    const nameElement =
      document.querySelector('[data-anonymize="company-name"]') ||
      document.querySelector(".artdeco-entity-lockup__title") ||
      document.querySelector("h1");
    const name = nameElement?.textContent?.trim() || "";

    if (!name) {
      console.error("Papooga: Could not find company name");
      return null;
    }

    // Industry
    const industryElement = document.querySelector(
      '[data-anonymize="industry"]'
    );
    const industry = industryElement?.textContent?.trim();

    // Employee count
    const employeeElement =
      document.querySelector('[data-anonymize="company-size"]') ||
      document.querySelector(".artdeco-entity-lockup__caption");
    const employee_count = employeeElement?.textContent?.trim();

    // Description/About
    const descriptionElement = document.querySelector(
      '[data-anonymize="company-blurb"]'
    );
    const description = descriptionElement?.textContent?.trim();

    // Website - try multiple selectors
    const websiteLink = (
      document.querySelector('[data-anonymize="company-website"] a') ||
      document.querySelector('a[data-control-name="company_website"]') ||
      document.querySelector('a[href^="http"]:not([href*="linkedin.com"])')
    ) as HTMLAnchorElement | null;
    const website = websiteLink?.href;

    // Location/Headquarters
    const locationElement = document.querySelector(
      '[data-anonymize="location"]'
    );
    const location = locationElement?.textContent?.trim();

    // Revenue range - try multiple selectors
    const revenueElement = document.querySelector(
      '[data-anonymize="company-revenue"]'
    ) || document.querySelector('[data-anonymize="revenue"]');
    let revenue_range = revenueElement?.textContent?.trim();

    // If not found with data attribute, try to find by label text
    if (!revenue_range) {
      const dtElements = document.querySelectorAll("dt");
      for (const dt of dtElements) {
        if (dt.textContent?.toLowerCase().includes("revenue")) {
          const dd = dt.nextElementSibling;
          if (dd && dd.tagName === "DD") {
            revenue_range = dd.textContent?.trim();
            break;
          }
        }
      }
    }

    return {
      linkedin_url,
      name,
      industry,
      employee_count,
      description,
      website,
      location,
      revenue_range,
    };
  } catch (error) {
    console.error("Papooga: Error extracting company data:", error);
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
  button.className = "papooga-save-btn";
  button.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
      <polyline points="17 21 17 13 7 13 7 21"></polyline>
      <polyline points="7 3 7 8 15 8"></polyline>
    </svg>
    <span>Save to Papooga</span>
  `;

  button.addEventListener("click", async () => {
    const originalText = button.innerHTML;
    button.innerHTML = '<span>Saving...</span>';
    button.disabled = true;

    const companyData = extractCompanyData();
    if (!companyData) {
      button.innerHTML = '<span>Error: Could not extract data</span>';
      setTimeout(() => {
        button.innerHTML = originalText;
        button.disabled = false;
      }, 2000);
      return;
    }

    try {
      await api.saveCompany(companyData);
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>Saved!</span>
      `;
      button.classList.add("papooga-save-btn-success");

      // Show missing fields panel
      const missingFields = getMissingFields(companyData, COMPANY_FIELD_LABELS);
      showMissingFieldsPanel(missingFields, 170);
    } catch (error) {
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
    const result = await api.checkCompanyByUrl(url);
    if (result.exists) {
      setButtonSaved(button);
    }
  } catch (error) {
    console.error("Papooga: Error checking company:", error);
  }
}

export function initCompanyPage() {
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
