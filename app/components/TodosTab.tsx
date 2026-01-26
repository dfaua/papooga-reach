"use client";

import { useEffect, useState, useCallback } from "react";
import { supabaseBrowser } from "../lib/supabase/browser-client";

interface Todo {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  due_date: string | null;
  priority: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string | null;
}

interface Person {
  id: string;
  name: string;
}

interface Company {
  id: string;
  name: string;
}

export function TodosTab() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);
  const [newTodoModal, setNewTodoModal] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formPriority, setFormPriority] = useState("medium");
  const [formEntityType, setFormEntityType] = useState<string>("");
  const [formEntityId, setFormEntityId] = useState<string>("");

  const fetchData = useCallback(async () => {
    try {
      const [todosRes, peopleRes, companiesRes] = await Promise.all([
        fetch("/api/todos", {
          headers: { "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "" },
        }),
        fetch("/api/people", {
          headers: { "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "" },
        }),
        fetch("/api/companies", {
          headers: { "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "" },
        }),
      ]);

      if (todosRes.ok) setTodos(await todosRes.json());
      if (peopleRes.ok) setPeople(await peopleRes.json());
      if (companiesRes.ok) setCompanies(await companiesRes.json());
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime subscription for todos
  useEffect(() => {
    const channel = supabaseBrowser
      .channel("todos-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "todos" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setTodos((prev) => [payload.new as Todo, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setTodos((prev) =>
              prev.map((t) =>
                t.id === (payload.new as Todo).id ? (payload.new as Todo) : t
              )
            );
          } else if (payload.eventType === "DELETE") {
            setTodos((prev) =>
              prev.filter((t) => t.id !== (payload.old as Todo).id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, []);

  const resetForm = () => {
    setFormTitle("");
    setFormDescription("");
    setFormDueDate("");
    setFormPriority("medium");
    setFormEntityType("");
    setFormEntityId("");
  };

  const openNewTodoModal = () => {
    resetForm();
    setEditingTodo(null);
    setNewTodoModal(true);
  };

  const openEditModal = (todo: Todo) => {
    setFormTitle(todo.title);
    setFormDescription(todo.description || "");
    setFormDueDate(todo.due_date || "");
    setFormPriority(todo.priority);
    setFormEntityType(todo.entity_type || "");
    setFormEntityId(todo.entity_id || "");
    setEditingTodo(todo);
    setNewTodoModal(true);
  };

  const saveTodo = async () => {
    if (!formTitle.trim()) return;

    const todoData = {
      title: formTitle.trim(),
      description: formDescription.trim() || null,
      due_date: formDueDate || null,
      priority: formPriority,
      entity_type: formEntityType || null,
      entity_id: formEntityId || null,
    };

    try {
      if (editingTodo) {
        await fetch(`/api/todos/${editingTodo.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "",
          },
          body: JSON.stringify(todoData),
        });
      } else {
        await fetch("/api/todos", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "",
          },
          body: JSON.stringify(todoData),
        });
      }
    } catch (error) {
      console.error("Failed to save todo:", error);
    }

    setNewTodoModal(false);
    resetForm();
  };

  const toggleCompleted = async (todo: Todo) => {
    try {
      await fetch(`/api/todos/${todo.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "",
        },
        body: JSON.stringify({ completed: !todo.completed }),
      });
    } catch (error) {
      console.error("Failed to toggle todo:", error);
    }
  };

  const deleteTodo = async (id: string) => {
    if (!confirm("Delete this todo?")) return;

    try {
      await fetch(`/api/todos/${id}`, {
        method: "DELETE",
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "" },
      });
    } catch (error) {
      console.error("Failed to delete todo:", error);
    }
  };

  const getEntityName = (todo: Todo): string | null => {
    if (!todo.entity_type || !todo.entity_id) return null;

    if (todo.entity_type === "person") {
      const person = people.find((p) => p.id === todo.entity_id);
      return person ? `👤 ${person.name}` : null;
    }
    if (todo.entity_type === "company") {
      const company = companies.find((c) => c.id === todo.entity_id);
      return company ? `🏢 ${company.name}` : null;
    }
    return null;
  };

  const getPriorityClass = (priority: string) => {
    switch (priority) {
      case "high":
        return "sketch-badge-danger";
      case "low":
        return "sketch-badge-muted";
      default:
        return "";
    }
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date(new Date().toDateString());
  };

  const filteredTodos = todos.filter((t) => showCompleted || !t.completed);

  // Sort: incomplete first, then by due date, then by priority
  const sortedTodos = [...filteredTodos].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return (priorityOrder[a.priority as keyof typeof priorityOrder] || 1) -
           (priorityOrder[b.priority as keyof typeof priorityOrder] || 1);
  });

  if (loading) {
    return <div className="sketch-empty">Loading...</div>;
  }

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold">
              Todos ({filteredTodos.filter((t) => !t.completed).length} pending)
            </h2>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={(e) => setShowCompleted(e.target.checked)}
              />
              Show completed
            </label>
          </div>
          <button className="sketch-btn sketch-btn-primary" onClick={openNewTodoModal}>
            + Add Todo
          </button>
        </div>

        {/* Todo list */}
        {sortedTodos.length === 0 ? (
          <div className="sketch-empty">
            No todos yet. Create one to get started!
          </div>
        ) : (
          <div className="space-y-2">
            {sortedTodos.map((todo) => (
              <div
                key={todo.id}
                className={`flex items-start gap-3 p-3 border-2 border-black rounded ${
                  todo.completed ? "bg-gray-100 opacity-60" : "bg-white"
                }`}
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={todo.completed}
                  onChange={() => toggleCompleted(todo)}
                  className="mt-1 w-5 h-5 cursor-pointer"
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`font-medium ${todo.completed ? "line-through" : ""}`}
                    >
                      {todo.title}
                    </span>
                    <span className={`sketch-badge text-xs ${getPriorityClass(todo.priority)}`}>
                      {todo.priority}
                    </span>
                    {todo.due_date && (
                      <span
                        className={`text-xs ${
                          isOverdue(todo.due_date) && !todo.completed
                            ? "text-red-600 font-bold"
                            : "text-gray-500"
                        }`}
                      >
                        📅 {todo.due_date}
                      </span>
                    )}
                  </div>
                  {todo.description && (
                    <p className="text-sm text-gray-600 mt-1">{todo.description}</p>
                  )}
                  {getEntityName(todo) && (
                    <p className="text-xs text-gray-500 mt-1">{getEntityName(todo)}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    className="sketch-btn text-xs"
                    onClick={() => openEditModal(todo)}
                  >
                    Edit
                  </button>
                  <button
                    className="sketch-btn sketch-btn-danger text-xs"
                    onClick={() => deleteTodo(todo.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New/Edit Todo Modal */}
      {newTodoModal && (
        <div className="sketch-modal-overlay" onClick={() => setNewTodoModal(false)}>
          <div className="sketch-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingTodo ? "Edit Todo" : "New Todo"}</h2>

            <div className="space-y-4 mt-4">
              <div>
                <label className="block text-sm font-bold mb-1">Title *</label>
                <input
                  type="text"
                  className="sketch-input w-full"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="What needs to be done?"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-1">Description</label>
                <textarea
                  className="sketch-textarea w-full"
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Optional details..."
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-bold mb-1">Due Date</label>
                  <input
                    type="date"
                    className="sketch-input w-full"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                  />
                </div>

                <div className="flex-1">
                  <label className="block text-sm font-bold mb-1">Priority</label>
                  <select
                    className="sketch-select w-full"
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value)}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-1">Link to</label>
                <div className="flex gap-2">
                  <select
                    className="sketch-select"
                    value={formEntityType}
                    onChange={(e) => {
                      setFormEntityType(e.target.value);
                      setFormEntityId("");
                    }}
                  >
                    <option value="">No link</option>
                    <option value="person">Person</option>
                    <option value="company">Company</option>
                  </select>

                  {formEntityType === "person" && (
                    <select
                      className="sketch-select flex-1"
                      value={formEntityId}
                      onChange={(e) => setFormEntityId(e.target.value)}
                    >
                      <option value="">Select person...</option>
                      {people.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  )}

                  {formEntityType === "company" && (
                    <select
                      className="sketch-select flex-1"
                      value={formEntityId}
                      onChange={(e) => setFormEntityId(e.target.value)}
                    >
                      <option value="">Select company...</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                className="sketch-btn"
                onClick={() => setNewTodoModal(false)}
              >
                Cancel
              </button>
              <button
                className="sketch-btn sketch-btn-primary"
                onClick={saveTodo}
                disabled={!formTitle.trim()}
              >
                {editingTodo ? "Save" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
