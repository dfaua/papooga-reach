"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabaseBrowser } from "../lib/supabase/browser-client";

interface Company {
  id: string;
  linkedin_url: string;
  name: string;
  industry: string | null;
  employee_count: string | null;
  description: string | null;
  website: string | null;
  location: string | null;
  revenue_range: string | null;
  is_contacted: boolean | null;
  created_at: string | null;
  stars: number | null;
  notes: string | null;
}

// Hand-drawn star component
function Star({ filled, onClick }: { filled: boolean; onClick: () => void }) {
  return (
    <svg
      onClick={onClick}
      className="cursor-pointer transition-transform hover:scale-110"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      style={{ transform: `rotate(${filled ? -2 : 2}deg)` }}
    >
      <path
        d="M12 2 L14.5 8.5 L21.5 9 L16 14 L17.5 21 L12 17.5 L6.5 21 L8 14 L2.5 9 L9.5 8.5 Z"
        fill={filled ? "#fbbf24" : "none"}
        stroke="#000"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: filled ? "none" : "2,1",
        }}
      />
    </svg>
  );
}

type SortField = "name" | "industry" | "employee_count" | "location" | "revenue_range" | "website";
type SortDirection = "asc" | "desc";

export function CompaniesTable() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<{
    id: string;
    field: keyof Company;
  } | null>(null);
  const [editValue, setEditValue] = useState("");

  // Filtering state - which column is being filtered
  const [filterColumn, setFilterColumn] = useState<SortField | null>(null);
  const [filters, setFilters] = useState<Partial<Record<SortField, string>>>({});

  // Sorting state
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Notes modal state
  const [notesModal, setNotesModal] = useState<Company | null>(null);
  const [notesValue, setNotesValue] = useState("");

  // Todo modal state
  const [todoModal, setTodoModal] = useState<Company | null>(null);
  const [todoTitle, setTodoTitle] = useState("");
  const [todoDueDate, setTodoDueDate] = useState("");
  const [todoPriority, setTodoPriority] = useState("medium");

  const fetchCompanies = useCallback(async () => {
    try {
      const res = await fetch("/api/companies", {
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "" },
      });
      if (res.ok) {
        const data = await res.json();
        setCompanies(data);
      }
    } catch (error) {
      console.error("Failed to fetch companies:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabaseBrowser
      .channel("companies-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "companies" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setCompanies((prev) => [payload.new as Company, ...prev]);
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

  // Filter and sort companies
  const filteredAndSortedCompanies = useMemo(() => {
    let result = [...companies];

    // Apply filters
    Object.entries(filters).forEach(([field, value]) => {
      if (value) {
        result = result.filter((c) => {
          const fieldValue = c[field as keyof Company];
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
  }, [companies, filters, sortField, sortDirection]);

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

  const startEdit = (company: Company, field: keyof Company) => {
    setEditingCell({ id: company.id, field });
    setEditValue((company[field] as string) || "");
  };

  const saveEdit = async () => {
    if (!editingCell) return;

    try {
      const res = await fetch(`/api/companies/${editingCell.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "",
        },
        body: JSON.stringify({ [editingCell.field]: editValue }),
      });

      if (res.ok) {
        setCompanies((prev) =>
          prev.map((c) =>
            c.id === editingCell.id ? { ...c, [editingCell.field]: editValue } : c
          )
        );
      }
    } catch (error) {
      console.error("Failed to update company:", error);
    }

    setEditingCell(null);
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const deleteCompany = async (id: string) => {
    if (!confirm("Delete this company?")) return;

    try {
      const res = await fetch(`/api/companies/${id}`, {
        method: "DELETE",
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "" },
      });

      if (res.ok) {
        setCompanies((prev) => prev.filter((c) => c.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete company:", error);
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
          entity_type: "company",
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

  const toggleContacted = async (company: Company) => {
    const newValue = !company.is_contacted;
    try {
      const res = await fetch(`/api/companies/${company.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "",
        },
        body: JSON.stringify({ is_contacted: newValue }),
      });

      if (res.ok) {
        setCompanies((prev) =>
          prev.map((c) =>
            c.id === company.id ? { ...c, is_contacted: newValue } : c
          )
        );
      }
    } catch (error) {
      console.error("Failed to update company:", error);
    }
  };

  const updateStars = async (company: Company, starIndex: number) => {
    // Clicking the same star that's already filled toggles it off
    // Otherwise set to that star level
    const currentStars = company.stars || 0;
    const newStars = currentStars === starIndex ? starIndex - 1 : starIndex;

    try {
      const res = await fetch(`/api/companies/${company.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "",
        },
        body: JSON.stringify({ stars: newStars }),
      });

      if (res.ok) {
        setCompanies((prev) =>
          prev.map((c) =>
            c.id === company.id ? { ...c, stars: newStars } : c
          )
        );
      }
    } catch (error) {
      console.error("Failed to update stars:", error);
    }
  };

  const saveNotes = async () => {
    if (!notesModal) return;

    try {
      const res = await fetch(`/api/companies/${notesModal.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "",
        },
        body: JSON.stringify({ notes: notesValue }),
      });

      if (res.ok) {
        setCompanies((prev) =>
          prev.map((c) =>
            c.id === notesModal.id ? { ...c, notes: notesValue } : c
          )
        );
      }
    } catch (error) {
      console.error("Failed to save notes:", error);
    }

    setNotesModal(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      saveEdit();
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  };

  const renderCell = (company: Company, field: keyof Company) => {
    const isEditing =
      editingCell?.id === company.id && editingCell?.field === field;
    const value = company[field];

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
        onClick={() => startEdit(company, field)}
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

  if (companies.length === 0) {
    return (
      <div className="sketch-empty">
        No companies saved yet. Use the Chrome extension to save companies from
        LinkedIn Sales Navigator.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      {Object.values(filters).some((f) => f) && (
        <div className="mb-2 text-sm text-gray-600">
          Showing {filteredAndSortedCompanies.length} of {companies.length} companies
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
            <th style={{ width: "60px" }}>Fav</th>
            <th>{renderColumnHeader("name", "Name")}</th>
            <th>{renderColumnHeader("industry", "Industry")}</th>
            <th>{renderColumnHeader("employee_count", "Size")}</th>
            <th>{renderColumnHeader("revenue_range", "Revenue")}</th>
            <th>{renderColumnHeader("location", "Location")}</th>
            <th>{renderColumnHeader("website", "Website")}</th>
            <th>Notes</th>
            <th>Contacted</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredAndSortedCompanies.map((company) => (
            <tr key={company.id}>
              <td>
                <div className="flex gap-0.5">
                  <Star
                    filled={(company.stars || 0) >= 1}
                    onClick={() => updateStars(company, 1)}
                  />
                  <Star
                    filled={(company.stars || 0) >= 2}
                    onClick={() => updateStars(company, 2)}
                  />
                </div>
              </td>
              <td>
                <div className="flex flex-col gap-1">
                  {renderCell(company, "name")}
                  <a
                    href={company.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sketch-link text-xs"
                  >
                    LinkedIn &rarr;
                  </a>
                </div>
              </td>
              <td>{renderCell(company, "industry")}</td>
              <td>{renderCell(company, "employee_count")}</td>
              <td>{renderCell(company, "revenue_range")}</td>
              <td>{renderCell(company, "location")}</td>
              <td>
                {company.website ? (
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sketch-link"
                  >
                    {new URL(company.website).hostname}
                  </a>
                ) : (
                  <span
                    className="cursor-pointer text-gray-400"
                    onClick={() => startEdit(company, "website")}
                  >
                    -
                  </span>
                )}
              </td>
              <td>
                <button
                  className="sketch-btn text-xs"
                  onClick={() => {
                    setNotesModal(company);
                    setNotesValue(company.notes || "");
                  }}
                >
                  {company.notes ? "View" : "Add"}
                </button>
              </td>
              <td>
                <button
                  onClick={() => toggleContacted(company)}
                  className={`sketch-badge ${
                    company.is_contacted
                      ? "sketch-badge-accepted"
                      : "sketch-badge-saved"
                  }`}
                >
                  {company.is_contacted ? "Yes" : "No"}
                </button>
              </td>
              <td>
                <div className="flex gap-1">
                  <button
                    className="sketch-btn text-xs"
                    onClick={() => {
                      setTodoModal(company);
                      setTodoTitle("");
                      setTodoDueDate("");
                      setTodoPriority("medium");
                    }}
                  >
                    +Todo
                  </button>
                  <button
                    onClick={() => deleteCompany(company.id)}
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

      {/* Notes Modal */}
      {notesModal && (
        <div className="sketch-modal-overlay" onClick={() => setNotesModal(null)}>
          <div className="sketch-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Notes for {notesModal.name}</h2>
            <textarea
              className="sketch-textarea"
              value={notesValue}
              onChange={(e) => setNotesValue(e.target.value)}
              placeholder="Add notes about this company..."
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

      {/* Todo Modal */}
      {todoModal && (
        <div className="sketch-modal-overlay" onClick={() => setTodoModal(null)}>
          <div className="sketch-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add Todo for {todoModal.name}</h2>
            <div className="space-y-4 mt-4">
              <div>
                <label className="block text-sm font-bold mb-1">Title *</label>
                <input
                  type="text"
                  className="sketch-input w-full"
                  value={todoTitle}
                  onChange={(e) => setTodoTitle(e.target.value)}
                  placeholder="What needs to be done?"
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
              <button
                className="sketch-btn"
                onClick={() => setTodoModal(null)}
              >
                Cancel
              </button>
              <button
                className="sketch-btn sketch-btn-primary"
                onClick={createTodo}
                disabled={!todoTitle.trim()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
