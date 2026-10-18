import React, { useState } from "react";
import { generateDraftReply, getEmailBody, insertDraftReplyHtml } from "../api/client";

const TONE_PRESETS = [
  { id: "formal_decline", label: "Formal decline", tone: "formal and firm" },
  { id: "counter", label: "Counter-proposal", tone: "collaborative but assertive" },
  { id: "clarify", label: "Request clarification", tone: "professional and inquisitive" },
];

function ComposePane() {
  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState(TONE_PRESETS[0].tone);
  const [draft, setDraft] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateDraft = async (instruction?: string, selectedTone?: string) => {
    const text = instruction ?? prompt;
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setDraft(null);

    try {
      let emailBody = "";
      try {
        emailBody = await getEmailBody();
      } catch {
        // compose pane — no existing body
      }

      const result = await generateDraftReply({
        emailBody,
        emailSubject: text,
        instruction: text,
        tone: selectedTone ?? tone,
      });
      setDraft(result.draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Draft failed");
    } finally {
      setLoading(false);
    }
  };

  const handleInsertDraft = async () => {
    if (!draft) return;
    try {
      await insertDraftReplyHtml(draft.replace(/\n/g, "<br/>"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to insert");
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white p-3 space-y-3">
      <div>
        <h3 className="text-sm font-bold text-gray-800">AI Draft Reply</h3>
        <p className="text-xs text-gray-500 mt-1">
          Thread context is included when replying.
        </p>
      </div>

      <div className="flex flex-wrap gap-1">
        {TONE_PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setTone(p.tone);
              handleGenerateDraft(prompt || p.label, p.tone);
            }}
            className="text-[10px] border rounded px-2 py-1 hover:bg-blue-50"
          >
            {p.label}
          </button>
        ))}
      </div>

      <textarea
        rows={3}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="e.g. Decline the offer politely but leave room for negotiation"
        className="w-full border rounded-lg px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        onClick={() => handleGenerateDraft()}
        disabled={loading || !prompt.trim()}
        className="w-full bg-blue-600 text-white rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-50"
      >
        {loading ? "Drafting…" : "Generate draft"}
      </button>

      {draft && (
        <div className="space-y-2">
          <div className="rounded-lg border bg-gray-50 p-3 max-h-48 overflow-y-auto">
            <p className="text-xs text-gray-700 whitespace-pre-wrap">{draft}</p>
          </div>
          <button
            onClick={handleInsertDraft}
            className="w-full border border-blue-400 text-blue-700 rounded-lg px-3 py-2 text-xs hover:bg-blue-50"
          >
            Insert into email
          </button>
        </div>
      )}
    </div>
  );
}

export default ComposePane;
