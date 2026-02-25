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
  sequence_number: number | null;
}

interface Profile {
  id: string;
  roles: string[];
  industry: string | null;
  pain_points: string[];
  message_templates: Template[];
}

interface OutreachLog {
  id: string;
  person_id: string;
  action: string;
  outcome: string | null;
  created_at: string;
  updated_at: string;
}

// Role matching - same as MessagingTable
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

const MAX_CHARS = 8000;

const COLLAPSED_STORAGE_KEY = "followups-collapsed-companies";

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

function saveCollapsedState(collapsed: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify([...collapsed]));
  } catch (e) {
    console.error("Failed to save collapsed state:", e);
  }
}

export function FollowUpsTable() {
  const [people, setPeople] = useState<Person[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [outreachLogs, setOutreachLogs] = useState<OutreachLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [templateIds, setTemplateIds] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [aiLoadingIds, setAiLoadingIds] = useState<Set<string>>(new Set());
  const [aiLoadingCompanies, setAiLoadingCompanies] = useState<Set<string>>(new Set());
  const [collapsedCompanies, setCollapsedCompanies] = useState<Set<string>>(() => loadCollapsedState());
  const [personalizationNotes, setPersonalizationNotes] = useState<Record<string, string>>({});
  const [aiModel, setAiModel] = useState<string>("gemini/gemini-3-flash-preview");
  const [profileOverrides, setProfileOverrides] = useState<Record<string, string>>({});
  const [profileDropdownOpen, setProfileDropdownOpen] = useState<string | null>(null);
  const [selectedProfileFilter, setSelectedProfileFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");
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
      // Fetch all people, companies, profiles, outreach logs, and messages
      // We'll filter for accepted connections without replies in the component
      const [peopleRes, companiesRes, profilesRes, logsRes, messagesRes] = await Promise.all([
        fetch("/api/people", {
          headers: { "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "" },
        }),
        fetch("/api/companies", {
          headers: { "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "" },
        }),
        fetch("/api/profiles", {
          headers: { "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "" },
        }),
        fetch("/api/outreach-logs", {
          headers: { "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "" },
        }),
        fetch("/api/messages", {
          headers: { "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "" },
        }),
      ]);

      let allPeople: Person[] = [];
      let allMessages: Array<{ person_id: string; direction: string }> = [];
      let acceptedLogs: OutreachLog[] = [];

      if (peopleRes.ok) {
        allPeople = await peopleRes.json();
      }
      if (companiesRes.ok) {
        setCompanies(await companiesRes.json());
      }
      if (profilesRes.ok) {
        setProfiles(await profilesRes.json());
      }
      if (logsRes.ok) {
        acceptedLogs = await logsRes.json();
        setOutreachLogs(acceptedLogs);
      }
      if (messagesRes.ok) {
        allMessages = await messagesRes.json();
      }

      // Filter people who have accepted connections but no received messages
      const peopleWithAcceptedConnections = new Set(
        acceptedLogs
          .filter((log) => log.outcome === "accepted")
          .map((log) => log.person_id)
      );

      const peopleWithReceivedMessages = new Set(
        allMessages
          .filter((msg) => msg.direction === "received")
          .map((msg) => msg.person_id)
      );

      const filteredPeople = allPeople.filter(
        (person) =>
          peopleWithAcceptedConnections.has(person.id) &&
          !peopleWithReceivedMessages.has(person.id)
      );

      setPeople(filteredPeople);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime subscriptions for outreach_logs and messages changes
  // When these change, we need to re-filter the people list
  useEffect(() => {
    const outreachChannel = supabaseBrowser
      .channel("followups-outreach-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "outreach_logs" },
        () => {
          // Re-fetch data when outreach logs change (e.g., outcome updated to 'accepted')
          fetchData();
        }
      )
      .subscribe();

    const messagesChannel = supabaseBrowser
      .channel("followups-messages-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          // If someone replied, remove them from the follow-ups list
          const newMessage = payload.new as { person_id: string; direction: string };
          if (newMessage.direction === "received") {
            setPeople((prev) => prev.filter((p) => p.id !== newMessage.person_id));
          }
        }
      )
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(outreachChannel);
      supabaseBrowser.removeChannel(messagesChannel);
    };
  }, [fetchData]);

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

  // Get company name
  const getCompanyName = (companyId: string | null, fallbackName: string | null) => {
    if (companyId && companyMap[companyId]) {
      return companyMap[companyId].name;
    }
    return fallbackName || "Unknown Company";
  };

  // Count follow-ups sent to a person (outreach logs with action = 'follow_up_sent')
  const getFollowUpCount = (personId: string): number => {
    return outreachLogs.filter(
      (log) => log.person_id === personId && log.action === "follow_up_sent"
    ).length;
  };

  // Get the date when a person's connection was marked as accepted
  const getAcceptedDate = (personId: string): string | null => {
    const acceptedLog = outreachLogs.find(
      (log) => log.person_id === personId && log.outcome === "accepted"
    );
    return acceptedLog?.updated_at || null;
  };

  // Get effective profile for a person (manual override or auto-match)
  const getEffectiveProfile = (person: Person): { profile: Profile; matchedRole: string; isOverride: boolean } | null => {
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
    const match = findProfileForTitle(person.title, profiles);
    return match ? { ...match, isOverride: false } : null;
  };

  // Get the right follow-up template based on sequence number
  const getFollowUpTemplate = (profile: Profile, sequenceNumber: number): Template | null => {
    // Find follow_up template with matching sequence_number and is_current
    const template = profile.message_templates.find(
      (t) => t.type === "follow_up" && t.is_current && t.sequence_number === sequenceNumber
    );
    if (template) return template;

    // Fallback: find any current follow_up template with the highest sequence_number <= needed
    const fallbackTemplates = profile.message_templates
      .filter((t) => t.type === "follow_up" && t.is_current && (t.sequence_number ?? 0) <= sequenceNumber)
      .sort((a, b) => (b.sequence_number ?? 0) - (a.sequence_number ?? 0));

    return fallbackTemplates[0] || null;
  };

  const aiPopulateSingle = async (person: Person): Promise<boolean> => {
    const match = getEffectiveProfile(person);
    if (!match) return false;

    const { profile } = match;
    const followUpCount = getFollowUpCount(person.id);
    const nextFollowUpNumber = followUpCount + 1;

    const template = getFollowUpTemplate(profile, nextFollowUpNumber);
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
          maxChars: MAX_CHARS,
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

  const populateMessage = (person: Person) => {
    const match = getEffectiveProfile(person);
    if (!match) {
      alert(`No profile found for title: "${person.title}"`);
      return;
    }

    const { profile } = match;
    const followUpCount = getFollowUpCount(person.id);
    const nextFollowUpNumber = followUpCount + 1;

    const template = getFollowUpTemplate(profile, nextFollowUpNumber);
    if (!template) {
      alert(`No follow-up template #${nextFollowUpNumber} for profile with roles: ${profile.roles.join(", ")}`);
      return;
    }

    // Use raw template content without AI personalization
    setMessages((prev) => ({ ...prev, [person.id]: template.content }));
    setTemplateIds((prev) => ({ ...prev, [person.id]: template.id }));
  };

  const aiPopulate = async (person: Person) => {
    const match = getEffectiveProfile(person);
    if (!match) {
      alert(`No profile found for title: "${person.title}"`);
      return;
    }

    const { profile } = match;
    const followUpCount = getFollowUpCount(person.id);
    const nextFollowUpNumber = followUpCount + 1;

    const template = getFollowUpTemplate(profile, nextFollowUpNumber);
    if (!template) {
      alert(`No follow-up template #${nextFollowUpNumber} for profile with roles: ${profile.roles.join(", ")}`);
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
    // Filter to people who have a matching profile and template
    const eligiblePeople = companyPeople.filter((person) => {
      const match = getEffectiveProfile(person);
      if (!match) return false;
      const followUpCount = getFollowUpCount(person.id);
      const template = getFollowUpTemplate(match.profile, followUpCount + 1);
      return !!template;
    });

    if (eligiblePeople.length === 0) {
      alert("No eligible people to populate (missing profiles or follow-up templates)");
      return;
    }

    setAiLoadingCompanies((prev) => new Set(prev).add(companyId));
    setAiLoadingIds((prev) => {
      const next = new Set(prev);
      eligiblePeople.forEach((p) => next.add(p.id));
      return next;
    });

    await Promise.all(eligiblePeople.map((person) => aiPopulateSingle(person)));

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
      if (shouldCopy) {
        await navigator.clipboard.writeText(message);
      }

      // Create a message entry so it appears in Conversations tab
      await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "",
        },
        body: JSON.stringify({
          person_id: person.id,
          type: "sales_navigator",
          direction: "sent",
          content: message,
        }),
      });

      // Also create outreach log for tracking follow-up count
      await fetch("/api/outreach-logs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "",
        },
        body: JSON.stringify({
          person_id: person.id,
          action: "follow_up_sent",
          template_id: templateIds[person.id] || null,
          details: {
            message_content: message,
            message_type: "follow_up",
          },
        }),
      });

      // Refresh outreach logs to update follow-up counts
      const logsRes = await fetch("/api/outreach-logs", {
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "" },
      });
      if (logsRes.ok) {
        setOutreachLogs(await logsRes.json());
      }

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

  // Filter people by selected profile
  let filteredPeople = selectedProfileFilter === "all"
    ? people
    : people.filter((person) => {
        const match = getEffectiveProfile(person);
        return match && match.profile.id === selectedProfileFilter;
      });

  // Sort people by accepted date
  filteredPeople = [...filteredPeople].sort((a, b) => {
    const dateA = getAcceptedDate(a.id);
    const dateB = getAcceptedDate(b.id);

    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;

    const timeA = new Date(dateA).getTime();
    const timeB = new Date(dateB).getTime();

    return sortBy === "newest" ? timeB - timeA : timeA - timeB;
  });

  // Group filtered people by company
  const filteredGroupedByCompany = filteredPeople.reduce((acc, person) => {
    const companyKey = person.company_id || "no-company";
    if (!acc[companyKey]) {
      acc[companyKey] = [];
    }
    acc[companyKey].push(person);
    return acc;
  }, {} as Record<string, Person[]>);

  const companyIds = Object.keys(filteredGroupedByCompany);

  const sortedCompanyIds = companyIds.sort((a, b) => {
    const nameA = getCompanyName(a === "no-company" ? null : a, filteredGroupedByCompany[a][0]?.company_name);
    const nameB = getCompanyName(b === "no-company" ? null : b, filteredGroupedByCompany[b][0]?.company_name);
    return nameA.localeCompare(nameB);
  });

  if (people.length === 0) {
    return (
      <div className="sketch-empty">
        No people needing follow-ups. People with accepted connections will appear here.
      </div>
    );
  }

  if (sortedCompanyIds.length === 0 && selectedProfileFilter !== "all") {
    return (
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">Filter by Profile:</span>
            <select
              className="sketch-select text-sm"
              value={selectedProfileFilter}
              onChange={(e) => setSelectedProfileFilter(e.target.value)}
            >
              <option value="all">All Profiles ({people.length})</option>
              {profiles.map((profile) => {
                const count = people.filter((p) => {
                  const match = getEffectiveProfile(p);
                  return match && match.profile.id === profile.id;
                }).length;
                return (
                  <option key={profile.id} value={profile.id}>
                    {profile.roles.join(", ")} ({count})
                  </option>
                );
              })}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">Sort by:</span>
            <select
              className="sketch-select text-sm"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "newest" | "oldest")}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>
        <div className="sketch-empty">
          No people matching the selected profile filter.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">Filter by Profile:</span>
          <select
            className="sketch-select text-sm"
            value={selectedProfileFilter}
            onChange={(e) => setSelectedProfileFilter(e.target.value)}
          >
            <option value="all">All Profiles ({people.length})</option>
            {profiles.map((profile) => {
              const count = people.filter((p) => {
                const match = getEffectiveProfile(p);
                return match && match.profile.id === profile.id;
              }).length;
              return (
                <option key={profile.id} value={profile.id}>
                  {profile.roles.join(", ")} ({count})
                </option>
              );
            })}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">Sort by:</span>
          <select
            className="sketch-select text-sm"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "newest" | "oldest")}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
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
        <div className="text-sm text-gray-600">
          Showing {filteredPeople.length} of {people.length} people
        </div>
      </div>

      {sortedCompanyIds.map((companyId) => {
        const companyPeople = filteredGroupedByCompany[companyId];
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
                  ^
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
                {aiLoadingCompanies.has(companyId) ? "AI Generating..." : "AI Apply All"}
              </button>
            </div>
            {!isCollapsed && (
              <div className="space-y-4 mt-3">
                {companyPeople.map((person) => {
                  const profileMatch = getEffectiveProfile(person);
                  const matchedRole = profileMatch?.matchedRole;
                  const matchingProfile = profileMatch?.profile;
                  const isOverride = profileMatch?.isOverride || false;

                  const followUpCount = getFollowUpCount(person.id);
                  const nextFollowUpNumber = followUpCount + 1;
                  const acceptedDate = getAcceptedDate(person.id);

                  const hasFollowUpTemplate = matchingProfile
                    ? !!getFollowUpTemplate(matchingProfile, nextFollowUpNumber)
                    : false;

                  let statusMessage = "";
                  if (!matchingProfile) {
                    statusMessage = `No profile for title: ${person.title || "No title"}`;
                  } else if (!hasFollowUpTemplate) {
                    statusMessage = `No follow-up template #${nextFollowUpNumber} for: ${matchingProfile.roles.join(", ")}`;
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
                          <div className="font-bold flex items-center gap-2">
                            {person.name}
                            <span className="sketch-badge sketch-badge-accepted text-xs">
                              Follow-up #{nextFollowUpNumber}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 flex items-center flex-wrap gap-1">
                            {person.title || "No title"}
                            <div className="relative inline-block" ref={isDropdownOpen ? dropdownRef : undefined}>
                              <button
                                onClick={() => setProfileDropdownOpen(isDropdownOpen ? null : person.id)}
                                className={`ml-2 sketch-badge text-xs cursor-pointer hover:opacity-80 ${
                                  hasFollowUpTemplate ? "sketch-badge-accepted" : ""
                                } ${isOverride ? "ring-2 ring-blue-400" : ""}`}
                                title="Click to change profile"
                              >
                                {matchedRole || "Select profile"}
                                <span className="ml-1">^</span>
                              </button>
                              {isDropdownOpen && (
                                <div className="absolute left-0 top-full mt-1 bg-white border-2 border-black rounded shadow-lg z-[100] min-w-48 max-h-64 overflow-y-auto">
                                  {profiles.map((profile) => {
                                    const isSelected = matchingProfile?.id === profile.id;
                                    const profileHasTemplate = !!getFollowUpTemplate(profile, nextFollowUpNumber);
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
                                        {isSelected && <span>check</span>}
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
                          {acceptedDate && (
                            <div className="text-xs text-gray-500 mt-1">
                              Accepted: {new Date(acceptedDate).toLocaleString()}
                            </div>
                          )}
                          {statusMessage && (
                            <div className="text-xs text-red-600 mt-1">{statusMessage}</div>
                          )}
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <button
                            className="sketch-btn text-xs"
                            onClick={() => populateMessage(person)}
                            disabled={!hasFollowUpTemplate}
                            title={hasFollowUpTemplate ? "Use template without AI" : statusMessage}
                          >
                            Populate
                          </button>
                          <button
                            className="sketch-btn sketch-btn-primary text-xs"
                            onClick={() => aiPopulate(person)}
                            disabled={!hasFollowUpTemplate || aiLoadingIds.has(person.id)}
                            title={hasFollowUpTemplate ? "AI personalized follow-up" : statusMessage}
                          >
                            {aiLoadingIds.has(person.id) ? "AI..." : "AI Apply"}
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
                        placeholder="AI personalization note (e.g., 'mention their recent post', 'reference our previous conversation')"
                        value={personalizationNotes[person.id] || ""}
                        onChange={(e) =>
                          setPersonalizationNotes((prev) => ({ ...prev, [person.id]: e.target.value }))
                        }
                      />
                      {/* Message textarea */}
                      <textarea
                        className="sketch-textarea w-full"
                        rows={4}
                        placeholder="Follow-up message... Click 'AI Apply' to generate personalized follow-up"
                        value={messages[person.id] || ""}
                        onChange={(e) =>
                          setMessages((prev) => ({ ...prev, [person.id]: e.target.value }))
                        }
                      />
                      {messages[person.id] && (
                        <div className={`text-xs mt-1 ${
                          messages[person.id].length > MAX_CHARS ? "text-red-600" : "text-gray-500"
                        }`}>
                          {messages[person.id].length} / {MAX_CHARS} chars
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
