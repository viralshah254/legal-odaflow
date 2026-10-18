import { useState } from "react";
import { AddinSession } from "../App";
import { draftAmendments, type DraftAmendment, type RedlineEditOp } from "../../api/client";
import { getDocumentText, applyRedlineOps } from "../../word/document-ops";

interface Props {
  session: AddinSession;
}

export function CopilotPage({ session }: Props) {
  const [instruction, setInstruction] = useState("");
  const [amendments, setAmendments] = useState<DraftAmendment[]>([]);
  const [editOps, setEditOps] = useState<RedlineEditOp[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const matterId =
    Office.context.document.settings.get("linked_matter_id") ?? undefined;

  const generate = async () => {
    const text = instruction.trim();
    if (!text || loading) return;

    setLoading(true);
    setError(null);
    setStatus(null);
    setAmendments([]);
    setEditOps([]);

    try {
      const documentText = await getDocumentText();
      const res = await draftAmendments({
        documentText,
        instruction: text,
        matterId,
        countryCode: "US",
        tenantId: session.tenantId,
      });
      setAmendments(res.amendments);
      setEditOps(res.editOps);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const applyOne = async (op: RedlineEditOp) => {
    const result = await applyRedlineOps([op]);
    setStatus(`Applied ${result.applied.length}, failed ${result.failed.length}`);
  };

  const applyAll = async () => {
    const result = await applyRedlineOps(editOps);
    setStatus(`Applied ${result.applied.length}, failed ${result.failed.length}`);
  };

  return (
    <div className="flex flex-col h-full p-4 space-y-3">
      <div>
        <h2 className="text-sm font-bold text-gray-800">AI Drafting</h2>
        <p className="text-xs text-gray-500 mt-1">
          Edit clauses grounded in your open document.
        </p>
      </div>

      <textarea
        rows={3}
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder="e.g. Edit indemnification, termination, and data protection"
        className="w-full border rounded-lg px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {error && <p className="text-xs text-red-600">{error}</p>}
      {status && <p className="text-xs text-green-700">{status}</p>}

      <button
        onClick={generate}
        disabled={loading || !instruction.trim()}
        className="w-full bg-blue-600 text-white rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-50"
      >
        {loading ? "Generating…" : "Generate amendments"}
      </button>

      {amendments.length > 0 && (
        <>
          <button
            onClick={applyAll}
            className="w-full border border-blue-500 text-blue-700 rounded-lg px-3 py-1.5 text-xs"
          >
            Apply all as tracked changes
          </button>

          <div className="flex-1 overflow-y-auto space-y-2">
            {amendments.map((a, i) => (
              <div key={a.id} className="border rounded-lg p-2 text-[11px] space-y-1">
                <p className="font-medium">{a.clauseLabel}</p>
                <p className="text-gray-500">{a.rationale}</p>
                <p className="text-red-600 line-through">{a.originalText.slice(0, 80)}…</p>
                <p className="text-green-700">{a.proposedText.slice(0, 80)}…</p>
                {editOps[i] && (
                  <button
                    onClick={() => applyOne(editOps[i])}
                    className="text-blue-600 text-[10px] font-medium"
                  >
                    Apply →
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
