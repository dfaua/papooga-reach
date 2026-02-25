"use client";

import { useEffect, useState, useCallback } from "react";
import { supabaseBrowser } from "../lib/supabase/browser-client";

interface Template {
  id: string;
  profile_id: string;
  name: string;
  type: "connection_note" | "message" | "inmail" | "follow_up";
  content: string;
  is_current: boolean;
  notes: string | null;
  sequence_number: number | null;
  created_at: string;
  updated_at: string;
}

interface Profile {
  id: string;
  roles: string[];
  industry: string | null;
  pain_points: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
  message_templates: Template[];
}

interface TemplateStats {
  template_id: string;
  total_sent: number;
  pending: number;
  accepted: number;
  replied: number;
  acceptance_rate: number;
  reply_rate: number;
}

const TYPES = [
  { value: "connection_note", label: "Connection Note", maxChars: 300 },
  { value: "message", label: "Message", maxChars: 8000 },
  { value: "inmail", label: "InMail", maxChars: 1900 },
  { value: "follow_up", label: "Follow-up", maxChars: 8000 },
];

export function ProfilesTable() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProfiles, setExpandedProfiles] = useState<Set<string>>(new Set());
  const [templateStats, setTemplateStats] = useState<Map<string, TemplateStats>>(new Map());

  // Profile editing
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editProfileData, setEditProfileData] = useState<Partial<Profile>>({});
  const [rolesInput, setRolesInput] = useState("");
  const [painPointsInput, setPainPointsInput] = useState("");

  // Template editing
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editTemplateData, setEditTemplateData] = useState<Partial<Template>>({});

  // Create forms
  const [showCreateProfile, setShowCreateProfile] = useState(false);
  const [newProfile, setNewProfile] = useState({ roles: "", industry: "", pain_points: "", notes: "" });
  const [creatingTemplateForProfile, setCreatingTemplateForProfile] = useState<string | null>(null);
  const [newTemplate, setNewTemplate] = useState({ name: "", type: "connection_note", content: "", notes: "", sequence_number: 1 });

  const fetchProfiles = useCallback(async () => {
    try {
      const res = await fetch("/api/profiles", {
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "" },
      });
      if (res.ok) {
        setProfiles(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch profiles:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTemplateStats = useCallback(async () => {
    try {
      const res = await fetch("/api/templates/stats", {
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "" },
      });
      if (res.ok) {
        const stats: TemplateStats[] = await res.json();
        const statsMap = new Map<string, TemplateStats>();
        for (const stat of stats) {
          statsMap.set(stat.template_id, stat);
        }
        setTemplateStats(statsMap);
      }
    } catch (error) {
      console.error("Failed to fetch template stats:", error);
    }
  }, []);

  useEffect(() => {
    fetchProfiles();
    fetchTemplateStats();
  }, [fetchProfiles, fetchTemplateStats]);

  // Realtime subscriptions
  useEffect(() => {
    const profilesChannel = supabaseBrowser
      .channel("profiles-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setProfiles((prev) => {
              const newProfile = { ...payload.new as Profile, message_templates: [] };
              if (prev.some((p) => p.id === newProfile.id)) return prev;
              return [newProfile, ...prev];
            });
          } else if (payload.eventType === "UPDATE") {
            setProfiles((prev) =>
              prev.map((p) =>
                p.id === (payload.new as Profile).id
                  ? { ...payload.new as Profile, message_templates: p.message_templates }
                  : p
              )
            );
          } else if (payload.eventType === "DELETE") {
            setProfiles((prev) =>
              prev.filter((p) => p.id !== (payload.old as Profile).id)
            );
          }
        }
      )
      .subscribe();

    const templatesChannel = supabaseBrowser
      .channel("templates-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_templates" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newTemplate = payload.new as Template;
            setProfiles((prev) =>
              prev.map((p) =>
                p.id === newTemplate.profile_id
                  ? {
                      ...p,
                      message_templates: p.message_templates.some(t => t.id === newTemplate.id)
                        ? p.message_templates
                        : [newTemplate, ...p.message_templates],
                    }
                  : p
              )
            );
          } else if (payload.eventType === "UPDATE") {
            const updatedTemplate = payload.new as Template;
            setProfiles((prev) =>
              prev.map((p) => ({
                ...p,
                message_templates: p.message_templates.map((t) =>
                  t.id === updatedTemplate.id ? updatedTemplate : t
                ),
              }))
            );
          } else if (payload.eventType === "DELETE") {
            const deletedTemplate = payload.old as Template;
            setProfiles((prev) =>
              prev.map((p) => ({
                ...p,
                message_templates: p.message_templates.filter(
                  (t) => t.id !== deletedTemplate.id
                ),
              }))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(profilesChannel);
      supabaseBrowser.removeChannel(templatesChannel);
    };
  }, []);

  const toggleExpanded = (profileId: string) => {
    setExpandedProfiles((prev) => {
      const next = new Set(prev);
      if (next.has(profileId)) next.delete(profileId);
      else next.add(profileId);
      return next;
    });
  };

  // Profile CRUD
  const createProfile = async () => {
    const roles = newProfile.roles.split(",").map((r) => r.trim()).filter((r) => r);
    const painPoints = newProfile.pain_points.split("\n").map((p) => p.trim()).filter((p) => p);

    try {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "",
        },
        body: JSON.stringify({
          roles,
          industry: newProfile.industry || null,
          pain_points: painPoints,
          notes: newProfile.notes || null,
        }),
      });

      if (res.ok) {
        setShowCreateProfile(false);
        setNewProfile({ roles: "", industry: "", pain_points: "", notes: "" });
      }
    } catch (error) {
      console.error("Failed to create profile:", error);
    }
  };

  const startEditProfile = (profile: Profile) => {
    setEditingProfileId(profile.id);
    setEditProfileData(profile);
    setRolesInput(profile.roles.join(", "));
    setPainPointsInput(profile.pain_points.join("\n"));
  };

  const cancelEditProfile = () => {
    setEditingProfileId(null);
    setEditProfileData({});
    setRolesInput("");
    setPainPointsInput("");
  };

  const saveProfile = async () => {
    if (!editingProfileId) return;

    const roles = rolesInput.split(",").map((r) => r.trim()).filter((r) => r);
    const painPoints = painPointsInput.split("\n").map((p) => p.trim()).filter((p) => p);

    try {
      const res = await fetch(`/api/profiles/${editingProfileId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "",
        },
        body: JSON.stringify({
          ...editProfileData,
          roles,
          pain_points: painPoints,
        }),
      });

      if (res.ok) {
        cancelEditProfile();
      }
    } catch (error) {
      console.error("Failed to update profile:", error);
    }
  };

  const deleteProfile = async (id: string) => {
    if (!confirm("Delete this profile and all its templates?")) return;

    try {
      await fetch(`/api/profiles/${id}`, {
        method: "DELETE",
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "" },
      });
    } catch (error) {
      console.error("Failed to delete profile:", error);
    }
  };

  // Template CRUD
  const createTemplate = async (profileId: string) => {
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "",
        },
        body: JSON.stringify({
          profile_id: profileId,
          name: newTemplate.name,
          type: newTemplate.type,
          content: newTemplate.content,
          notes: newTemplate.notes || null,
          is_current: false,
          sequence_number: newTemplate.type === "follow_up" ? newTemplate.sequence_number : null,
        }),
      });

      if (res.ok) {
        setCreatingTemplateForProfile(null);
        setNewTemplate({ name: "", type: "connection_note", content: "", notes: "", sequence_number: 1 });
      }
    } catch (error) {
      console.error("Failed to create template:", error);
    }
  };

  const startEditTemplate = (template: Template) => {
    setEditingTemplateId(template.id);
    setEditTemplateData(template);
  };

  const cancelEditTemplate = () => {
    setEditingTemplateId(null);
    setEditTemplateData({});
  };

  const saveTemplate = async () => {
    if (!editingTemplateId) return;

    try {
      const res = await fetch(`/api/templates/${editingTemplateId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "",
        },
        body: JSON.stringify({
          ...editTemplateData,
          sequence_number: editTemplateData.type === "follow_up" ? editTemplateData.sequence_number : null,
        }),
      });

      if (res.ok) {
        cancelEditTemplate();
      }
    } catch (error) {
      console.error("Failed to update template:", error);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("Delete this template?")) return;

    try {
      await fetch(`/api/templates/${id}`, {
        method: "DELETE",
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "" },
      });
    } catch (error) {
      console.error("Failed to delete template:", error);
    }
  };

  const iterateTemplate = async (template: Template) => {
    try {
      const res = await fetch(`/api/templates/${template.id}/iterate`, {
        method: "POST",
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "" },
      });

      if (res.ok) {
        const { new: newTemplate } = await res.json();
        // Add new template locally and start editing
        setProfiles((prev) =>
          prev.map((p) =>
            p.id === template.profile_id
              ? {
                  ...p,
                  message_templates: [
                    newTemplate,
                    ...p.message_templates.map((t) =>
                      t.id === template.id ? { ...t, is_current: false } : t
                    ),
                  ],
                }
              : p
          )
        );
        startEditTemplate(newTemplate);
      }
    } catch (error) {
      console.error("Failed to iterate template:", error);
    }
  };

  const toggleTemplateCurrent = async (template: Template) => {
    try {
      await fetch(`/api/templates/${template.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "",
        },
        body: JSON.stringify({ ...template, is_current: !template.is_current }),
      });
    } catch (error) {
      console.error("Failed to toggle current:", error);
    }
  };

  const getTypeInfo = (type: string) => TYPES.find((t) => t.value === type) || TYPES[0];

  const getCharCount = (content: string, type: string) => {
    const typeInfo = getTypeInfo(type);
    return { count: content.length, max: typeInfo.maxChars, isOver: content.length > typeInfo.maxChars };
  };

  if (loading) {
    return <div className="sketch-empty">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Create Profile button */}
      <div className="flex justify-end">
        <button
          className="sketch-btn sketch-btn-primary"
          onClick={() => setShowCreateProfile(true)}
        >
          + New Profile
        </button>
      </div>

      {/* Create Profile form */}
      {showCreateProfile && (
        <div className="sketch-box p-4 bg-white mb-4">
          <h3 className="font-bold mb-3">Create New Profile</h3>
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <label className="block text-xs font-bold mb-1">Roles (comma-separated)</label>
              <input
                type="text"
                className="sketch-input"
                value={newProfile.roles}
                onChange={(e) => setNewProfile({ ...newProfile, roles: e.target.value })}
                placeholder="CEO, Owner, Founder"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Industry</label>
              <input
                type="text"
                className="sketch-input"
                value={newProfile.industry}
                onChange={(e) => setNewProfile({ ...newProfile, industry: e.target.value })}
                placeholder="e.g., SaaS, Manufacturing"
              />
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-xs font-bold mb-1">Pain Points (one per line)</label>
            <textarea
              className="sketch-textarea"
              value={newProfile.pain_points}
              onChange={(e) => setNewProfile({ ...newProfile, pain_points: e.target.value })}
              placeholder="Manual supplier management&#10;Lack of visibility into supply chain&#10;Scaling operations"
              rows={4}
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs font-bold mb-1">Notes</label>
            <input
              type="text"
              className="sketch-input"
              value={newProfile.notes}
              onChange={(e) => setNewProfile({ ...newProfile, notes: e.target.value })}
              placeholder="Internal notes..."
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button className="sketch-btn" onClick={() => setShowCreateProfile(false)}>
              Cancel
            </button>
            <button
              className="sketch-btn sketch-btn-primary"
              onClick={createProfile}
              disabled={!newProfile.roles}
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Profiles list */}
      {profiles.length === 0 ? (
        <div className="sketch-empty">No profiles yet. Create one to get started.</div>
      ) : (
        <div className="space-y-4">
          {profiles.map((profile) => (
            <div key={profile.id} className="sketch-box p-4 bg-white">
              {editingProfileId === profile.id ? (
                /* Edit Profile mode */
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold mb-1">Roles</label>
                      <input
                        type="text"
                        className="sketch-input"
                        value={rolesInput}
                        onChange={(e) => setRolesInput(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1">Industry</label>
                      <input
                        type="text"
                        className="sketch-input"
                        value={editProfileData.industry || ""}
                        onChange={(e) =>
                          setEditProfileData({ ...editProfileData, industry: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Pain Points (one per line)</label>
                    <textarea
                      className="sketch-textarea"
                      value={painPointsInput}
                      onChange={(e) => setPainPointsInput(e.target.value)}
                      rows={4}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Notes</label>
                    <input
                      type="text"
                      className="sketch-input"
                      value={editProfileData.notes || ""}
                      onChange={(e) =>
                        setEditProfileData({ ...editProfileData, notes: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button className="sketch-btn" onClick={cancelEditProfile}>
                      Cancel
                    </button>
                    <button className="sketch-btn sketch-btn-primary" onClick={saveProfile}>
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                /* View Profile mode */
                <div>
                  {/* Profile header */}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {profile.roles.map((role) => (
                          <span key={role} className="sketch-badge text-xs">
                            {role}
                          </span>
                        ))}
                        {profile.industry && (
                          <span className="text-xs text-gray-500">• {profile.industry}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="sketch-btn text-xs"
                        onClick={() => startEditProfile(profile)}
                      >
                        Edit
                      </button>
                      <button
                        className="sketch-btn sketch-btn-danger text-xs"
                        onClick={() => deleteProfile(profile.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Pain points */}
                  {profile.pain_points.length > 0 && (
                    <div className="mb-3">
                      <div className="text-xs font-bold mb-1">Pain Points:</div>
                      <ul className="list-disc list-inside text-sm text-gray-700">
                        {profile.pain_points.map((point, i) => (
                          <li key={i}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {profile.notes && (
                    <div className="text-xs text-gray-500 mb-3">Note: {profile.notes}</div>
                  )}

                  {/* Templates section */}
                  <div className="border-t border-dashed border-gray-300 pt-3 mt-3">
                    <div className="flex justify-between items-center mb-2">
                      <button
                        className="text-sm font-bold flex items-center gap-1"
                        onClick={() => toggleExpanded(profile.id)}
                      >
                        <span>{expandedProfiles.has(profile.id) ? "▼" : "▶"}</span>
                        Templates ({profile.message_templates.length})
                      </button>
                      <button
                        className="sketch-btn text-xs"
                        onClick={() => setCreatingTemplateForProfile(profile.id)}
                      >
                        + Add Template
                      </button>
                    </div>

                    {/* Create template form */}
                    {creatingTemplateForProfile === profile.id && (
                      <div className="bg-gray-50 p-3 rounded mb-3 border border-dashed border-gray-300">
                        <div className="grid grid-cols-2 gap-3 mb-2">
                          <div>
                            <label className="block text-xs font-bold mb-1">Name</label>
                            <input
                              type="text"
                              className="sketch-input text-sm"
                              value={newTemplate.name}
                              onChange={(e) =>
                                setNewTemplate({ ...newTemplate, name: e.target.value })
                              }
                              placeholder="e.g., Cold Intro v1"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold mb-1">Type</label>
                            <select
                              className="sketch-select w-full text-sm"
                              value={newTemplate.type}
                              onChange={(e) =>
                                setNewTemplate({ ...newTemplate, type: e.target.value })
                              }
                            >
                              {TYPES.map((t) => (
                                <option key={t.value} value={t.value}>
                                  {t.label} (max {t.maxChars})
                                </option>
                              ))}
                            </select>
                          </div>
                          {newTemplate.type === "follow_up" && (
                            <div>
                              <label className="block text-xs font-bold mb-1">Sequence #</label>
                              <input
                                type="number"
                                min="1"
                                className={`sketch-input text-sm ${
                                  newTemplate.sequence_number < 1 ? "border-red-500" : ""
                                }`}
                                value={newTemplate.sequence_number}
                                onChange={(e) =>
                                  setNewTemplate({ ...newTemplate, sequence_number: parseInt(e.target.value) || 1 })
                                }
                                onWheel={(e) => e.currentTarget.blur()}
                              />
                              {newTemplate.sequence_number < 1 && (
                                <div className="text-xs text-red-600 mt-1">Must be at least 1</div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="mb-2">
                          <label className="block text-xs font-bold mb-1">Content</label>
                          <textarea
                            className="sketch-textarea text-sm"
                            value={newTemplate.content}
                            onChange={(e) =>
                              setNewTemplate({ ...newTemplate, content: e.target.value })
                            }
                            rows={3}
                          />
                          {newTemplate.content && (
                            <div
                              className={`text-xs mt-1 ${
                                getCharCount(newTemplate.content, newTemplate.type).isOver
                                  ? "text-red-600"
                                  : "text-gray-500"
                              }`}
                            >
                              {getCharCount(newTemplate.content, newTemplate.type).count} /{" "}
                              {getCharCount(newTemplate.content, newTemplate.type).max} chars
                            </div>
                          )}
                        </div>
                        <div className="mb-2">
                          <label className="block text-xs font-bold mb-1">Notes</label>
                          <textarea
                            className="sketch-textarea text-sm"
                            value={newTemplate.notes}
                            onChange={(e) =>
                              setNewTemplate({ ...newTemplate, notes: e.target.value })
                            }
                            placeholder="Internal notes about this template..."
                            rows={2}
                          />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button
                            className="sketch-btn text-xs"
                            onClick={() => setCreatingTemplateForProfile(null)}
                          >
                            Cancel
                          </button>
                          <button
                            className="sketch-btn sketch-btn-primary text-xs"
                            onClick={() => createTemplate(profile.id)}
                            disabled={!newTemplate.name || !newTemplate.content}
                          >
                            Create
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Templates list */}
                    {expandedProfiles.has(profile.id) && (
                      <div className="space-y-2">
                        {profile.message_templates.length === 0 ? (
                          <div className="text-xs text-gray-500 italic">No templates yet</div>
                        ) : (
                          profile.message_templates.map((template) => (
                            <div
                              key={template.id}
                              className={`bg-gray-50 p-3 rounded border ${
                                template.is_current ? "border-green-500" : "border-gray-200"
                              }`}
                            >
                              {editingTemplateId === template.id ? (
                                /* Edit Template mode */
                                <div className="space-y-2">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="block text-xs font-bold mb-1">Name</label>
                                      <input
                                        type="text"
                                        className="sketch-input text-sm"
                                        value={editTemplateData.name || ""}
                                        onChange={(e) =>
                                          setEditTemplateData({
                                            ...editTemplateData,
                                            name: e.target.value,
                                          })
                                        }
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-bold mb-1">Type</label>
                                      <select
                                        className="sketch-select w-full text-sm"
                                        value={editTemplateData.type}
                                        onChange={(e) =>
                                          setEditTemplateData({
                                            ...editTemplateData,
                                            type: e.target.value as Template["type"],
                                          })
                                        }
                                      >
                                        {TYPES.map((t) => (
                                          <option key={t.value} value={t.value}>
                                            {t.label}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    {editTemplateData.type === "follow_up" && (
                                      <div>
                                        <label className="block text-xs font-bold mb-1">Sequence #</label>
                                        <input
                                          type="number"
                                          min="1"
                                          className={`sketch-input text-sm ${
                                            (editTemplateData.sequence_number ?? 0) < 1 ? "border-red-500" : ""
                                          }`}
                                          value={editTemplateData.sequence_number ?? 1}
                                          onChange={(e) =>
                                            setEditTemplateData({
                                              ...editTemplateData,
                                              sequence_number: parseInt(e.target.value) || 1,
                                            })
                                          }
                                          onWheel={(e) => e.currentTarget.blur()}
                                        />
                                        {(editTemplateData.sequence_number ?? 0) < 1 && (
                                          <div className="text-xs text-red-600 mt-1">Must be at least 1</div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold mb-1">Content</label>
                                    <textarea
                                      className="sketch-textarea text-sm"
                                      value={editTemplateData.content || ""}
                                      onChange={(e) =>
                                        setEditTemplateData({
                                          ...editTemplateData,
                                          content: e.target.value,
                                        })
                                      }
                                      rows={3}
                                    />
                                    {editTemplateData.content && editTemplateData.type && (
                                      <div
                                        className={`text-xs mt-1 ${
                                          getCharCount(editTemplateData.content, editTemplateData.type)
                                            .isOver
                                            ? "text-red-600"
                                            : "text-gray-500"
                                        }`}
                                      >
                                        {getCharCount(editTemplateData.content, editTemplateData.type).count}{" "}
                                        / {getCharCount(editTemplateData.content, editTemplateData.type).max}{" "}
                                        chars
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold mb-1">Notes</label>
                                    <textarea
                                      className="sketch-textarea text-sm"
                                      value={editTemplateData.notes || ""}
                                      onChange={(e) =>
                                        setEditTemplateData({
                                          ...editTemplateData,
                                          notes: e.target.value,
                                        })
                                      }
                                      placeholder="Internal notes about this template..."
                                      rows={2}
                                    />
                                  </div>
                                  <div className="flex gap-2 justify-end">
                                    <button className="sketch-btn text-xs" onClick={cancelEditTemplate}>
                                      Cancel
                                    </button>
                                    <button
                                      className="sketch-btn sketch-btn-primary text-xs"
                                      onClick={saveTemplate}
                                    >
                                      Save
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                /* View Template mode */
                                <div>
                                  <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-sm">{template.name}</span>
                                      {template.is_current && (
                                        <span className="sketch-badge sketch-badge-accepted text-xs">
                                          Current
                                        </span>
                                      )}
                                      <span className="sketch-badge text-xs">
                                        {getTypeInfo(template.type).label}
                                        {template.type === "follow_up" && template.sequence_number && (
                                          <> #{template.sequence_number}</>
                                        )}
                                      </span>
                                    </div>
                                    <div className="flex gap-1">
                                      {template.is_current && (
                                        <button
                                          className="sketch-btn text-xs"
                                          onClick={() => iterateTemplate(template)}
                                        >
                                          Iterate
                                        </button>
                                      )}
                                      <button
                                        className="sketch-btn text-xs"
                                        onClick={() => toggleTemplateCurrent(template)}
                                      >
                                        {template.is_current ? "Deactivate" : "Set Current"}
                                      </button>
                                      <button
                                        className="sketch-btn text-xs"
                                        onClick={() => startEditTemplate(template)}
                                      >
                                        Edit
                                      </button>
                                      <button
                                        className="sketch-btn sketch-btn-danger text-xs"
                                        onClick={() => deleteTemplate(template.id)}
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                  <div className="text-sm text-gray-700 whitespace-pre-wrap">
                                    {template.content}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {template.content.length} / {getTypeInfo(template.type).maxChars} chars
                                  </div>
                                  {template.notes && (
                                    <div className="text-xs text-gray-500 mt-1 italic">
                                      Notes: {template.notes}
                                    </div>
                                  )}
                                  {/* Template Stats */}
                                  {templateStats.has(template.id) && (
                                    <div className="mt-2 pt-2 border-t border-dashed border-gray-200">
                                      <div className="flex flex-wrap gap-3 text-xs">
                                        <span className="text-gray-600">
                                          <span className="font-bold">{templateStats.get(template.id)!.total_sent}</span> sent
                                        </span>
                                        <span className="text-yellow-600">
                                          <span className="font-bold">{templateStats.get(template.id)!.pending}</span> pending
                                        </span>
                                        <span className="text-blue-600">
                                          <span className="font-bold">{templateStats.get(template.id)!.acceptance_rate}%</span> accepted
                                        </span>
                                        <span className="text-green-600">
                                          <span className="font-bold">{templateStats.get(template.id)!.reply_rate}%</span> replied
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
