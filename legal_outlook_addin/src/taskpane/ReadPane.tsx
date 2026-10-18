import React, { useState } from "react";
import { EmailToMatter } from "./pages/EmailToMatter";
import { LinkToMatter } from "./pages/LinkToMatter";
import AssistantPage from "./pages/AssistantPage";
import NarrativesPage from "./pages/NarrativesPage";

type Tab = "assistant" | "narratives" | "create" | "link";

function ReadPane() {
  const [tab, setTab] = useState<Tab>("assistant");

  return (
    <div className="flex flex-col h-screen bg-white text-sm">
      <div className="flex border-b bg-gray-50 shrink-0">
        <button
          onClick={() => setTab("assistant")}
          className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
            tab === "assistant"
              ? "text-blue-600 border-b-2 border-blue-600 bg-white"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Assistant
        </button>
        <button
          onClick={() => setTab("narratives")}
          className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
            tab === "narratives"
              ? "text-blue-600 border-b-2 border-blue-600 bg-white"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Narratives
        </button>
        <button
          onClick={() => setTab("create")}
          className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
            tab === "create"
              ? "text-blue-600 border-b-2 border-blue-600 bg-white"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Create Matter
        </button>
        <button
          onClick={() => setTab("link")}
          className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
            tab === "link"
              ? "text-blue-600 border-b-2 border-blue-600 bg-white"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Link
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === "assistant" && <AssistantPage />}
        {tab === "narratives" && <NarrativesPage />}
        {tab === "create" && <EmailToMatter />}
        {tab === "link" && <LinkToMatter />}
      </div>
    </div>
  );
}

export default ReadPane;
