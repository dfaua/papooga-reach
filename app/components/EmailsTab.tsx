"use client";

import { useEffect, useState, useCallback } from "react";
import { supabaseBrowser } from "../lib/supabase/browser-client";

interface Person {
  id: string;
  name: string;
  email: string | null;
  company_name: string | null;
}

interface Email {
  id: string;
  person_id: string | null;
  gmail_message_id: string;
  gmail_thread_id: string;
  from_email: string;
  to_email: string;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  direction: "sent" | "received";
  is_reply: boolean;
  sent_at: string;
  created_at: string;
  people?: Person | null;
}

interface GoogleStatus {
  connected: boolean;
  email: string | null;
  lastSyncAt: string | null;
}

export function EmailsTab() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [composeModal, setComposeModal] = useState(false);
  const [syncModal, setSyncModal] = useState(false);
  const [viewEmail, setViewEmail] = useState<Email | null>(null);

  // Compose form state
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composePersonId, setComposePersonId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Filters
  const [filterDirection, setFilterDirection] = useState<"all" | "sent" | "received">("all");

  const fetchGoogleStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/google/status", {
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "" },
      });
      if (res.ok) {
        setGoogleStatus(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch Google status:", error);
    }
  }, []);

  const fetchEmails = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterDirection !== "all") {
        params.set("direction", filterDirection);
      }
      const res = await fetch(`/api/emails?${params.toString()}`, {
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "" },
      });
      if (res.ok) {
        setEmails(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch emails:", error);
    }
  }, [filterDirection]);

  const fetchPeople = useCallback(async () => {
    try {
      const res = await fetch("/api/people", {
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "" },
      });
      if (res.ok) {
        const data = await res.json();
        setPeople(data.filter((p: Person) => p.email));
      }
    } catch (error) {
      console.error("Failed to fetch people:", error);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchGoogleStatus(), fetchEmails(), fetchPeople()]).finally(() =>
      setLoading(false)
    );
  }, [fetchGoogleStatus, fetchEmails, fetchPeople]);

  useEffect(() => {
    fetchEmails();
  }, [filterDirection, fetchEmails]);

  // Realtime subscription for emails
  useEffect(() => {
    const channel = supabaseBrowser
      .channel("emails-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "emails" },
        () => {
          fetchEmails();
        }
      )
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, [fetchEmails]);

  // Check for Google OAuth callback params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("google_connected") === "true") {
      fetchGoogleStatus();
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (params.get("google_error")) {
      alert("Failed to connect Gmail: " + params.get("google_error"));
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [fetchGoogleStatus]);

  const connectGoogle = async () => {
    try {
      const res = await fetch("/api/google/auth-url", {
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "" },
      });
      if (res.ok) {
        const { url } = await res.json();
        window.location.href = url;
      }
    } catch (error) {
      console.error("Failed to get auth URL:", error);
    }
  };

  const disconnectGoogle = async () => {
    if (!confirm("Disconnect Gmail? Stored emails will remain.")) return;

    try {
      const res = await fetch("/api/google/disconnect", {
        method: "POST",
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "" },
      });
      if (res.ok) {
        setGoogleStatus({ connected: false, email: null, lastSyncAt: null });
      }
    } catch (error) {
      console.error("Failed to disconnect:", error);
    }
  };

  const syncEmailsForPerson = async (person: Person) => {
    setSyncing(true);
    setSyncModal(false);
    try {
      const res = await fetch("/api/emails/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "",
        },
        body: JSON.stringify({
          personEmail: person.email,
          personId: person.id,
        }),
      });
      const result = await res.json();
      if (res.ok) {
        alert(`Synced ${result.synced} new emails for ${person.name} (${result.skipped} already synced)`);
        fetchEmails();
        fetchGoogleStatus();
      } else {
        alert("Sync failed: " + result.error);
      }
    } catch (error) {
      console.error("Sync failed:", error);
      alert("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const sendEmail = async () => {
    if (!composeTo || !composeSubject || !composeBody) {
      alert("Please fill in all fields");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "",
        },
        body: JSON.stringify({
          to: composeTo,
          subject: composeSubject,
          bodyText: composeBody,
          personId: composePersonId,
        }),
      });

      const result = await res.json();
      if (res.ok) {
        setComposeModal(false);
        setComposeTo("");
        setComposeSubject("");
        setComposeBody("");
        setComposePersonId(null);
        fetchEmails();
      } else {
        alert("Failed to send: " + result.error);
      }
    } catch (error) {
      console.error("Send failed:", error);
      alert("Failed to send email");
    } finally {
      setSending(false);
    }
  };

  const openComposeForPerson = (person: Person) => {
    setComposeTo(person.email || "");
    setComposePersonId(person.id);
    setComposeModal(true);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: "short" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  if (loading) {
    return <div className="sketch-empty">Loading...</div>;
  }

  return (
    <>
      {/* Gmail Connection Banner */}
      <div className="mb-4 p-4 border-2 border-black rounded flex items-center justify-between">
        {googleStatus?.connected ? (
          <>
            <div>
              <span className="font-bold">Gmail Connected:</span>{" "}
              <span className="text-green-600">{googleStatus.email}</span>
              {googleStatus.lastSyncAt && (
                <span className="text-gray-500 text-sm ml-2">
                  Last sync: {new Date(googleStatus.lastSyncAt).toLocaleString()}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                className="sketch-btn"
                onClick={() => setSyncModal(true)}
                disabled={syncing}
              >
                {syncing ? "Syncing..." : "Sync"}
              </button>
              <button
                className="sketch-btn sketch-btn-primary"
                onClick={() => setComposeModal(true)}
              >
                Compose
              </button>
              <button
                className="sketch-btn text-xs"
                onClick={disconnectGoogle}
              >
                Disconnect
              </button>
            </div>
          </>
        ) : (
          <>
            <div>
              <span className="font-bold">Gmail not connected.</span>{" "}
              <span className="text-gray-600">Connect to sync and send emails.</span>
            </div>
            <button className="sketch-btn sketch-btn-primary" onClick={connectGoogle}>
              Connect Gmail
            </button>
          </>
        )}
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-2 items-center">
        <span className="font-bold text-sm">Filter:</span>
        <select
          className="sketch-select"
          value={filterDirection}
          onChange={(e) => setFilterDirection(e.target.value as any)}
        >
          <option value="all">All Emails</option>
          <option value="sent">Sent</option>
          <option value="received">Received</option>
        </select>
        <span className="text-gray-500 text-sm ml-2">
          {emails.length} email{emails.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Emails List */}
      {emails.length === 0 ? (
        <div className="sketch-empty">
          {googleStatus?.connected
            ? "No emails yet. Click Sync to fetch emails from Gmail."
            : "Connect Gmail to view and send emails."}
        </div>
      ) : (
        <div className="border-2 border-black rounded overflow-hidden">
          {emails.map((email) => (
            <div
              key={email.id}
              className="p-3 border-b border-gray-200 hover:bg-gray-50 cursor-pointer flex items-start gap-3"
              onClick={() => setViewEmail(email)}
            >
              <div
                className={`w-2 h-2 rounded-full mt-2 ${
                  email.direction === "sent" ? "bg-blue-500" : "bg-green-500"
                }`}
                title={email.direction === "sent" ? "Sent" : "Received"}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold truncate">
                    {email.direction === "sent" ? email.to_email : email.from_email}
                  </span>
                  {email.is_reply && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                      Reply
                    </span>
                  )}
                  {email.people && (
                    <span className="text-xs text-gray-500">
                      ({email.people.name})
                    </span>
                  )}
                </div>
                <div className="text-sm truncate">{email.subject || "(No subject)"}</div>
                <div className="text-xs text-gray-500 truncate">
                  {email.body_text?.slice(0, 100)}...
                </div>
              </div>
              <div className="text-xs text-gray-500 whitespace-nowrap">
                {formatDate(email.sent_at)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Email Modal */}
      {viewEmail && (
        <div className="sketch-modal-overlay" onClick={() => setViewEmail(null)}>
          <div
            className="sketch-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "700px" }}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="mb-1">{viewEmail.subject || "(No subject)"}</h2>
                <div className="text-sm text-gray-600">
                  <span className="font-bold">From:</span> {viewEmail.from_email}
                </div>
                <div className="text-sm text-gray-600">
                  <span className="font-bold">To:</span> {viewEmail.to_email}
                </div>
                <div className="text-sm text-gray-500">
                  {new Date(viewEmail.sent_at).toLocaleString()}
                </div>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded ${
                  viewEmail.direction === "sent"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-green-100 text-green-700"
                }`}
              >
                {viewEmail.direction === "sent" ? "Sent" : "Received"}
                {viewEmail.is_reply && " (Reply)"}
              </span>
            </div>

            <div className="border-t pt-4 max-h-96 overflow-y-auto">
              <pre className="whitespace-pre-wrap font-sans text-sm">
                {viewEmail.body_text}
              </pre>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                className="sketch-btn sketch-btn-primary"
                onClick={() => setViewEmail(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync Modal - Select Person */}
      {syncModal && (
        <div className="sketch-modal-overlay" onClick={() => setSyncModal(false)}>
          <div
            className="sketch-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "500px" }}
          >
            <h2>Sync Emails</h2>
            <p className="text-gray-600 text-sm mt-1 mb-4">
              Select a person to sync their email conversations from Gmail.
            </p>

            {people.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No people with email addresses found.
                <br />
                Enrich people with Apollo first to get their emails.
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto border border-gray-200 rounded">
                {people.map((person) => (
                  <div
                    key={person.id}
                    className="p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                    onClick={() => syncEmailsForPerson(person)}
                  >
                    <div>
                      <div className="font-bold">{person.name}</div>
                      <div className="text-sm text-gray-600">{person.email}</div>
                      {person.company_name && (
                        <div className="text-xs text-gray-400">{person.company_name}</div>
                      )}
                    </div>
                    <button className="sketch-btn text-sm">Sync</button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button className="sketch-btn" onClick={() => setSyncModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compose Modal */}
      {composeModal && (
        <div className="sketch-modal-overlay" onClick={() => setComposeModal(false)}>
          <div
            className="sketch-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "600px" }}
          >
            <h2>Compose Email</h2>

            <div className="space-y-4 mt-4">
              <div>
                <label className="block text-sm font-bold mb-1">To</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    className="sketch-input flex-1"
                    value={composeTo}
                    onChange={(e) => setComposeTo(e.target.value)}
                    placeholder="email@example.com"
                  />
                  {people.length > 0 && (
                    <select
                      className="sketch-select"
                      value={composePersonId || ""}
                      onChange={(e) => {
                        const person = people.find((p) => p.id === e.target.value);
                        if (person) {
                          openComposeForPerson(person);
                        }
                      }}
                    >
                      <option value="">Select contact...</option>
                      {people.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.email})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-1">Subject</label>
                <input
                  type="text"
                  className="sketch-input"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Email subject"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-1">Message</label>
                <textarea
                  className="sketch-textarea"
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Write your message..."
                  rows={10}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button className="sketch-btn" onClick={() => setComposeModal(false)}>
                Cancel
              </button>
              <button
                className="sketch-btn sketch-btn-primary"
                onClick={sendEmail}
                disabled={sending || !composeTo || !composeSubject || !composeBody}
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
