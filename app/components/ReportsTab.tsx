"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function ReportsTab() {
  const [startDate, setStartDate] = useState(() => {
    // Default to 30 days ago
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"formatted" | "raw">("formatted");

  const generateReport = async () => {
    setGenerating(true);
    setError(null);
    setReport(null);

    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "",
        },
        body: JSON.stringify({
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate + "T23:59:59").toISOString(),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setReport(data.markdown);
      } else {
        setError(data.error || "Failed to generate report");
      }
    } catch (err) {
      console.error("Report generation error:", err);
      setError("Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  const downloadReport = () => {
    if (!report) return;

    const blob = new Blob([report], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `outreach-report-${startDate}-to-${endDate}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async () => {
    if (!report) return;

    try {
      await navigator.clipboard.writeText(report);
      alert("Report copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy:", err);
      alert("Failed to copy to clipboard");
    }
  };

  // Quick date presets
  const setPreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
  };

  return (
    <div>
      {/* Date Selection */}
      <div className="mb-6 p-4 border-2 border-black rounded">
        <h3 className="font-bold mb-4">Generate Report</h3>

        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-bold mb-1">Start Date</label>
            <input
              type="date"
              className="sketch-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-1">End Date</label>
            <input
              type="date"
              className="sketch-input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <button
              className="sketch-btn text-xs"
              onClick={() => setPreset(7)}
            >
              Last 7 days
            </button>
            <button
              className="sketch-btn text-xs"
              onClick={() => setPreset(30)}
            >
              Last 30 days
            </button>
            <button
              className="sketch-btn text-xs"
              onClick={() => setPreset(90)}
            >
              Last 90 days
            </button>
          </div>

          <button
            className="sketch-btn sketch-btn-primary"
            onClick={generateReport}
            disabled={generating}
          >
            {generating ? "Generating..." : "Generate Report"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-100 border-2 border-red-500 rounded text-red-700">
          {error}
        </div>
      )}

      {/* Report Display */}
      {report && (
        <div className="border-2 border-black rounded">
          {/* Actions Bar */}
          <div className="flex justify-between items-center p-3 border-b-2 border-black bg-gray-50">
            <div className="flex items-center gap-4">
              <span className="font-bold">Generated Report</span>
              <div className="flex gap-1">
                <button
                  className={`px-2 py-1 text-xs rounded ${
                    viewMode === "formatted"
                      ? "bg-black text-white"
                      : "bg-gray-200 text-black"
                  }`}
                  onClick={() => setViewMode("formatted")}
                >
                  Formatted
                </button>
                <button
                  className={`px-2 py-1 text-xs rounded ${
                    viewMode === "raw"
                      ? "bg-black text-white"
                      : "bg-gray-200 text-black"
                  }`}
                  onClick={() => setViewMode("raw")}
                >
                  Raw Markdown
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="sketch-btn text-sm" onClick={copyToClipboard}>
                Copy to Clipboard
              </button>
              <button
                className="sketch-btn sketch-btn-primary text-sm"
                onClick={downloadReport}
              >
                Download .md
              </button>
            </div>
          </div>

          {/* Report Content */}
          <div className="p-6 max-h-[70vh] overflow-y-auto bg-white">
            {viewMode === "formatted" ? (
              <div className="prose prose-sm max-w-none prose-headings:font-bold prose-headings:text-black prose-h1:text-2xl prose-h1:border-b prose-h1:pb-2 prose-h2:text-xl prose-h2:mt-8 prose-h3:text-lg prose-h3:mt-6 prose-p:text-black prose-table:border-collapse prose-th:border prose-th:border-gray-300 prose-th:bg-gray-100 prose-th:p-2 prose-th:text-black prose-td:border prose-td:border-gray-300 prose-td:p-2 prose-td:text-black prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:p-4 prose-pre:rounded prose-code:bg-gray-900 prose-code:text-gray-100 prose-code:px-1 prose-code:rounded prose-blockquote:border-l-4 prose-blockquote:border-blue-400 prose-blockquote:bg-blue-50 prose-blockquote:pl-4 prose-blockquote:py-2 prose-blockquote:not-italic prose-blockquote:text-black prose-strong:text-black prose-hr:my-8 prose-li:text-black">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {report}
                </ReactMarkdown>
              </div>
            ) : (
              <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
                {report}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!report && !generating && !error && (
        <div className="sketch-empty">
          Select a date range and click &quot;Generate Report&quot; to create an outreach report.
          <br />
          <span className="text-sm text-gray-500 mt-2 block">
            Reports include pipeline metrics, profiles, templates with stats, and all conversations.
          </span>
        </div>
      )}
    </div>
  );
}
