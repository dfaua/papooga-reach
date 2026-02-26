"use client";

import { useEffect, useState, useCallback } from "react";
import { supabaseBrowser } from "../lib/supabase/browser-client";

interface Person {
  id: string;
  name: string;
  title: string | null;
  headline: string | null;
  company_name: string | null;
  company_linkedin_url: string | null;
  linkedin_profile_url: string | null;
  linkedin_url: string;
  status: string | null;
  notes: string | null;
  email: string | null;
  email_status: string | null;
  email_zerobounce_status: string | null;
  email_zerobounce_sub_status: string | null;
  email_zerobounce_at: string | null;
  apollo_id: string | null;
  apollo_enriched_at: string | null;
  phone_number: string | null;
  photo_url: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  seniority: string | null;
  departments: string[] | null;
  connections_count: number | null;
  followers_count: number | null;
  twitter_url: string | null;
  github_url: string | null;
  facebook_url: string | null;
  warm_intro_referrer: string | null;
}

interface Message {
  id: string;
  person_id: string;
  type: "sales_navigator" | "linkedin" | "email";
  direction: "sent" | "received";
  content: string;
  subject: string | null;
  created_at: string;
}

interface OutreachLog {
  id: string;
  person_id: string;
  action: string;
  details: {
    message_content?: string;
    message_type?: string;
  } | null;
  outcome: "pending" | "accepted" | "replied" | null;
  created_at: string;
}

// Unified timeline item
interface TimelineItem {
  id: string;
  type: "message" | "outreach";
  direction: "sent" | "received";
  content: string;
  subject?: string | null;
  platform: string;
  created_at: string;
  outreachType?: string;
  outcome?: "pending" | "accepted" | "replied" | null;
}

type MessageType = "sales_navigator" | "linkedin" | "email";

const MESSAGE_TYPES: { value: MessageType; label: string }[] = [
  { value: "sales_navigator", label: "Sales Nav" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "email", label: "Email" },
];

const AI_MODELS: { value: string; label: string }[] = [
  { value: "gemini/gemini-3-pro-preview", label: "Gemini 3 Pro" },
  { value: "gemini/gemini-3-flash-preview", label: "Gemini 3 Flash" },
  { value: "groq/llama-3.3-70b", label: "Llama 3.3 70B" },
  { value: "groq/llama-4-scout", label: "Llama 4 Scout" },
];

export function ConversationsTable() {
  const [people, setPeople] = useState<Person[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [outreachLogs, setOutreachLogs] = useState<OutreachLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("person");
    }
    return null;
  });
  const [newMessage, setNewMessage] = useState("");
  const [messageSubject, setMessageSubject] = useState("");
  const [messageType, setMessageType] = useState<MessageType>("linkedin");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterWithNotes, setFilterWithNotes] = useState(false);
  const [filterMultipleMessages, setFilterMultipleMessages] = useState(false);
  const [messageCounts, setMessageCounts] = useState<Record<string, number>>({});

  // AI suggestion state
  const [aiModel, setAiModel] = useState("gemini/gemini-3-pro-preview");
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [messageInstructions, setMessageInstructions] = useState("");

  // Notes state
  const [personNotes, setPersonNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // Person info modal state
  const [personInfoModal, setPersonInfoModal] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);

  // Todo modal state
  const [todoModal, setTodoModal] = useState(false);
  const [todoTitle, setTodoTitle] = useState("");
  const [todoDueDate, setTodoDueDate] = useState("");
  const [todoPriority, setTodoPriority] = useState("medium");

  const selectPerson = useCallback((personId: string | null) => {
    setSelectedPersonId(personId);
    const url = new URL(window.location.href);
    if (personId) {
      url.searchParams.set("person", personId);
    } else {
      url.searchParams.delete("person");
    }
    window.history.replaceState({}, "", url.toString());
  }, []);

  const fetchData = useCallback(async () => {
    try {
      // Fetch people who have been contacted (not just saved)
      const peopleRes = await fetch("/api/people", {
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "" },
      });

      if (peopleRes.ok) {
        const allPeople: Person[] = await peopleRes.json();
        // Filter to people who are not just "saved"
        const contactedPeople = allPeople.filter(
          (p) => p.status && p.status !== "saved"
        );
        setPeople(contactedPeople);

        // Fetch message counts for all contacted people
        const countsRes = await fetch("/api/messages/counts", {
          headers: { "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "" },
        });
        if (countsRes.ok) {
          const counts: { person_id: string; count: number }[] = await countsRes.json();
          const countsMap: Record<string, number> = {};
          counts.forEach((c) => {
            countsMap[c.person_id] = c.count;
          });
          setMessageCounts(countsMap);
        }
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMessages = useCallback(async (personId: string) => {
    try {
      const [messagesRes, outreachRes] = await Promise.all([
        fetch(`/api/messages?person_id=${personId}`, {
          headers: { "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "" },
        }),
        fetch(`/api/outreach-logs?person_id=${personId}`, {
          headers: { "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "" },
        }),
      ]);

      if (messagesRes.ok) {
        setMessages(await messagesRes.json());
      }
      if (outreachRes.ok) {
        setOutreachLogs(await outreachRes.json());
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (selectedPersonId) {
      fetchMessages(selectedPersonId);
      // Load notes for selected person
      const person = people.find((p) => p.id === selectedPersonId);
      setPersonNotes(person?.notes || "");
    } else {
      setMessages([]);
      setOutreachLogs([]);
      setPersonNotes("");
    }
  }, [selectedPersonId, fetchMessages, people]);

  // Build unified timeline from messages and outreach logs
  const timeline: TimelineItem[] = [
    ...messages.map((m): TimelineItem => ({
      id: m.id,
      type: "message",
      direction: m.direction,
      content: m.content,
      subject: m.subject,
      platform: m.type === "sales_navigator" ? "SN" : m.type === "email" ? "Email" : "LI",
      created_at: m.created_at,
    })),
    ...outreachLogs
      .filter((o) => o.action === "note_sent" && o.details?.message_content)
      .map((o): TimelineItem => ({
        id: o.id,
        type: "outreach",
        direction: "sent",
        content: o.details?.message_content || "",
        platform: o.details?.message_type === "connection" ? "Connection" : "Message",
        created_at: o.created_at,
        outreachType: o.details?.message_type,
        outcome: o.outcome,
      })),
  ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // Realtime subscription for messages
  useEffect(() => {
    if (!selectedPersonId) return;

    const channel = supabaseBrowser
      .channel("messages-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `person_id=eq.${selectedPersonId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setMessages((prev) => [...prev, payload.new as Message]);
          } else if (payload.eventType === "UPDATE") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === (payload.new as Message).id ? (payload.new as Message) : m
              )
            );
          } else if (payload.eventType === "DELETE") {
            setMessages((prev) =>
              prev.filter((m) => m.id !== (payload.old as Message).id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, [selectedPersonId]);

  const updateOutcome = async (outreachId: string, outcome: "accepted" | "replied") => {
    try {
      const res = await fetch(`/api/outreach-logs/${outreachId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "",
        },
        body: JSON.stringify({ outcome }),
      });

      if (res.ok) {
        // Update local state
        setOutreachLogs((prev) =>
          prev.map((o) => (o.id === outreachId ? { ...o, outcome } : o))
        );
      }
    } catch (error) {
      console.error("Failed to update outcome:", error);
    }
  };

  const sendMessage = async (direction: "sent" | "received") => {
    if (!selectedPersonId || !newMessage.trim()) return;

    setSending(true);

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "",
        },
        body: JSON.stringify({
          person_id: selectedPersonId,
          type: messageType,
          direction,
          content: newMessage.trim(),
          subject: messageType === "email" && messageSubject.trim() ? messageSubject.trim() : null,
        }),
      });

      if (res.ok) {
        setNewMessage("");
        setMessageSubject("");

        // If this is a received message, auto-mark any pending connection outreach as "replied"
        if (direction === "received") {
          const pendingConnectionOutreach = outreachLogs.find(
            (o) =>
              o.action === "note_sent" &&
              o.details?.message_type === "connection" &&
              (o.outcome === "pending" || o.outcome === "accepted" || !o.outcome)
          );

          if (pendingConnectionOutreach) {
            await updateOutcome(pendingConnectionOutreach.id, "replied");
          }
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!confirm("Delete this message?")) return;

    try {
      await fetch(`/api/messages/${messageId}`, {
        method: "DELETE",
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "" },
      });
    } catch (error) {
      console.error("Failed to delete message:", error);
    }
  };

  const generateAiSuggestion = async () => {
    if (!selectedPersonId) return;

    setAiLoading(true);
    setAiSuggestion(null);

    try {
      // Build conversation history from timeline
      const conversationHistory = timeline.map((item) => ({
        direction: item.direction,
        content: item.content,
        created_at: item.created_at,
        platform: item.platform,
      }));

      const res = await fetch("/api/ai/suggest-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "",
        },
        body: JSON.stringify({
          personId: selectedPersonId,
          conversationHistory,
          userDraft: newMessage.trim() || undefined,
          mode: newMessage.trim() ? "polish" : "generate",
          model: aiModel,
          messageInstructions: messageInstructions.trim() || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAiSuggestion(data.suggestion);
      } else {
        const error = await res.json();
        console.error("AI suggestion error:", error);
      }
    } catch (error) {
      console.error("Failed to generate AI suggestion:", error);
    } finally {
      setAiLoading(false);
    }
  };

  const acceptSuggestion = () => {
    if (aiSuggestion) {
      setNewMessage(aiSuggestion);
      setAiSuggestion(null);
    }
  };

  const dismissSuggestion = () => {
    setAiSuggestion(null);
  };

  const saveNotes = async () => {
    if (!selectedPersonId) return;

    setSavingNotes(true);
    try {
      const res = await fetch(`/api/people/${selectedPersonId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "",
        },
        body: JSON.stringify({ notes: personNotes }),
      });

      if (res.ok) {
        // Update local state
        setPeople((prev) =>
          prev.map((p) =>
            p.id === selectedPersonId ? { ...p, notes: personNotes } : p
          )
        );
      }
    } catch (error) {
      console.error("Failed to save notes:", error);
    } finally {
      setSavingNotes(false);
    }
  };

  const createTodo = async () => {
    if (!selectedPersonId || !todoTitle.trim()) return;

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
          entity_id: selectedPersonId,
        }),
      });

      setTodoModal(false);
      setTodoTitle("");
      setTodoDueDate("");
      setTodoPriority("medium");
    } catch (error) {
      console.error("Failed to create todo:", error);
    }
  };

  const enrichWithApollo = async () => {
    if (!selectedPersonId) return;
    setEnriching(true);

    try {
      const res = await fetch("/api/apollo/enrich-person", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "",
        },
        body: JSON.stringify({ personId: selectedPersonId }),
      });

      const result = await res.json();

      if (res.ok && result.enriched) {
        setPeople((prev) =>
          prev.map((p) => (p.id === selectedPersonId ? { ...p, ...result.person } : p))
        );
      } else if (res.ok && !result.enriched) {
        alert("No match found in Apollo database");
      } else {
        alert(`Error: ${result.error || "Failed to enrich"}`);
      }
    } catch (error) {
      console.error("Failed to enrich with Apollo:", error);
      alert("Failed to enrich with Apollo");
    } finally {
      setEnriching(false);
    }
  };

  const verifyEmailWithZeroBounce = async () => {
    const person = people.find((p) => p.id === selectedPersonId);
    if (!person?.email) return;
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
        setPeople((prev) =>
          prev.map((p) => (p.id === person.id ? { ...p, ...result.person } : p))
        );
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

  const selectedPerson = people.find((p) => p.id === selectedPersonId);

  const filteredPeople = people.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesNotesFilter = !filterWithNotes || (p.notes && p.notes.trim() !== "");
    const matchesMessagesFilter = !filterMultipleMessages || (messageCounts[p.id] || 0) >= 2;
    return matchesSearch && matchesNotesFilter && matchesMessagesFilter;
  });

  if (loading) {
    return <div className="sketch-empty">Loading...</div>;
  }

  return (
    <div className="flex h-[calc(100vh-220px)] gap-4">
      {/* Left: People list */}
      <div className="w-80 flex-shrink-0 sketch-box bg-white overflow-hidden flex flex-col">
        <div className="p-3 border-b border-dashed border-gray-300">
          <input
            type="text"
            className="sketch-input w-full text-sm mb-2"
            placeholder="Search people..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={filterWithNotes}
              onChange={(e) => setFilterWithNotes(e.target.checked)}
              className="rounded"
            />
            With notes only
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer mt-1">
            <input
              type="checkbox"
              checked={filterMultipleMessages}
              onChange={(e) => setFilterMultipleMessages(e.target.checked)}
              className="rounded"
            />
            2+ messages
          </label>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredPeople.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              No contacted people yet
            </div>
          ) : (
            filteredPeople.map((person) => (
              <div
                key={person.id}
                className={`p-3 border-b border-dashed border-gray-200 cursor-pointer hover:bg-gray-50 ${
                  selectedPersonId === person.id ? "bg-gray-100" : ""
                }`}
                onClick={() => selectPerson(person.id)}
              >
                <div className="font-bold text-sm">{person.name}</div>
                <div className="text-xs text-gray-600 truncate">
                  {person.title || "No title"}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {person.company_name || "No company"}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right: Conversation view */}
      <div className="flex-1 sketch-box bg-white overflow-hidden flex flex-col">
        {selectedPerson ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-dashed border-gray-300">
              <div className="flex justify-between items-start">
                <div>
                  <div
                    className="font-bold cursor-pointer hover:underline hover:text-blue-700"
                    onClick={() => setPersonInfoModal(true)}
                  >
                    {selectedPerson.name}
                  </div>
                  <div className="text-sm text-gray-600">
                    {selectedPerson.title} at {selectedPerson.company_name || "Unknown"}
                  </div>
                  {selectedPerson.linkedin_profile_url && (
                    <a
                      href={selectedPerson.linkedin_profile_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      LinkedIn Profile →
                    </a>
                  )}
                </div>
                <button
                  className="sketch-btn text-xs"
                  onClick={() => setTodoModal(true)}
                >
                  + Todo
                </button>
              </div>
            </div>

            {/* Messages Timeline */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {timeline.length === 0 ? (
                <div className="text-center text-gray-500 text-sm py-8">
                  No messages yet. Add your first message below.
                </div>
              ) : (
                timeline.map((item) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    className={`flex ${
                      item.direction === "sent" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-3 relative group ${
                        item.type === "outreach"
                          ? "bg-blue-900 text-white border-2 border-dashed border-blue-400"
                          : item.direction === "sent"
                          ? "bg-black text-white"
                          : "bg-gray-100 text-black"
                      }`}
                    >
                      {item.type === "outreach" && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-blue-300 font-bold">
                            Initial {item.outreachType === "connection" ? "Connection Note" : "Message"}
                          </span>
                          {item.outcome === "accepted" && (
                            <span className="text-xs bg-yellow-500 text-black px-1.5 py-0.5 rounded font-bold">
                              Accepted
                            </span>
                          )}
                          {item.outcome === "replied" && (
                            <span className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded font-bold">
                              Replied
                            </span>
                          )}
                        </div>
                      )}
                      {item.subject && (
                        <div className="text-xs font-bold mb-1 opacity-75">
                          Sub: {item.subject}
                        </div>
                      )}
                      <div className="text-sm whitespace-pre-wrap">{item.content}</div>
                      <div
                        className={`text-xs mt-1 flex items-center gap-2 ${
                          item.type === "outreach"
                            ? "text-blue-300"
                            : item.direction === "sent"
                            ? "text-gray-300"
                            : "text-gray-500"
                        }`}
                      >
                        <span className="sketch-badge text-xs py-0 px-1">
                          {item.platform}
                        </span>
                        <span>
                          {new Date(item.created_at).toLocaleString()}
                        </span>
                      </div>
                      {/* Show "Accepted (no reply)" button for pending connection outreach */}
                      {item.type === "outreach" &&
                        item.outreachType === "connection" &&
                        (!item.outcome || item.outcome === "pending") && (
                          <button
                            className="mt-2 text-xs bg-yellow-500 hover:bg-yellow-600 text-black px-2 py-1 rounded font-bold"
                            onClick={() => updateOutcome(item.id, "accepted")}
                          >
                            Accepted (no reply)
                          </button>
                        )}
                      {item.type === "message" && (
                        <button
                          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-xs hidden group-hover:flex items-center justify-center"
                          onClick={() => deleteMessage(item.id)}
                          title="Delete message"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-dashed border-gray-300">
              <div className="flex gap-2 mb-2">
                <select
                  className="sketch-select text-sm"
                  value={messageType}
                  onChange={(e) => setMessageType(e.target.value as MessageType)}
                >
                  {MESSAGE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
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
                <button
                  className="sketch-btn text-xs whitespace-nowrap bg-purple-100 hover:bg-purple-200 border-purple-300"
                  onClick={generateAiSuggestion}
                  disabled={aiLoading}
                >
                  {aiLoading ? "..." : newMessage.trim() ? "Polish" : "Generate Reply"}
                </button>
              </div>
              {messageType === "email" && (
                <div className="mb-2">
                  <input
                    type="text"
                    className="sketch-input w-full text-sm"
                    placeholder="Subject line..."
                    value={messageSubject}
                    onChange={(e) => setMessageSubject(e.target.value)}
                  />
                </div>
              )}
              <div className="mb-2">
                <input
                  type="text"
                  className="sketch-input w-full text-xs"
                  placeholder="AI instructions for this message (e.g., 'funny tone', 'keep it short')..."
                  value={messageInstructions}
                  onChange={(e) => setMessageInstructions(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <textarea
                  className="sketch-textarea flex-1 text-sm"
                  rows={2}
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                    }
                  }}
                />
                <div className="flex flex-col gap-2">
                  <button
                    className="sketch-btn sketch-btn-primary text-xs whitespace-nowrap"
                    onClick={() => sendMessage("sent")}
                    disabled={!newMessage.trim() || sending}
                  >
                    From Me →
                  </button>
                  <button
                    className="sketch-btn text-xs whitespace-nowrap"
                    onClick={() => sendMessage("received")}
                    disabled={!newMessage.trim() || sending}
                  >
                    ← To Me
                  </button>
                </div>
              </div>

              {/* AI Suggestion Panel */}
              {aiSuggestion && (
                <div className="mt-3 p-3 bg-purple-50 border border-dashed border-purple-300 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-purple-700">AI Suggestion</span>
                    <button
                      className="text-gray-400 hover:text-gray-600 text-sm"
                      onClick={dismissSuggestion}
                    >
                      ×
                    </button>
                  </div>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap mb-2">
                    {aiSuggestion}
                  </div>
                  <button
                    className="sketch-btn sketch-btn-primary text-xs"
                    onClick={acceptSuggestion}
                  >
                    Accept Suggestion
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a person to view conversation
          </div>
        )}
      </div>

      {/* Right: Notes panel */}
      {selectedPerson && (
        <div className="w-72 flex-shrink-0 sketch-box bg-white overflow-hidden flex flex-col">
          <div className="p-3 border-b border-dashed border-gray-300">
            <div className="font-bold text-sm">Notes</div>
          </div>
          <div className="flex-1 p-3 flex flex-col">
            <textarea
              className="sketch-textarea flex-1 text-sm resize-none"
              placeholder="Add notes about this conversation..."
              value={personNotes}
              onChange={(e) => setPersonNotes(e.target.value)}
            />
            <button
              className="sketch-btn sketch-btn-primary text-xs mt-2"
              onClick={saveNotes}
              disabled={savingNotes || personNotes === (selectedPerson.notes || "")}
            >
              {savingNotes ? "Saving..." : "Save Notes"}
            </button>
          </div>
        </div>
      )}

      {/* Person Info Modal */}
      {personInfoModal && selectedPerson && (
        <div className="sketch-modal-overlay" onClick={() => setPersonInfoModal(false)}>
          <div
            className="sketch-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "560px" }}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                {selectedPerson.photo_url && (
                  <img
                    src={selectedPerson.photo_url}
                    alt={selectedPerson.name}
                    className="w-12 h-12 rounded-full object-cover border border-gray-300"
                  />
                )}
                <div>
                  <h2 className="m-0">{selectedPerson.name}</h2>
                  {selectedPerson.headline && (
                    <div className="text-sm text-gray-600 mt-0.5">{selectedPerson.headline}</div>
                  )}
                </div>
              </div>
              <button
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                onClick={() => setPersonInfoModal(false)}
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              {/* Role & Company */}
              <div className="border-b border-dashed border-gray-200 pb-3">
                <div className="text-xs font-bold text-gray-500 uppercase mb-1.5">Role</div>
                <div className="text-sm">
                  {selectedPerson.title || "No title"}
                  {selectedPerson.seniority && (
                    <span className="sketch-badge text-xs ml-2">{selectedPerson.seniority}</span>
                  )}
                </div>
                <div className="text-sm mt-1">
                  {selectedPerson.company_name ? (
                    selectedPerson.company_linkedin_url ? (
                      <a
                        href={selectedPerson.company_linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {selectedPerson.company_name}
                      </a>
                    ) : (
                      selectedPerson.company_name
                    )
                  ) : (
                    <span className="text-gray-400">No company</span>
                  )}
                </div>
                {selectedPerson.departments && selectedPerson.departments.length > 0 && (
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {selectedPerson.departments.map((d) => (
                      <span key={d} className="sketch-badge text-xs">{d}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Email */}
              <div className="border-b border-dashed border-gray-200 pb-3">
                <div className="text-xs font-bold text-gray-500 uppercase mb-1.5">Email</div>
                {selectedPerson.email ? (
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        className="text-sm text-blue-600 hover:underline bg-transparent border-none cursor-pointer p-0"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedPerson.email!);
                        }}
                        title="Click to copy"
                      >
                        {selectedPerson.email}
                      </button>
                      {selectedPerson.email_status && (
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded font-bold ${
                            selectedPerson.email_status === "verified"
                              ? "bg-green-100 text-green-700"
                              : selectedPerson.email_status === "guessed"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          Apollo: {selectedPerson.email_status}
                        </span>
                      )}
                    </div>
                    {selectedPerson.email_zerobounce_status && (
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded font-bold ${
                            selectedPerson.email_zerobounce_status === "valid"
                              ? "bg-green-100 text-green-700"
                              : selectedPerson.email_zerobounce_status === "invalid"
                              ? "bg-red-100 text-red-700"
                              : selectedPerson.email_zerobounce_status === "catch-all"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          ZeroBounce: {selectedPerson.email_zerobounce_status}
                        </span>
                        {selectedPerson.email_zerobounce_sub_status && (
                          <span className="text-xs text-gray-500">
                            ({selectedPerson.email_zerobounce_sub_status})
                          </span>
                        )}
                        {selectedPerson.email_zerobounce_at && (
                          <span className="text-xs text-gray-400">
                            {new Date(selectedPerson.email_zerobounce_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">No email</span>
                )}
              </div>

              {/* Contact & Location */}
              <div className="border-b border-dashed border-gray-200 pb-3">
                <div className="text-xs font-bold text-gray-500 uppercase mb-1.5">Contact & Location</div>
                {selectedPerson.phone_number && (
                  <div className="text-sm mb-1">
                    Phone: <span className="font-mono">{selectedPerson.phone_number}</span>
                  </div>
                )}
                {(selectedPerson.city || selectedPerson.state || selectedPerson.country) && (
                  <div className="text-sm">
                    {[selectedPerson.city, selectedPerson.state, selectedPerson.country]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                )}
                {!selectedPerson.phone_number &&
                  !selectedPerson.city &&
                  !selectedPerson.state &&
                  !selectedPerson.country && (
                    <span className="text-sm text-gray-400">No contact info</span>
                  )}
              </div>

              {/* Social Links */}
              <div className="border-b border-dashed border-gray-200 pb-3">
                <div className="text-xs font-bold text-gray-500 uppercase mb-1.5">Links</div>
                <div className="flex gap-3 flex-wrap text-sm">
                  {(selectedPerson.linkedin_profile_url || selectedPerson.linkedin_url) && (
                    <a
                      href={selectedPerson.linkedin_profile_url || selectedPerson.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      LinkedIn
                    </a>
                  )}
                  {selectedPerson.twitter_url && (
                    <a
                      href={selectedPerson.twitter_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Twitter
                    </a>
                  )}
                  {selectedPerson.github_url && (
                    <a
                      href={selectedPerson.github_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      GitHub
                    </a>
                  )}
                  {selectedPerson.facebook_url && (
                    <a
                      href={selectedPerson.facebook_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Facebook
                    </a>
                  )}
                </div>
              </div>

              {/* LinkedIn Stats */}
              {(selectedPerson.connections_count || selectedPerson.followers_count) && (
                <div className="border-b border-dashed border-gray-200 pb-3">
                  <div className="text-xs font-bold text-gray-500 uppercase mb-1.5">LinkedIn Stats</div>
                  <div className="flex gap-4 text-sm">
                    {selectedPerson.connections_count != null && (
                      <span>{selectedPerson.connections_count.toLocaleString()} connections</span>
                    )}
                    {selectedPerson.followers_count != null && (
                      <span>{selectedPerson.followers_count.toLocaleString()} followers</span>
                    )}
                  </div>
                </div>
              )}

              {/* Enrichment & Status */}
              <div className="border-b border-dashed border-gray-200 pb-3">
                <div className="text-xs font-bold text-gray-500 uppercase mb-1.5">Status</div>
                <div className="flex gap-2 flex-wrap text-sm">
                  {selectedPerson.status && (
                    <span className="sketch-badge text-xs">{selectedPerson.status}</span>
                  )}
                  {selectedPerson.apollo_enriched_at && (
                    <span className="sketch-badge text-xs bg-blue-50">
                      Apollo enriched {new Date(selectedPerson.apollo_enriched_at).toLocaleDateString()}
                    </span>
                  )}
                  {selectedPerson.warm_intro_referrer && (
                    <span className="sketch-badge text-xs bg-orange-50">
                      Warm intro: {selectedPerson.warm_intro_referrer}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div>
                <div className="text-xs font-bold text-gray-500 uppercase mb-1.5">Actions</div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    className={`sketch-btn text-xs ${selectedPerson.apollo_enriched_at ? "sketch-btn-success" : ""}`}
                    onClick={enrichWithApollo}
                    disabled={enriching}
                  >
                    {enriching
                      ? "Enriching..."
                      : selectedPerson.apollo_enriched_at
                      ? "Re-enrich Apollo"
                      : "Enrich with Apollo"}
                  </button>
                  {selectedPerson.email && !selectedPerson.email_zerobounce_status && (
                    <button
                      className="sketch-btn text-xs"
                      onClick={verifyEmailWithZeroBounce}
                      disabled={verifyingEmail}
                    >
                      {verifyingEmail ? "Verifying..." : "Verify Email (ZeroBounce)"}
                    </button>
                  )}
                  {selectedPerson.email && selectedPerson.email_zerobounce_status && (
                    <button
                      className="sketch-btn text-xs"
                      onClick={verifyEmailWithZeroBounce}
                      disabled={verifyingEmail}
                    >
                      {verifyingEmail ? "Verifying..." : "Re-verify Email"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Todo Modal */}
      {todoModal && selectedPerson && (
        <div className="sketch-modal-overlay" onClick={() => setTodoModal(false)}>
          <div className="sketch-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add Todo for {selectedPerson.name}</h2>
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
              <button className="sketch-btn" onClick={() => setTodoModal(false)}>
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
    </div>
  );
}
