"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabaseBrowser } from "../lib/supabase/browser-client";

interface Person {
  id: string;
  name: string;
  title: string | null;
  company_name: string | null;
  company_id: string | null;
  linkedin_url: string;
  linkedin_profile_url: string | null;
  status: string | null;
}

interface Company {
  id: string;
  name: string;
  linkedin_url: string;
  website: string | null;
  industry: string | null;
  employee_count: string | null;
  description: string | null;
  location: string | null;
}

interface Template {
  id: string;
  profile_id: string;
  name: string;
  type: string;
  content: string;
  is_current: boolean;
}

interface Profile {
  id: string;
  roles: string[];
  industry: string | null;
  pain_points: string[];
  message_templates: Template[];
}

// Role normalization mapping - maps various titles to canonical roles
const ROLE_ALIASES: Record<string, string[]> = {
  "CEO": ["Chief Executive Officer", "C.E.O.", "Chief Exec"],
  "COO": ["Chief Operating Officer", "C.O.O.", "Chief Operations Officer"],
  "CFO": ["Chief Financial Officer", "C.F.O."],
  "CTO": ["Chief Technology Officer", "C.T.O.", "Chief Tech Officer"],
  "CMO": ["Chief Marketing Officer", "C.M.O."],
  "CRO": ["Chief Revenue Officer", "C.R.O."],
  "CPO": ["Chief Product Officer", "C.P.O."],
  "CHRO": ["Chief Human Resources Officer", "Chief HR Officer", "Chief People Officer"],
  "VP": ["Vice President", "V.P."],
  "SVP": ["Senior Vice President", "Sr. Vice President"],
  "EVP": ["Executive Vice President", "Exec Vice President"],
  "Director": ["Dir.", "Dir"],
  "Owner": ["Business Owner", "Co-Owner"],
  "Founder": ["Co-Founder", "Co Founder", "Cofounder"],
  "President": ["Pres.", "Pres"],
  "Managing Director": ["MD", "M.D."],
  "General Manager": ["GM", "G.M."],
  "Partner": ["Managing Partner", "Senior Partner"],
};

// Build reverse lookup: "Chief Executive Officer" -> "CEO"
const TITLE_TO_ROLE: Record<string, string> = {};
for (const [canonical, aliases] of Object.entries(ROLE_ALIASES)) {
  TITLE_TO_ROLE[canonical.toLowerCase()] = canonical;
  for (const alias of aliases) {
    TITLE_TO_ROLE[alias.toLowerCase()] = canonical;
  }
}

// Find profile matching a person's title - prioritizes direct matches over aliases
function findProfileForTitle(title: string | null, profiles: Profile[]): { profile: Profile; matchedRole: string } | null {
  if (!title) return null;

  const titleLower = title.toLowerCase();

  // Step 1: Exact match of full title against profile roles
  for (const profile of profiles) {
    for (const profileRole of profile.roles) {
      if (profileRole.toLowerCase() === titleLower) {
        return { profile, matchedRole: profileRole };
      }
    }
  }

  // Step 2: Check if any profile role is contained in the title
  // e.g., title "Senior Project Manager" contains profile role "Project Manager"
  // Sort by role length descending to match longer/more specific roles first
  const sortedProfiles = profiles.map(profile => ({
    profile,
    roles: [...profile.roles].sort((a, b) => b.length - a.length)
  }));

  for (const { profile, roles } of sortedProfiles) {
    for (const profileRole of roles) {
      if (titleLower.includes(profileRole.toLowerCase())) {
        return { profile, matchedRole: profileRole };
      }
    }
  }

  // Step 3: Use alias extraction as fallback for C-level and common abbreviations
  // Only use word-boundary matches to avoid "Coordinator" matching "COO"
  const aliasPatterns = [
    { pattern: /\b(ceo)\b/i, role: "CEO" },
    { pattern: /\b(coo)\b/i, role: "COO" },
    { pattern: /\b(cfo)\b/i, role: "CFO" },
    { pattern: /\b(cto)\b/i, role: "CTO" },
    { pattern: /\b(cmo)\b/i, role: "CMO" },
    { pattern: /\b(cro)\b/i, role: "CRO" },
    { pattern: /\b(cpo)\b/i, role: "CPO" },
    { pattern: /\b(chro)\b/i, role: "CHRO" },
    { pattern: /\bchief executive officer\b/i, role: "CEO" },
    { pattern: /\bchief operating officer\b/i, role: "COO" },
    { pattern: /\bchief financial officer\b/i, role: "CFO" },
    { pattern: /\bchief technology officer\b/i, role: "CTO" },
    { pattern: /\bvice president\b/i, role: "VP" },
    { pattern: /\b(vp)\b/i, role: "VP" },
    { pattern: /\b(svp)\b/i, role: "SVP" },
    { pattern: /\b(evp)\b/i, role: "EVP" },
    { pattern: /\bmanaging director\b/i, role: "Managing Director" },
    { pattern: /\bgeneral manager\b/i, role: "General Manager" },
  ];

  for (const { pattern, role } of aliasPatterns) {
    if (pattern.test(title)) {
      for (const profile of profiles) {
        if (profile.roles.some(r => r.toLowerCase() === role.toLowerCase())) {
          return { profile, matchedRole: role };
        }
      }
    }
  }

  return null;
}

type Mode = "connection" | "message";

const MODE_CONFIG = {
  connection: {
    templateType: "connection_note",
    maxChars: 300,
    newStatus: "requested",
    label: "Connection Note",
  },
  message: {
    templateType: "message",
    maxChars: 8000,
    newStatus: "messaged",
    label: "Message",
  },
};

const COLLAPSED_STORAGE_KEY = "messaging-collapsed-companies";

// Load collapsed state from localStorage
function loadCollapsedState(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const saved = localStorage.getItem(COLLAPSED_STORAGE_KEY);
    if (saved) {
      return new Set(JSON.parse(saved));
    }
  } catch (e) {
    console.error("Failed to load collapsed state:", e);
  }
  return new Set();
}

// Save collapsed state to localStorage
function saveCollapsedState(collapsed: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify([...collapsed]));
  } catch (e) {
    console.error("Failed to save collapsed state:", e);
  }
}

export function MessagingTable() {
  const [people, setPeople] = useState<Person[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [templateIds, setTemplateIds] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("connection");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [aiLoadingIds, setAiLoadingIds] = useState<Set<string>>(new Set());
  const [aiLoadingCompanies, setAiLoadingCompanies] = useState<Set<string>>(new Set());
  const [collapsedCompanies, setCollapsedCompanies] = useState<Set<string>>(() => loadCollapsedState());
  const [personalizationNotes, setPersonalizationNotes] = useState<Record<string, string>>({});
  const [aiModel, setAiModel] = useState<string>("gemini/gemini-3-flash-preview");
  const [profileOverrides, setProfileOverrides] = useState<Record<string, string>>({});
  const [profileDropdownOpen, setProfileDropdownOpen] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!profileDropdownOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [profileDropdownOpen]);

  const AI_MODELS = [
    { value: "gemini/gemini-3-flash-preview", label: "Gemini 3 Flash Preview" },
    { value: "groq/gpt-oss-20b", label: "Groq GPT OSS 20B" },
    { value: "groq/llama-3.3-8b", label: "Groq Llama 3.3 8B" },
    { value: "groq/llama-4-scout", label: "Groq Llama 4 Scout" },
    { value: "groq/llama-3.3-70b", label: "Groq Llama 3.3 70B" },
  ];

  const toggleCollapsed = (companyId: string) => {
    setCollapsedCompanies((prev) => {
      const next = new Set(prev);
      if (next.has(companyId)) {
        next.delete(companyId);
      } else {
        next.add(companyId);
      }
      saveCollapsedState(next);
      return next;
    });
  };

  const fetchData = useCallback(async () => {
    try {
      const [peopleRes, companiesRes, profilesRes] = await Promise.all([
        fetch("/api/people?status=saved", {
          headers: { "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "" },
        }),
        fetch("/api/companies", {
          headers: { "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "" },
        }),
        fetch("/api/profiles", {
          headers: { "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "" },
        }),
      ]);

      if (peopleRes.ok) {
        setPeople(await peopleRes.json());
      }
      if (companiesRes.ok) {
        setCompanies(await companiesRes.json());
      }
      if (profilesRes.ok) {
        setProfiles(await profilesRes.json());
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime subscription for people
  useEffect(() => {
    const channel = supabaseBrowser
      .channel("messaging-people-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "people" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newPerson = payload.new as Person;
            if (newPerson.status === "saved") {
              setPeople((prev) => {
                if (prev.some((p) => p.id === newPerson.id)) return prev;
                return [...prev, newPerson];
              });
            }
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as Person;
            if (updated.status === "saved") {
              setPeople((prev) =>
                prev.some((p) => p.id === updated.id)
                  ? prev.map((p) => (p.id === updated.id ? updated : p))
                  : [...prev, updated]
              );
            } else {
              // Remove if status changed away from saved
              setPeople((prev) => prev.filter((p) => p.id !== updated.id));
            }
          } else if (payload.eventType === "DELETE") {
            setPeople((prev) => prev.filter((p) => p.id !== (payload.old as Person).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, []);

  // Create company lookup map
  const companyMap = companies.reduce((acc, company) => {
    acc[company.id] = company;
    return acc;
  }, {} as Record<string, Company>);

  // Group people by company_id
  const groupedByCompany = people.reduce((acc, person) => {
    const companyKey = person.company_id || "no-company";
    if (!acc[companyKey]) {
      acc[companyKey] = [];
    }
    acc[companyKey].push(person);
    return acc;
  }, {} as Record<string, Person[]>);

  // Get company name from companies table, fallback to person's company_name
  const getCompanyName = (companyId: string | null, fallbackName: string | null) => {
    if (companyId && companyMap[companyId]) {
      return companyMap[companyId].name;
    }
    return fallbackName || "Unknown Company";
  };

  // Get effective profile for a person (manual override or auto-match)
  const getEffectiveProfile = (person: Person): { profile: Profile; matchedRole: string; isOverride: boolean } | null => {
    // Check for manual override first
    const overrideProfileId = profileOverrides[person.id];
    if (overrideProfileId) {
      const overrideProfile = profiles.find(p => p.id === overrideProfileId);
      if (overrideProfile) {
        return {
          profile: overrideProfile,
          matchedRole: overrideProfile.roles[0] || "Custom",
          isOverride: true
        };
      }
    }
    // Fall back to auto-match
    const match = findProfileForTitle(person.title, profiles);
    return match ? { ...match, isOverride: false } : null;
  };

  const populateMessage = (person: Person) => {
    const match = getEffectiveProfile(person);
    if (!match) {
      alert(`No profile found for title: "${person.title}"`);
      return;
    }

    const { profile } = match;
    const modeConfig = MODE_CONFIG[mode];

    // Find current template of the right type
    const template = profile.message_templates.find(
      (t) => t.is_current && t.type === modeConfig.templateType
    );

    if (!template) {
      alert(`No current ${modeConfig.label} template for profile with roles: ${profile.roles.join(", ")}`);
      return;
    }

    // For now, just use the template content as-is
    setMessages((prev) => ({ ...prev, [person.id]: template.content }));
    setTemplateIds((prev) => ({ ...prev, [person.id]: template.id }));
  };

  const aiPopulateSingle = async (person: Person): Promise<boolean> => {
    const match = getEffectiveProfile(person);
    if (!match) return false;

    const { profile } = match;
    const config = MODE_CONFIG[mode];

    const template = profile.message_templates.find(
      (t) => t.is_current && t.type === config.templateType
    );

    if (!template) return false;

    const company = person.company_id ? companyMap[person.company_id] : null;

    try {
      const response = await fetch("/api/ai/personalize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "",
        },
        body: JSON.stringify({
          template: template.content,
          person: {
            name: person.name,
            title: person.title,
          },
          company: {
            name: company?.name || person.company_name || "Unknown Company",
            website: company?.website || null,
            industry: company?.industry || null,
            employee_count: company?.employee_count || null,
            description: company?.description || null,
            location: company?.location || null,
          },
          profile: {
            roles: profile.roles,
            pain_points: profile.pain_points,
          },
          maxChars: config.maxChars,
          model: aiModel,
          personalizationNote: personalizationNotes[person.id] || "",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "AI personalization failed");
      }

      const data = await response.json();
      setMessages((prev) => ({ ...prev, [person.id]: data.message }));
      setTemplateIds((prev) => ({ ...prev, [person.id]: template.id }));
      return true;
    } catch (error) {
      console.error("AI populate error for", person.name, ":", error);
      return false;
    }
  };

  const aiPopulate = async (person: Person) => {
    const match = getEffectiveProfile(person);
    if (!match) {
      alert(`No profile found for title: "${person.title}"`);
      return;
    }

    const { profile } = match;
    const config = MODE_CONFIG[mode];

    const template = profile.message_templates.find(
      (t) => t.is_current && t.type === config.templateType
    );

    if (!template) {
      alert(`No current ${config.label} template for profile with roles: ${profile.roles.join(", ")}`);
      return;
    }

    setAiLoadingIds((prev) => new Set(prev).add(person.id));

    const success = await aiPopulateSingle(person);

    setAiLoadingIds((prev) => {
      const next = new Set(prev);
      next.delete(person.id);
      return next;
    });

    if (!success) {
      alert("AI personalization failed");
    }
  };

  const aiPopulateAll = async (companyId: string, companyPeople: Person[]) => {
    const config = MODE_CONFIG[mode];

    // Filter to people who have a matching profile and template
    const eligiblePeople = companyPeople.filter((person) => {
      const match = getEffectiveProfile(person);
      if (!match) return false;
      const template = match.profile.message_templates.find(
        (t) => t.is_current && t.type === config.templateType
      );
      return !!template;
    });

    if (eligiblePeople.length === 0) {
      alert("No eligible people to populate (missing profiles or templates)");
      return;
    }

    // Mark company and all people as loading
    setAiLoadingCompanies((prev) => new Set(prev).add(companyId));
    setAiLoadingIds((prev) => {
      const next = new Set(prev);
      eligiblePeople.forEach((p) => next.add(p.id));
      return next;
    });

    // Process all in parallel
    await Promise.all(eligiblePeople.map((person) => aiPopulateSingle(person)));

    // Clear loading states
    setAiLoadingIds((prev) => {
      const next = new Set(prev);
      eligiblePeople.forEach((p) => next.delete(p.id));
      return next;
    });
    setAiLoadingCompanies((prev) => {
      const next = new Set(prev);
      next.delete(companyId);
      return next;
    });
  };

  const markSent = async (person: Person, shouldCopy: boolean = false) => {
    const message = messages[person.id];
    if (!message) {
      alert("No message to send");
      return;
    }

    setSendingId(person.id);

    try {
      // Copy to clipboard if requested
      if (shouldCopy) {
        await navigator.clipboard.writeText(message);
      }

      const config = MODE_CONFIG[mode];

      // Create outreach log
      await fetch("/api/outreach-logs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "",
        },
        body: JSON.stringify({
          person_id: person.id,
          action: "note_sent",
          template_id: templateIds[person.id] || null,
          details: {
            message_content: message,
            message_type: mode,
          },
        }),
      });

      // Update person status
      await fetch(`/api/people/${person.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "",
        },
        body: JSON.stringify({
          ...person,
          status: config.newStatus,
        }),
      });

      // Clear message from local state
      setMessages((prev) => {
        const next = { ...prev };
        delete next[person.id];
        return next;
      });
      setTemplateIds((prev) => {
        const next = { ...prev };
        delete next[person.id];
        return next;
      });

      if (shouldCopy) {
        setCopiedId(person.id);
        setTimeout(() => setCopiedId(null), 2000);
      }
    } catch (error) {
      console.error("Failed to mark sent:", error);
      alert("Failed to mark as sent");
    } finally {
      setSendingId(null);
    }
  };

  const copyToClipboard = async (personId: string) => {
    const message = messages[personId];
    if (!message) return;

    try {
      await navigator.clipboard.writeText(message);
      setCopiedId(personId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  if (loading) {
    return <div className="sketch-empty">Loading...</div>;
  }

  const companyIds = Object.keys(groupedByCompany);

  // Sort by company name
  const sortedCompanyIds = companyIds.sort((a, b) => {
    const nameA = getCompanyName(a === "no-company" ? null : a, groupedByCompany[a][0]?.company_name);
    const nameB = getCompanyName(b === "no-company" ? null : b, groupedByCompany[b][0]?.company_name);
    return nameA.localeCompare(nameB);
  });

  if (sortedCompanyIds.length === 0) {
    return (
      <div className="sketch-empty">
        No saved people to message. Save people from LinkedIn Sales Navigator first.
      </div>
    );
  }

  const config = MODE_CONFIG[mode];

  return (
    <div className="space-y-6">
      {/* Mode Switch and AI Model Selector */}
      <div className="flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">Mode:</span>
          <div className="flex gap-2">
            <button
              className={`sketch-btn text-sm ${mode === "connection" ? "sketch-btn-primary" : ""}`}
              onClick={() => setMode("connection")}
            >
              Connection Note (300 chars)
            </button>
            <button
              className={`sketch-btn text-sm ${mode === "message" ? "sketch-btn-primary" : ""}`}
              onClick={() => setMode("message")}
            >
              Message (8000 chars)
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">AI Model:</span>
          <select
            className="sketch-select text-sm"
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
          >
            {AI_MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {sortedCompanyIds.map((companyId) => {
        const companyPeople = groupedByCompany[companyId];
        const companyName = getCompanyName(
          companyId === "no-company" ? null : companyId,
          companyPeople[0]?.company_name
        );

        const isCollapsed = collapsedCompanies.has(companyId);

        return (
          <div key={companyId} className="sketch-box p-4 bg-white">
            <div className="flex items-center justify-between">
              <h3
                className="font-bold text-lg flex items-center gap-2 cursor-pointer select-none"
                onClick={() => toggleCollapsed(companyId)}
              >
                <span
                  className="inline-block transition-transform"
                  style={{ transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
                >
                  ▼
                </span>
                {companyName}
                <span className="text-sm font-normal text-gray-500">
                  ({companyPeople.length} {companyPeople.length === 1 ? "person" : "people"})
                </span>
              </h3>
              <button
                className="sketch-btn sketch-btn-primary text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  aiPopulateAll(companyId, companyPeople);
                }}
                disabled={aiLoadingCompanies.has(companyId)}
              >
                {aiLoadingCompanies.has(companyId) ? "AI Populating..." : "AI Populate All"}
              </button>
            </div>
            {!isCollapsed && (
            <div className="space-y-4 mt-3">
              {companyPeople.map((person) => {
              const profileMatch = getEffectiveProfile(person);
              const matchedRole = profileMatch?.matchedRole;
              const matchingProfile = profileMatch?.profile;
              const isOverride = profileMatch?.isOverride || false;

              const config = MODE_CONFIG[mode];

              // Check if profile has a current template of the right type
              const hasCurrentTemplate = matchingProfile?.message_templates.some(
                (t) => t.is_current && t.type === config.templateType
              );

              // Determine status message
              let statusMessage = "";
              if (!matchingProfile) {
                statusMessage = `No profile for title: ${person.title || "No title"}`;
              } else if (!hasCurrentTemplate) {
                statusMessage = `No current ${config.label} template for: ${matchingProfile.roles.join(", ")}`;
              }

              const isDropdownOpen = profileDropdownOpen === person.id;

              return (
                <div
                  key={person.id}
                  className="border border-dashed border-gray-300 rounded p-3"
                >
                  {/* Person header */}
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-bold">{person.name}</div>
                      <div className="text-sm text-gray-600 flex items-center flex-wrap gap-1">
                        {person.title || "No title"}
                        <div className="relative inline-block" ref={isDropdownOpen ? dropdownRef : undefined}>
                          <button
                            onClick={() => setProfileDropdownOpen(isDropdownOpen ? null : person.id)}
                            className={`ml-2 sketch-badge text-xs cursor-pointer hover:opacity-80 ${
                              hasCurrentTemplate ? "sketch-badge-accepted" : ""
                            } ${isOverride ? "ring-2 ring-blue-400" : ""}`}
                            title="Click to change profile"
                          >
                            {matchedRole || "Select profile"}
                            <span className="ml-1">▼</span>
                          </button>
                          {isDropdownOpen && (
                            <div className="absolute left-0 top-full mt-1 bg-white border-2 border-black rounded shadow-lg z-[100] min-w-48 max-h-64 overflow-y-auto">
                              {profiles.map((profile) => {
                                const isSelected = matchingProfile?.id === profile.id;
                                const profileHasTemplate = profile.message_templates.some(
                                  (t) => t.is_current && t.type === config.templateType
                                );
                                return (
                                  <button
                                    key={profile.id}
                                    onClick={() => {
                                      setProfileOverrides((prev) => ({ ...prev, [person.id]: profile.id }));
                                      setProfileDropdownOpen(null);
                                    }}
                                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center justify-between ${
                                      isSelected ? "bg-gray-100 font-bold" : ""
                                    } ${!profileHasTemplate ? "text-gray-400" : ""}`}
                                  >
                                    <span>{profile.roles.join(", ")}</span>
                                    {!profileHasTemplate && <span className="text-xs">(no template)</span>}
                                    {isSelected && <span>✓</span>}
                                  </button>
                                );
                              })}
                              {profileOverrides[person.id] && (
                                <>
                                  <div className="border-t border-gray-200" />
                                  <button
                                    onClick={() => {
                                      setProfileOverrides((prev) => {
                                        const next = { ...prev };
                                        delete next[person.id];
                                        return next;
                                      });
                                      setProfileDropdownOpen(null);
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                                  >
                                    Reset to auto-detect
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      {person.linkedin_profile_url && (
                        <a
                          href={person.linkedin_profile_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          LinkedIn Profile
                        </a>
                      )}
                      {statusMessage && (
                        <div className="text-xs text-red-600 mt-1">{statusMessage}</div>
                      )}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        className="sketch-btn text-xs"
                        onClick={() => populateMessage(person)}
                        disabled={!hasCurrentTemplate}
                        title={hasCurrentTemplate ? "Populate from profile template" : statusMessage}
                      >
                        Populate
                      </button>
                      <button
                        className="sketch-btn sketch-btn-primary text-xs"
                        onClick={() => aiPopulate(person)}
                        disabled={!hasCurrentTemplate || aiLoadingIds.has(person.id)}
                        title={hasCurrentTemplate ? "AI personalized message" : statusMessage}
                      >
                        {aiLoadingIds.has(person.id) ? "AI..." : "AI Populate"}
                      </button>
                      <button
                        className={`sketch-btn text-xs ${
                          copiedId === person.id ? "sketch-btn-primary" : ""
                        }`}
                        onClick={() => copyToClipboard(person.id)}
                        disabled={!messages[person.id]}
                      >
                        {copiedId === person.id ? "Copied!" : "Copy"}
                      </button>
                      <button
                        className="sketch-btn text-xs"
                        onClick={() => markSent(person, false)}
                        disabled={!messages[person.id] || sendingId === person.id}
                      >
                        {sendingId === person.id ? "Saving..." : "Mark Sent"}
                      </button>
                      <button
                        className="sketch-btn sketch-btn-primary text-xs"
                        onClick={() => markSent(person, true)}
                        disabled={!messages[person.id] || sendingId === person.id}
                      >
                        {sendingId === person.id ? "Saving..." : "Copy & Mark Sent"}
                      </button>
                    </div>
                  </div>

                  {/* Personalization note for AI */}
                  <input
                    type="text"
                    className="sketch-input w-full mb-2 text-sm"
                    placeholder="AI personalization note (e.g., 'I like their logo', 'mention their recent funding')"
                    value={personalizationNotes[person.id] || ""}
                    onChange={(e) =>
                      setPersonalizationNotes((prev) => ({ ...prev, [person.id]: e.target.value }))
                    }
                  />
                  {/* Message textarea */}
                  <textarea
                    className="sketch-textarea w-full"
                    rows={4}
                    placeholder="Message content... Click 'Populate' to fill from profile template"
                    value={messages[person.id] || ""}
                    onChange={(e) =>
                      setMessages((prev) => ({ ...prev, [person.id]: e.target.value }))
                    }
                  />
                  {messages[person.id] && (
                    <div className={`text-xs mt-1 ${
                      messages[person.id].length > config.maxChars ? "text-red-600" : "text-gray-500"
                    }`}>
                      {messages[person.id].length} / {config.maxChars} chars
                    </div>
                  )}
                </div>
              );
            })}
            </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
