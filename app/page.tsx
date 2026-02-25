"use client";

import { useState, useEffect, useCallback } from "react";
import { CompaniesTable } from "./components/CompaniesTable";
import { PeopleTable } from "./components/PeopleTable";
import { ProfilesTable } from "./components/ProfilesTable";
import { MessagingTable } from "./components/MessagingTable";
import { ConversationsTable } from "./components/ConversationsTable";
import { FollowUpsTable } from "./components/FollowUpsTable";
import { AIContextTable } from "./components/AIContextTable";
import { TodosTab } from "./components/TodosTab";
import { EmailsTab } from "./components/EmailsTab";
import { ReportsTab } from "./components/ReportsTab";

type Tab = "companies" | "people" | "profiles" | "outreach" | "follow-ups" | "conversations" | "emails" | "ai-context" | "todos" | "reports";

const VALID_TABS: Tab[] = ["companies", "people", "profiles", "outreach", "follow-ups", "conversations", "emails", "ai-context", "todos", "reports"];

function isValidTab(value: string): value is Tab {
  return VALID_TABS.includes(value as Tab);
}

interface Metrics {
  messagesToday: number;
  connectionsWeek: number;
  companiesToday: number;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("companies");
  const [metrics, setMetrics] = useState<Metrics>({ messagesToday: 0, connectionsWeek: 0, companiesToday: 0 });

  // Sync tab state with URL ?tab= parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab && isValidTab(tab)) {
      setActiveTab(tab);
    }

    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab && isValidTab(tab)) {
        setActiveTab(tab);
      } else {
        setActiveTab("companies");
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleTabChange = useCallback((tab: Tab) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.pushState({}, "", url.toString());
  }, []);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch("/api/metrics", {
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "" },
      });
      if (res.ok) {
        setMetrics(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch metrics:", error);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    // Refresh metrics every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  return (
    <div className="min-h-screen bg-white p-6 font-sketch">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="sketch-box flex h-12 w-12 items-center justify-center bg-black text-xl font-bold text-white">
              P
            </div>
            <div>
              <h1 className="text-2xl font-bold">Papooga</h1>
              <p className="text-sm text-gray-600">LinkedIn Outreach Manager</p>
            </div>
          </div>
          <div className="flex gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold">{metrics.companiesToday}</div>
              <div className="text-xs text-gray-600">Companies Today</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{metrics.messagesToday}</div>
              <div className="text-xs text-gray-600">Messages Today</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{metrics.connectionsWeek}</div>
              <div className="text-xs text-gray-600">Connections (7d)</div>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => handleTabChange("companies")}
          className={`sketch-tab ${activeTab === "companies" ? "sketch-tab-active" : ""}`}
        >
          Companies
        </button>
        <button
          onClick={() => handleTabChange("people")}
          className={`sketch-tab ${activeTab === "people" ? "sketch-tab-active" : ""}`}
        >
          People
        </button>
        <button
          onClick={() => handleTabChange("profiles")}
          className={`sketch-tab ${activeTab === "profiles" ? "sketch-tab-active" : ""}`}
        >
          Profiles
        </button>
        <button
          onClick={() => handleTabChange("outreach")}
          className={`sketch-tab ${activeTab === "outreach" ? "sketch-tab-active" : ""}`}
        >
          Outreach
        </button>
        <button
          onClick={() => handleTabChange("follow-ups")}
          className={`sketch-tab ${activeTab === "follow-ups" ? "sketch-tab-active" : ""}`}
        >
          Follow-ups
        </button>
        <button
          onClick={() => handleTabChange("conversations")}
          className={`sketch-tab ${activeTab === "conversations" ? "sketch-tab-active" : ""}`}
        >
          Conversations
        </button>
        <button
          onClick={() => handleTabChange("emails")}
          className={`sketch-tab ${activeTab === "emails" ? "sketch-tab-active" : ""}`}
        >
          Emails
        </button>
        <button
          onClick={() => handleTabChange("ai-context")}
          className={`sketch-tab ${activeTab === "ai-context" ? "sketch-tab-active" : ""}`}
        >
          AI Context
        </button>
        <button
          onClick={() => handleTabChange("todos")}
          className={`sketch-tab ${activeTab === "todos" ? "sketch-tab-active" : ""}`}
        >
          Todos
        </button>
        <button
          onClick={() => handleTabChange("reports")}
          className={`sketch-tab ${activeTab === "reports" ? "sketch-tab-active" : ""}`}
        >
          Reports
        </button>
      </div>

      {/* Content */}
      <main>
        {activeTab === "companies" && <CompaniesTable />}
        {activeTab === "people" && <PeopleTable />}
        {activeTab === "profiles" && <ProfilesTable />}
        {activeTab === "outreach" && <MessagingTable />}
        {activeTab === "follow-ups" && <FollowUpsTable />}
        {activeTab === "conversations" && <ConversationsTable />}
        {activeTab === "emails" && <EmailsTab />}
        {activeTab === "ai-context" && <AIContextTable />}
        {activeTab === "todos" && <TodosTab />}
        {activeTab === "reports" && <ReportsTab />}
      </main>
    </div>
  );
}
