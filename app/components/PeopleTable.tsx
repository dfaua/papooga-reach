"use client";

import { useEffect, useState, useCallback, useRef, useMemo, memo } from "react";
import { supabaseBrowser } from "../lib/supabase/browser-client";

interface Person {
  id: string;
  linkedin_url: string;
  linkedin_profile_url: string | null;
  name: string;
  title: string | null;
  company_id: string | null;
  company_name: string | null;
  company_linkedin_url: string | null;
  status: string | null;
  notes: string | null;
  created_at: string | null;
  warm_intro_referrer: string | null;
  connections_count: number | null;
  followers_count: number | null;
  // Apollo enrichment fields
  email: string | null;
  email_status: string | null;
  phone_number: string | null;
  photo_url: string | null;
  headline: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  seniority: string | null;
  twitter_url: string | null;
  github_url: string | null;
  facebook_url: string | null;
  departments: string[] | null;
  apollo_id: string | null;
  apollo_enriched_at: string | null;
  // ZeroBounce verification fields
  email_zerobounce_status: string | null;
  email_zerobounce_sub_status: string | null;
  email_zerobounce_at: string | null;
}

interface Company {
  id: string;
  name: string;
  linkedin_url: string;
}

const STATUSES = ["saved", "requested", "accepted", "messaged", "replied", "asked_for_intro"];

// Memoized company cell component to avoid re-rendering entire table
const CompanyCell = memo(function CompanyCell({
  personId,
  companyId,
  companyName,
  companies,
  onLinkCompany,
}: {
  personId: string;
  companyId: string | null;
  companyName: string | null;
  companies: Company[];
  onLinkCompany: (personId: string, company: Company) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isEditing) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsEditing(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isEditing]);

  const filteredCompanies = useMemo(() => {
    const searchLower = searchValue.toLowerCase();
    return companies.filter((c) => c.name.toLowerCase().includes(searchLower));
  }, [searchValue, companies]);

  const handleSelect = (company: Company) => {
    onLinkCompany(personId, company);
    setIsEditing(false);
    setSearchValue("");
  };

  if (isEditing) {
    return (
      <div className="sketch-autocomplete" ref={dropdownRef}>
        <input
          type="text"
          className="sketch-input"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Search companies..."
          autoFocus
        />
        {filteredCompanies.length > 0 && (
          <div className="sketch-autocomplete-dropdown">
            {filteredCompanies.slice(0, 10).map((c) => (
              <div
                key={c.id}
                className="sketch-autocomplete-option"
                onClick={() => handleSelect(c)}
              >
                {c.name}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <span
      className={`cursor-pointer ${
        !companyName
          ? "text-gray-400"
          : !companyId
          ? "text-orange-500"
          : ""
      }`}
      onClick={() => {
        setSearchValue("");
        setIsEditing(true);
      }}
      title={companyId ? "Click to change company" : "Click to link company"}
    >
      {companyName || "Link company..."}
    </span>
  );
});

type SortField = "name" | "title" | "company_name" | "status";
type SortDirection = "asc" | "desc";

export function PeopleTable() {
  const [people, setPeople] = useState<Person[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<{
    id: string;
    field: keyof Person;
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [notesModal, setNotesModal] = useState<Person | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [introModal, setIntroModal] = useState<Person | null>(null);
  const [introReferrer, setIntroReferrer] = useState("");

  // Todo modal state
  const [todoModal, setTodoModal] = useState<Person | null>(null);
  const [todoTitle, setTodoTitle] = useState("");
  const [todoDueDate, setTodoDueDate] = useState("");
  const [todoPriority, setTodoPriority] = useState("medium");

  // Apollo enrichment state
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [apolloModal, setApolloModal] = useState<Person | null>(null);

  // ZeroBounce verification state
  const [verifyingEmail, setVerifyingEmail] = useState(false);

  // Filtering state
  const [filterColumn, setFilterColumn] = useState<SortField | null>(null);
  const [filters, setFilters] = useState<Partial<Record<SortField, string>>>({});

  // Sorting state
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Pagination state
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const fetchData = useCallback(async () => {
    try {
      const [peopleRes, companiesRes] = await Promise.all([
        fetch("/api/people", {
          headers: { "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "" },
        }),
        fetch("/api/companies", {
          headers: { "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "" },
        }),
      ]);

      if (peopleRes.ok) {
        setPeople(await peopleRes.json());
      }
      if (companiesRes.ok) {
        setCompanies(await companiesRes.json());
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
      .channel("people-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "people" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setPeople((prev) => [payload.new as Person, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setPeople((prev) =>
              prev.map((p) =>
                p.id === (payload.new as Person).id ? (payload.new as Person) : p
              )
            );
          } else if (payload.eventType === "DELETE") {
            setPeople((prev) =>
              prev.filter((p) => p.id !== (payload.old as Person).id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, []);

  // Realtime subscription for companies
  useEffect(() => {
    const channel = supabaseBrowser
      .channel("people-companies-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "companies" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newCompany = payload.new as Company;
            setCompanies((prev) => {
              if (prev.some((c) => c.id === newCompany.id)) return prev;
              return [newCompany, ...prev];
            });
          } else if (payload.eventType === "UPDATE") {
            setCompanies((prev) =>
              prev.map((c) =>
                c.id === (payload.new as Company).id ? (payload.new as Company) : c
              )
            );
          } else if (payload.eventType === "DELETE") {
            setCompanies((prev) =>
              prev.filter((c) => c.id !== (payload.old as Company).id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, []);


  // Filter and sort people
  const filteredAndSortedPeople = useMemo(() => {
    let result = [...people];

    // Apply filters
    Object.entries(filters).forEach(([field, value]) => {
      if (value) {
        result = result.filter((p) => {
          const fieldValue = p[field as keyof Person];
          if (fieldValue === null) return false;
          return String(fieldValue).toLowerCase().includes(value.toLowerCase());
        });
      }
    });

    // Apply sorting
    if (sortField) {
      result.sort((a, b) => {
        const aVal = a[sortField] || "";
        const bVal = b[sortField] || "";
        const comparison = String(aVal).localeCompare(String(bVal));
        return sortDirection === "asc" ? comparison : -comparison;
      });
    }

    return result;
  }, [people, filters, sortField, sortDirection]);

  const handleColumnClick = (field: SortField) => {
    if (filterColumn === field) {
      // Already filtering this column, toggle sort
      if (sortField === field) {
        setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDirection("asc");
      }
    } else {
      // Start filtering this column
      setFilterColumn(field);
    }
  };

  const handleFilterChange = (field: SortField, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setPage(0); // Reset to first page when filtering
  };

  const handleFilterBlur = () => {
    setFilterColumn(null);
  };

  const handleFilterKeyDown = (e: React.KeyboardEvent, field: SortField) => {
    if (e.key === "Escape") {
      setFilterColumn(null);
      setFilters((prev) => ({ ...prev, [field]: "" }));
    } else if (e.key === "Enter") {
      setFilterColumn(null);
    }
  };

  const startEdit = (person: Person, field: keyof Person) => {
    setEditingCell({ id: person.id, field });
    setEditValue((person[field] as string) || "");
  };

  const saveEdit = async () => {
    if (!editingCell) return;

    // Handle numeric fields
    const numericFields = ["connections_count", "followers_count"];
    let valueToSave: string | number | null = editValue;

    if (numericFields.includes(editingCell.field)) {
      if (editValue === "" || editValue === null) {
        valueToSave = null;
      } else {
        const parsed = parseInt(editValue.replace(/,/g, ""), 10);
        valueToSave = isNaN(parsed) ? null : parsed;
      }
    }

    try {
      const res = await fetch(`/api/people/${editingCell.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "",
        },
        body: JSON.stringify({ [editingCell.field]: valueToSave }),
      });

      if (res.ok) {
        setPeople((prev) =>
          prev.map((p) =>
            p.id === editingCell.id ? { ...p, [editingCell.field]: valueToSave } : p
          )
        );
      }
    } catch (error) {
      console.error("Failed to update person:", error);
    }

    setEditingCell(null);
  };

  const updateStatus = async (person: Person, status: string) => {
    // If selecting "asked_for_intro", show modal to get referrer info
    if (status === "asked_for_intro") {
      setIntroReferrer(person.warm_intro_referrer || "");
      setIntroModal(person);
      return;
    }

    try {
      const res = await fetch(`/api/people/${person.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "",
        },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        setPeople((prev) =>
          prev.map((p) => (p.id === person.id ? { ...p, status } : p))
        );
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  const saveIntroReferrer = async () => {
    if (!introModal) return;

    try {
      const res = await fetch(`/api/people/${introModal.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "",
        },
        body: JSON.stringify({
          status: "asked_for_intro",
          warm_intro_referrer: introReferrer
        }),
      });

      if (res.ok) {
        setPeople((prev) =>
          prev.map((p) =>
            p.id === introModal.id
              ? { ...p, status: "asked_for_intro", warm_intro_referrer: introReferrer }
              : p
          )
        );
      }
    } catch (error) {
      console.error("Failed to save intro referrer:", error);
    }

    setIntroModal(null);
  };

  const linkCompany = useCallback(async (personId: string, company: Company) => {
    try {
      const res = await fetch(`/api/people/${personId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "",
        },
        body: JSON.stringify({
          company_id: company.id,
          company_name: company.name,
          company_linkedin_url: company.linkedin_url,
        }),
      });

      if (res.ok) {
        setPeople((prev) =>
          prev.map((p) =>
            p.id === personId
              ? {
                  ...p,
                  company_id: company.id,
                  company_name: company.name,
                  company_linkedin_url: company.linkedin_url,
                }
              : p
          )
        );
      }
    } catch (error) {
      console.error("Failed to link company:", error);
    }
  }, []);

  const saveNotes = async () => {
    if (!notesModal) return;

    try {
      const res = await fetch(`/api/people/${notesModal.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "",
        },
        body: JSON.stringify({ notes: notesValue }),
      });

      if (res.ok) {
        setPeople((prev) =>
          prev.map((p) =>
            p.id === notesModal.id ? { ...p, notes: notesValue } : p
          )
        );
      }
    } catch (error) {
      console.error("Failed to save notes:", error);
    }

    setNotesModal(null);
  };

  const deletePerson = async (id: string) => {
    if (!confirm("Delete this person?")) return;

    try {
      const res = await fetch(`/api/people/${id}`, {
        method: "DELETE",
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "" },
      });

      if (res.ok) {
        setPeople((prev) => prev.filter((p) => p.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete person:", error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      saveEdit();
    } else if (e.key === "Escape") {
      setEditingCell(null);
    }
  };

  const createTodo = async () => {
    if (!todoModal || !todoTitle.trim()) return;

    try {
      await fetch("/api/todos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "",
        },
        body: JSON.stringify({
          title: todoTitle.trim(),
          due_date: todoDueDate || null,
          priority: todoPriority,
          entity_type: "person",
          entity_id: todoModal.id,
        }),
      });

      setTodoModal(null);
      setTodoTitle("");
      setTodoDueDate("");
      setTodoPriority("medium");
    } catch (error) {
      console.error("Failed to create todo:", error);
    }
  };

  const enrichWithApollo = async (person: Person) => {
    setEnrichingId(person.id);

    try {
      const res = await fetch("/api/apollo/enrich-person", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "",
        },
        body: JSON.stringify({ personId: person.id }),
      });

      const result = await res.json();

      if (res.ok && result.enriched) {
        // Update local state with enriched data
        setPeople((prev) =>
          prev.map((p) =>
            p.id === person.id ? result.person : p
          )
        );
        // Show the enriched data modal
        setApolloModal(result.person);
      } else if (res.ok && !result.enriched) {
        alert("No match found in Apollo database");
      } else {
        alert(`Error: ${result.error || "Failed to enrich"}`);
      }
    } catch (error) {
      console.error("Failed to enrich with Apollo:", error);
      alert("Failed to enrich with Apollo");
    } finally {
      setEnrichingId(null);
    }
  };

  const verifyEmailWithZeroBounce = async (person: Person) => {
    if (!person.email) return;

    setVerifyingEmail(true);

    try {
      const res = await fetch("/api/zerobounce/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "",
        },
        body: JSON.stringify({ personId: person.id, email: person.email }),
      });

      const result = await res.json();

      if (res.ok && result.verified) {
        // Update local state
        const updatedPerson = result.person;
        setPeople((prev) =>
          prev.map((p) => (p.id === person.id ? updatedPerson : p))
        );
        // Update the modal with the new data
        setApolloModal(updatedPerson);
      } else {
        alert(`Error: ${result.error || "Failed to verify"}`);
      }
    } catch (error) {
      console.error("Failed to verify email:", error);
      alert("Failed to verify email");
    } finally {
      setVerifyingEmail(false);
    }
  };

  const renderCell = (person: Person, field: keyof Person) => {
    const isEditing =
      editingCell?.id === person.id && editingCell?.field === field;
    const value = person[field];

    if (isEditing) {
      return (
        <input
          type="text"
          className="sketch-input"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={saveEdit}
          onKeyDown={handleKeyDown}
          autoFocus
        />
      );
    }

    const displayValue = value || "-";
    const isEmpty = !value;

    return (
      <span
        className={`cursor-pointer ${isEmpty ? "text-gray-400" : ""}`}
        onClick={() => startEdit(person, field)}
        title="Click to edit"
      >
        {displayValue}
      </span>
    );
  };

  const renderColumnHeader = (field: SortField, label: string) => {
    const isFiltering = filterColumn === field;
    const hasFilter = filters[field];
    const isSorted = sortField === field;

    if (isFiltering) {
      return (
        <input
          type="text"
          className="sketch-input sketch-filter-input"
          value={filters[field] || ""}
          onChange={(e) => handleFilterChange(field, e.target.value)}
          onBlur={handleFilterBlur}
          onKeyDown={(e) => handleFilterKeyDown(e, field)}
          placeholder={`Filter ${label}...`}
          autoFocus
        />
      );
    }

    return (
      <span
        className={`cursor-pointer select-none ${hasFilter ? "text-blue-600" : ""}`}
        onClick={() => handleColumnClick(field)}
        title="Click to filter, click again to sort"
      >
        {label}
        {hasFilter && " *"}
        {isSorted && (sortDirection === "asc" ? " ↑" : " ↓")}
      </span>
    );
  };


  if (loading) {
    return <div className="sketch-empty">Loading...</div>;
  }

  if (people.length === 0) {
    return (
      <div className="sketch-empty">
        No people saved yet. Use the Chrome extension to save leads from
        LinkedIn Sales Navigator.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        {Object.values(filters).some((f) => f) && (
          <div className="mb-2 text-sm text-gray-600">
            Showing {filteredAndSortedPeople.length} of {people.length} people
            <button
              className="ml-2 sketch-btn text-xs"
              onClick={() => setFilters({})}
            >
              Clear filters
            </button>
          </div>
        )}
        <table className="sketch-table">
          <thead>
            <tr>
              <th>{renderColumnHeader("name", "Name")}</th>
              <th>{renderColumnHeader("title", "Title")}</th>
              <th>LinkedIn</th>
              <th>{renderColumnHeader("company_name", "Company")}</th>
              <th>Network</th>
              <th>{renderColumnHeader("status", "Status")}</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedPeople.slice(page * pageSize, (page + 1) * pageSize).map((person) => (
              <tr key={person.id}>
                <td>
                  <div className="flex flex-col gap-1">
                    {renderCell(person, "name")}
                    <a
                      href={person.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="sketch-link text-xs"
                    >
                      Sales Nav &rarr;
                    </a>
                  </div>
                </td>
                <td>{renderCell(person, "title")}</td>
                <td>
                  {editingCell?.id === person.id && editingCell?.field === "linkedin_profile_url" ? (
                    <input
                      type="text"
                      className="sketch-input text-xs"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={saveEdit}
                      onKeyDown={handleKeyDown}
                      placeholder="linkedin.com/in/..."
                      autoFocus
                    />
                  ) : person.linkedin_profile_url ? (
                    <div className="flex flex-col gap-1">
                      <a
                        href={person.linkedin_profile_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="sketch-link text-xs truncate max-w-[150px]"
                        title={person.linkedin_profile_url}
                      >
                        {person.linkedin_profile_url.replace("https://www.linkedin.com/in/", "").replace("/", "")}
                      </a>
                      <span
                        className="text-xs text-gray-400 cursor-pointer hover:text-gray-600"
                        onClick={() => startEdit(person, "linkedin_profile_url" as keyof Person)}
                      >
                        edit
                      </span>
                    </div>
                  ) : (
                    <span
                      className="text-gray-400 cursor-pointer text-xs"
                      onClick={() => startEdit(person, "linkedin_profile_url" as keyof Person)}
                      title="Click to add LinkedIn URL"
                    >
                      + Add URL
                    </span>
                  )}
                </td>
                <td>
                  <CompanyCell
                    personId={person.id}
                    companyId={person.company_id}
                    companyName={person.company_name}
                    companies={companies}
                    onLinkCompany={linkCompany}
                  />
                </td>
                <td>
                  <div className="flex flex-col gap-0.5 text-xs">
                    {editingCell?.id === person.id && editingCell?.field === "connections_count" ? (
                      <input
                        type="text"
                        className="sketch-input text-xs w-16"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={handleKeyDown}
                        placeholder="0"
                        autoFocus
                      />
                    ) : (
                      <span
                        className={`cursor-pointer ${person.connections_count == null ? "text-gray-400" : "text-gray-600"}`}
                        onClick={() => {
                          setEditingCell({ id: person.id, field: "connections_count" as keyof Person });
                          setEditValue(person.connections_count?.toString() || "");
                        }}
                        title="Click to edit connections"
                      >
                        {person.connections_count != null
                          ? `${person.connections_count >= 500 ? "500+" : person.connections_count} conn`
                          : "+ conn"}
                      </span>
                    )}
                    {editingCell?.id === person.id && editingCell?.field === "followers_count" ? (
                      <input
                        type="text"
                        className="sketch-input text-xs w-16"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={handleKeyDown}
                        placeholder="0"
                        autoFocus
                      />
                    ) : (
                      <span
                        className={`cursor-pointer ${person.followers_count == null ? "text-gray-400" : "text-gray-600"}`}
                        onClick={() => {
                          setEditingCell({ id: person.id, field: "followers_count" as keyof Person });
                          setEditValue(person.followers_count?.toString() || "");
                        }}
                        title="Click to edit followers"
                      >
                        {person.followers_count != null
                          ? `${person.followers_count >= 1000 ? `${(person.followers_count / 1000).toFixed(1)}K` : person.followers_count} fol`
                          : "+ fol"}
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <div className="flex flex-col gap-1">
                    <select
                      className={`sketch-select sketch-badge-${person.status || "saved"}`}
                      value={person.status || "saved"}
                      onChange={(e) => updateStatus(person, e.target.value)}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s === "asked_for_intro" ? "Asked for Intro" : s.charAt(0).toUpperCase() + s.slice(1)}
                        </option>
                      ))}
                    </select>
                    {person.status === "asked_for_intro" && person.warm_intro_referrer && (
                      <span
                        className="text-xs text-gray-600 cursor-pointer hover:text-gray-800"
                        onClick={() => {
                          setIntroReferrer(person.warm_intro_referrer || "");
                          setIntroModal(person);
                        }}
                        title="Click to edit referrer"
                      >
                        via: {person.warm_intro_referrer}
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <button
                    className="sketch-btn"
                    onClick={() => {
                      setNotesModal(person);
                      setNotesValue(person.notes || "");
                    }}
                  >
                    {person.notes ? "View" : "Add"}
                  </button>
                </td>
                <td>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      className="sketch-btn text-xs"
                      onClick={() => setTodoModal(person)}
                    >
                      +Todo
                    </button>
                    <button
                      className={`sketch-btn text-xs ${person.apollo_enriched_at ? "sketch-btn-success" : ""}`}
                      onClick={() => person.apollo_enriched_at ? setApolloModal(person) : enrichWithApollo(person)}
                      disabled={enrichingId === person.id}
                      title={person.apollo_enriched_at ? "View Apollo data" : "Enrich with Apollo"}
                    >
                      {enrichingId === person.id ? "..." : person.apollo_enriched_at ? "Apollo" : "Enrich"}
                    </button>
                    <a
                      href={person.linkedin_profile_url || person.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="sketch-btn"
                    >
                      Open
                    </a>
                    <button
                      onClick={() => deletePerson(person.id)}
                      className="sketch-btn sketch-btn-danger"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {filteredAndSortedPeople.length > pageSize && (
          <div className="flex items-center justify-between mt-4 text-sm">
            <div className="text-gray-600">
              Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, filteredAndSortedPeople.length)} of {filteredAndSortedPeople.length}
            </div>
            <div className="flex gap-2">
              <button
                className="sketch-btn text-xs"
                onClick={() => setPage(0)}
                disabled={page === 0}
              >
                First
              </button>
              <button
                className="sketch-btn text-xs"
                onClick={() => setPage(p => p - 1)}
                disabled={page === 0}
              >
                Prev
              </button>
              <span className="px-2 py-1">
                Page {page + 1} of {Math.ceil(filteredAndSortedPeople.length / pageSize)}
              </span>
              <button
                className="sketch-btn text-xs"
                onClick={() => setPage(p => p + 1)}
                disabled={(page + 1) * pageSize >= filteredAndSortedPeople.length}
              >
                Next
              </button>
              <button
                className="sketch-btn text-xs"
                onClick={() => setPage(Math.ceil(filteredAndSortedPeople.length / pageSize) - 1)}
                disabled={(page + 1) * pageSize >= filteredAndSortedPeople.length}
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Notes Modal */}
      {notesModal && (
        <div className="sketch-modal-overlay" onClick={() => setNotesModal(null)}>
          <div className="sketch-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Notes for {notesModal.name}</h2>
            <textarea
              className="sketch-textarea"
              value={notesValue}
              onChange={(e) => setNotesValue(e.target.value)}
              placeholder="Add notes about this person..."
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="sketch-btn"
                onClick={() => setNotesModal(null)}
              >
                Cancel
              </button>
              <button
                className="sketch-btn sketch-btn-primary"
                onClick={saveNotes}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Intro Referrer Modal */}
      {introModal && (
        <div className="sketch-modal-overlay" onClick={() => setIntroModal(null)}>
          <div className="sketch-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Warm Intro for {introModal.name}</h2>
            <p className="text-sm text-gray-600 mb-4">
              Who is referring or introducing you to this person?
            </p>
            <input
              type="text"
              className="sketch-input w-full"
              value={introReferrer}
              onChange={(e) => setIntroReferrer(e.target.value)}
              placeholder="Name or LinkedIn URL of referrer..."
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="sketch-btn"
                onClick={() => setIntroModal(null)}
              >
                Cancel
              </button>
              <button
                className="sketch-btn sketch-btn-primary"
                onClick={saveIntroReferrer}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Todo Modal */}
      {todoModal && (
        <div className="sketch-modal-overlay" onClick={() => setTodoModal(null)}>
          <div className="sketch-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add Todo for {todoModal.name}</h2>
            <div className="space-y-4 mt-4">
              <div>
                <label className="block text-sm font-bold mb-1">What needs to be done? *</label>
                <input
                  type="text"
                  className="sketch-input w-full"
                  value={todoTitle}
                  onChange={(e) => setTodoTitle(e.target.value)}
                  placeholder="e.g., Follow up next week, Send case study..."
                  autoFocus
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-bold mb-1">Due Date</label>
                  <input
                    type="date"
                    className="sketch-input w-full"
                    value={todoDueDate}
                    onChange={(e) => setTodoDueDate(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-bold mb-1">Priority</label>
                  <select
                    className="sketch-select w-full"
                    value={todoPriority}
                    onChange={(e) => setTodoPriority(e.target.value)}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button className="sketch-btn" onClick={() => setTodoModal(null)}>
                Cancel
              </button>
              <button
                className="sketch-btn sketch-btn-primary"
                onClick={createTodo}
                disabled={!todoTitle.trim()}
              >
                Create Todo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apollo Data Modal */}
      {apolloModal && (
        <div className="sketch-modal-overlay" onClick={() => setApolloModal(null)}>
          <div className="sketch-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "600px" }}>
            <div className="flex items-start gap-4 mb-4">
              {apolloModal.photo_url && (
                <img
                  src={apolloModal.photo_url}
                  alt={apolloModal.name}
                  className="w-16 h-16 rounded-full object-cover"
                />
              )}
              <div>
                <h2 className="mb-1">{apolloModal.name}</h2>
                {apolloModal.headline && (
                  <p className="text-sm text-gray-600">{apolloModal.headline}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              {apolloModal.email && (
                <div className="col-span-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold">Email:</span>
                    <a href={`mailto:${apolloModal.email}`} className="sketch-link">
                      {apolloModal.email}
                    </a>
                    {apolloModal.email_status && (
                      <span className={`text-xs ${apolloModal.email_status === "verified" ? "text-green-600" : "text-gray-500"}`}>
                        (Apollo: {apolloModal.email_status})
                      </span>
                    )}
                    {apolloModal.email_zerobounce_status ? (
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        apolloModal.email_zerobounce_status === "valid"
                          ? "bg-green-100 text-green-700"
                          : apolloModal.email_zerobounce_status === "invalid"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}>
                        ZB: {apolloModal.email_zerobounce_status}
                        {apolloModal.email_zerobounce_sub_status && ` (${apolloModal.email_zerobounce_sub_status})`}
                      </span>
                    ) : (
                      <button
                        className="sketch-btn text-xs"
                        onClick={() => verifyEmailWithZeroBounce(apolloModal)}
                        disabled={verifyingEmail}
                      >
                        {verifyingEmail ? "Verifying..." : "Verify"}
                      </button>
                    )}
                  </div>
                  {apolloModal.email_zerobounce_at && (
                    <p className="text-xs text-gray-400 mt-1">
                      Verified: {new Date(apolloModal.email_zerobounce_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}

              {apolloModal.phone_number && (
                <div>
                  <span className="font-bold">Phone:</span>{" "}
                  <a href={`tel:${apolloModal.phone_number}`} className="sketch-link">
                    {apolloModal.phone_number}
                  </a>
                </div>
              )}

              {apolloModal.seniority && (
                <div>
                  <span className="font-bold">Seniority:</span> {apolloModal.seniority}
                </div>
              )}

              {(apolloModal.city || apolloModal.state || apolloModal.country) && (
                <div>
                  <span className="font-bold">Location:</span>{" "}
                  {[apolloModal.city, apolloModal.state, apolloModal.country].filter(Boolean).join(", ")}
                </div>
              )}

              {apolloModal.departments && apolloModal.departments.length > 0 && (
                <div className="col-span-2">
                  <span className="font-bold">Departments:</span> {apolloModal.departments.join(", ")}
                </div>
              )}
            </div>

            {/* Social Links */}
            <div className="flex gap-3 mt-4 pt-4 border-t">
              {apolloModal.linkedin_profile_url && (
                <a
                  href={apolloModal.linkedin_profile_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sketch-btn text-xs"
                >
                  LinkedIn
                </a>
              )}
              {apolloModal.twitter_url && (
                <a
                  href={apolloModal.twitter_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sketch-btn text-xs"
                >
                  Twitter
                </a>
              )}
              {apolloModal.github_url && (
                <a
                  href={apolloModal.github_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sketch-btn text-xs"
                >
                  GitHub
                </a>
              )}
              {apolloModal.facebook_url && (
                <a
                  href={apolloModal.facebook_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sketch-btn text-xs"
                >
                  Facebook
                </a>
              )}
            </div>

            {apolloModal.apollo_enriched_at && (
              <p className="text-xs text-gray-500 mt-4">
                Enriched: {new Date(apolloModal.apollo_enriched_at).toLocaleDateString()}
              </p>
            )}

            <div className="mt-4 flex justify-between">
              <button
                className="sketch-btn text-xs"
                onClick={() => {
                  setApolloModal(null);
                  enrichWithApollo(apolloModal);
                }}
              >
                Re-enrich
              </button>
              <button
                className="sketch-btn sketch-btn-primary"
                onClick={() => setApolloModal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
