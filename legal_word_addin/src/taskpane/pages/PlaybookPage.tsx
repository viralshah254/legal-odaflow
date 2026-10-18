import { useState } from "react";
import { AddinSession } from "../App";
import {
  comparePlaybooksInline,
  type PlaybookCompareResult,
  type PlaybookSummary,
} from "../../api/client";
import { getDocumentText, applyRedlineOps } from "../../word/document-ops";

interface Props {
  session: AddinSession;
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  prohibited: { label: "Unacceptable", className: "bg-red-100 text-red-700" },
  flagged: { label: "Fallback", className: "bg-orange-100 text-orange-700" },
  acceptable: { label: "Fallback", className: "bg-orange-100 text-orange-700" },
  preferred: { label: "Preferred", className: "bg-green-100 text-green-700" },
  missing: { label: "Missing", className: "bg-gray-200 text-gray-700" },
};

export function PlaybookPage({ session }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<PlaybookCompareResult[]>([]);
  const [summary, setSummary] = useState<PlaybookSummary | null>(null);
  const [documentType, setDocumentType] = useState("contract");

  const runPlaybookReview = async () => {
    setLoading(true);
    setError(null);

    try {
      const text = await getDocumentText();
      const res = await comparePlaybooksInline({
        rawText: text,
        documentType,
        tenantId: session.tenantId,
      });
      setResults(res.results);
      setSummary(res.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Playbook review failed");
    } finally {
      setLoading(false);
    }
  };

  const applyFallback = async (item: PlaybookCompareResult) => {
    if (!item.suggestedReplacement) return;
    await applyRedlineOps([
      {
        id: item.clauseType,
        changeType: "replace",
        anchorText: item.matchedText?.slice(0, 80) ?? item.clauseType,
        originalText: item.matchedText ?? "",
        proposedText: item.suggestedReplacement,
        rationale: item.issue ?? "Playbook fallback language",
        severity: "high",
        sectionRef: item.clauseType,
        addComment: true,
      },
    ]);
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <h2 className="text-sm font-bold text-gray-800">Playbook</h2>
        <p className="text-xs text-gray-500 mt-1">
          Compare against your firm rulebook.
        </p>
      </div>

      <select
        value={documentType}
        onChange={(e) => setDocumentType(e.target.value)}
        className="w-full border rounded-lg px-2 py-1.5 text-xs"
      >
        <option value="contract">Contract</option>
        <option value="msa">MSA</option>
        <option value="nda">NDA</option>
        <option value="employment">Employment</option>
      </select>

      <button
        onClick={runPlaybookReview}
        disabled={loading}
        className="w-full bg-blue-600 text-white rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-50"
      >
        {loading ? "Checking…" : "Review against playbook"}
      </button>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {summary && (
        <div className="grid grid-cols-3 gap-1 text-[10px] text-center">
          <div className="rounded bg-red-50 p-2">
            <p className="font-bold text-red-700">{summary.unacceptable}</p>
            <p className="text-red-600">Unacceptable</p>
          </div>
          <div className="rounded bg-orange-50 p-2">
            <p className="font-bold text-orange-700">{summary.fallback}</p>
            <p className="text-orange-600">Fallback</p>
          </div>
          <div className="rounded bg-green-50 p-2">
            <p className="font-bold text-green-700">{summary.preferred}</p>
            <p className="text-green-600">Preferred</p>
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-72 overflow-y-auto">
        {results.map((item) => {
          const meta = STATUS_LABEL[item.status] ?? STATUS_LABEL.acceptable;
          return (
            <div key={`${item.clauseType}-${item.playbookId}`} className="border rounded-lg p-2 text-[11px]">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium capitalize">{item.clauseType.replace(/_/g, " ")}</p>
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${meta.className}`}>
                  {meta.label}
                </span>
              </div>
              {item.issue && <p className="text-gray-500 mt-1">{item.issue}</p>}
              {item.suggestedReplacement && (
                <button
                  onClick={() => applyFallback(item)}
                  className="mt-2 text-blue-600 text-[10px] font-medium"
                >
                  Apply fallback language →
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
