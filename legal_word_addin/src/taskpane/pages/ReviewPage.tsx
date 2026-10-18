import { useState } from "react";
import { AddinSession } from "../App";
import {
  runInlineReview,
  exportRedlineOps,
  type InlineReviewResult,
  type RedlineEditOp,
} from "../../api/client";
import {
  getDocumentText,
  applyRedlineOps,
  jumpToText,
} from "../../word/document-ops";

interface Props {
  session: AddinSession;
}

export function ReviewPage({ session }: Props) {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InlineReviewResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [applyStatus, setApplyStatus] = useState<string | null>(null);

  const matterId =
    Office.context.document.settings.get("linked_matter_id") ?? undefined;

  const runReview = async () => {
    setLoading(true);
    setError(null);
    setApplyStatus(null);

    try {
      const text = await getDocumentText();
      if (!text.trim()) {
        setError("Document is empty.");
        return;
      }

      const res = await runInlineReview({
        rawText: text,
        matterId,
        documentType: "contract",
        title: "Word review",
        tenantId: session.tenantId,
      });

      setResult(res);
      setSelected(new Set(res.editOps.map((o) => o.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applySelected = async (all: boolean) => {
    if (!result) return;
    setApplying(true);
    setApplyStatus(null);

    try {
      let ops: RedlineEditOp[] = result.editOps;
      if (!all) {
        ops = ops.filter((o) => selected.has(o.id));
      }

      if (result.workspaceId && ops.length === 0) {
        const exported = await exportRedlineOps(result.workspaceId, session.tenantId);
        ops = all ? exported.editOps : exported.editOps.filter((o) => selected.has(o.id));
      }

      const applyResult = await applyRedlineOps(ops);
      setApplyStatus(
        `Applied ${applyResult.applied.length} change(s)` +
          (applyResult.failed.length ? `, ${applyResult.failed.length} failed` : ""),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Apply failed");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <h2 className="text-sm font-bold text-gray-800">Review & Redline</h2>
        <p className="text-xs text-gray-500 mt-1">
          AI review with native Word tracked changes.
        </p>
      </div>

      <button
        onClick={runReview}
        disabled={loading}
        className="w-full bg-blue-600 text-white rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-50"
      >
        {loading ? "Reviewing…" : "Run AI Review"}
      </button>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {applyStatus && <p className="text-xs text-green-700">{applyStatus}</p>}

      {result && (
        <>
          <div className="flex gap-2 text-[10px]">
            <span className="px-2 py-1 rounded bg-red-100 text-red-700">
              Risk {result.riskScore}
            </span>
            <span className="px-2 py-1 rounded bg-gray-100">
              {result.findings.length} findings
            </span>
            <span className="px-2 py-1 rounded bg-gray-100">
              {result.editOps.length} redlines
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => applySelected(false)}
              disabled={applying || selected.size === 0}
              className="flex-1 border border-blue-500 text-blue-700 rounded-lg px-2 py-1.5 text-[11px] disabled:opacity-50"
            >
              Apply selected
            </button>
            <button
              onClick={() => applySelected(true)}
              disabled={applying}
              className="flex-1 bg-blue-600 text-white rounded-lg px-2 py-1.5 text-[11px] disabled:opacity-50"
            >
              Apply all
            </button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {result.editOps.map((op) => (
              <div
                key={op.id}
                className="border rounded-lg p-2 text-[11px] space-y-1"
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selected.has(op.id)}
                    onChange={() => toggleSelect(op.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{op.sectionRef}</p>
                    <p className="text-gray-500 line-clamp-2">{op.rationale}</p>
                  </div>
                  <button
                    onClick={() => jumpToText(op.anchorText)}
                    className="text-blue-600 text-[10px] shrink-0"
                  >
                    Jump
                  </button>
                </div>
                <p className="text-red-600 line-through">{op.originalText.slice(0, 100)}…</p>
                <p className="text-green-700">{op.proposedText.slice(0, 100)}…</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
