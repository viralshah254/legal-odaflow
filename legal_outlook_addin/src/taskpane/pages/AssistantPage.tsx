import React, { useEffect, useState } from "react";
import {
  analyzeEmailContext,
  generateDraftReply,
  getEmailBody,
  getEmailSubject,
  getEmailFrom,
  insertDraftReplyHtml,
  type EmailContextResponse,
  type SuggestedAction,
} from "../api/client";

function AssistantPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<EmailContextResponse | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [replyDraft, setReplyDraft] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadContext();
  }, []);

  const loadContext = async () => {
    setLoading(true);
    setError(null);
    try {
      const subject = await getEmailSubject();
      const body = await getEmailBody();
      const res = await analyzeEmailContext({ subject, body });
      setContext(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load email");
    } finally {
      setLoading(false);
    }
  };

  const runAction = async (action: SuggestedAction) => {
    setActionLoading(action.id);
    setError(null);
    try {
      const subject = await getEmailSubject();
      const body = await getEmailBody();

      if (action.type === "summarize") {
        setReplyDraft(context?.summary ?? "No summary available.");
        return;
      }

      if (action.type === "cross_check") {
        const lines = (context?.crossChecks ?? []).map(
          (c) =>
            `${c.name}: ${c.foundInMatter ? "Found" : "Not found"}${c.documentTitle ? ` (${c.documentTitle})` : ""}`,
        );
        setReplyDraft(lines.length ? lines.join("\n") : "No agreements referenced.");
        return;
      }

      const result = await generateDraftReply({
        emailBody: body,
        emailSubject: subject,
        instruction: action.prompt,
      });
      setReplyDraft(result.draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAsk = async () => {
    if (!chatInput.trim()) return;
    setActionLoading("ask");
    try {
      const subject = await getEmailSubject();
      const body = await getEmailBody();
      const result = await generateDraftReply({
        emailBody: body,
        emailSubject: subject,
        instruction: chatInput,
      });
      setReplyDraft(result.draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ask failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleInsert = async () => {
    if (!replyDraft) return;
    await insertDraftReplyHtml(replyDraft.replace(/\n/g, "<br/>"));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-xs text-gray-500">
        Loading email context…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-3 space-y-3">
      <div>
        <p className="text-sm font-semibold text-gray-800">Hi, what&apos;s your move?</p>
        {context?.summary && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-3">{context.summary}</p>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="space-y-2">
        {(context?.suggestedActions ?? []).map((action) => (
          <button
            key={action.id}
            onClick={() => runAction(action)}
            disabled={!!actionLoading}
            className="w-full text-left border rounded-lg px-3 py-2 text-xs hover:bg-blue-50 disabled:opacity-50"
          >
            {actionLoading === action.id ? "Working…" : action.label}
          </button>
        ))}
      </div>

      {context?.crossChecks && context.crossChecks.length > 0 && (
        <div className="border rounded-lg p-2 space-y-1">
          <p className="text-[10px] font-medium text-gray-600">Agreement cross-check</p>
          {context.crossChecks.map((c) => (
            <p key={c.name} className="text-[10px] text-gray-500">
              {c.name}: {c.foundInMatter ? "✓ in matter" : "✗ not found"}
            </p>
          ))}
        </div>
      )}

      <div className="mt-auto space-y-2 border-t pt-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            placeholder="Ask Umbrella…"
            className="flex-1 border rounded-lg px-2 py-1.5 text-xs"
          />
          <button
            onClick={handleAsk}
            disabled={actionLoading === "ask"}
            className="bg-blue-600 text-white rounded-lg px-3 py-1.5 text-xs disabled:opacity-50"
          >
            Ask
          </button>
        </div>

        {replyDraft && (
          <div className="space-y-2">
            <div className="rounded-lg border bg-gray-50 p-2 max-h-40 overflow-y-auto">
              <p className="text-xs whitespace-pre-wrap">{replyDraft}</p>
            </div>
            <button
              onClick={handleInsert}
              className="w-full border border-blue-400 text-blue-700 rounded-lg px-3 py-1.5 text-xs"
            >
              Insert into reply
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AssistantPage;
