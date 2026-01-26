"use client";

import { useEffect, useState, useCallback } from "react";

interface AISettings {
  id?: string;
  company_info: string;
  custom_instructions: string;
}

export function AIContextTable() {
  const [settings, setSettings] = useState<AISettings>({
    company_info: "",
    custom_instructions: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/ai-settings", {
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "" },
      });
      if (res.ok) {
        setSettings(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch AI settings:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSettings = async () => {
    setSaving(true);
    setSaved(false);

    try {
      const res = await fetch("/api/ai-settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "",
        },
        body: JSON.stringify({
          company_info: settings.company_info,
          custom_instructions: settings.custom_instructions,
        }),
      });

      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (error) {
      console.error("Failed to save AI settings:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="sketch-empty">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="sketch-box p-6 bg-white">
        <h2 className="text-lg font-bold mb-4">AI Context Settings</h2>
        <p className="text-sm text-gray-600 mb-6">
          Configure the context that AI will use when generating or polishing messages in conversations.
        </p>

        {/* Company Info */}
        <div className="mb-6">
          <label className="block text-sm font-bold mb-2">Company Info</label>
          <p className="text-xs text-gray-500 mb-2">
            Describe your company, what you do, your value proposition, etc. This helps AI understand the context when writing messages.
          </p>
          <textarea
            className="sketch-textarea w-full"
            rows={8}
            placeholder="We are [Company Name], a [type of company] that helps [target audience] to [benefit]. Our main products/services include...

Key differentiators:
- ...
- ...

Our typical customers are..."
            value={settings.company_info || ""}
            onChange={(e) =>
              setSettings({ ...settings, company_info: e.target.value })
            }
          />
        </div>

        {/* Custom Instructions */}
        <div className="mb-6">
          <label className="block text-sm font-bold mb-2">Custom Instructions</label>
          <p className="text-xs text-gray-500 mb-2">
            Add any specific instructions for how AI should write messages. Include tone, style, things to avoid, etc.
          </p>
          <textarea
            className="sketch-textarea w-full"
            rows={8}
            placeholder="Tone: Professional but friendly
Style: Concise and direct

Always:
- Keep messages under X characters
- Reference their company/role
- End with a clear call to action

Never:
- Use generic phrases like 'I hope this finds you well'
- Be pushy or salesy
- Make claims we can't back up"
            value={settings.custom_instructions || ""}
            onChange={(e) =>
              setSettings({ ...settings, custom_instructions: e.target.value })
            }
          />
        </div>

        {/* Save button */}
        <div className="flex items-center gap-3">
          <button
            className="sketch-btn sketch-btn-primary"
            onClick={saveSettings}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
          {saved && (
            <span className="text-sm text-green-600 font-bold">Saved!</span>
          )}
        </div>
      </div>
    </div>
  );
}
