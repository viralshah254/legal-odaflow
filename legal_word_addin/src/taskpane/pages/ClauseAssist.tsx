import { useState } from "react";
import { AddinSession } from "../App";
import { runClauseAssist } from "../../api/client";

interface Props {
  session: AddinSession;
}

export function ClauseAssist({ session }: Props) {
  const [selectedText, setSelectedText] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getSelectedText = async () => {
    Office.context.document.getSelectedDataAsync(
      Office.CoercionType.Text,
      (res) => {
        if (res.status === Office.AsyncResultStatus.Succeeded) {
          setSelectedText(res.value as string);
        }
      },
    );
  };

  const analyse = async () => {
    if (!selectedText.trim()) {
      setError("Please select text in the document first.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const matterId =
        Office.context.document.settings.get("linked_matter_id") ?? undefined;

      const res = await runClauseAssist({
        selectedText,
        documentType: "CONTRACT",
        countryCode: "US",
        matterId,
        tenantId: session.tenantId,
      });

      const md = res.overallSummary ?? res.riskSummary ?? JSON.stringify(res, null, 2);
      setResult(md);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const insertClause = async () => {
    if (!result) return;
    Office.context.document.setSelectedDataAsync(
      result,
      { coercionType: Office.CoercionType.Text },
      (res) => {
        if (res.status !== Office.AsyncResultStatus.Succeeded) {
          alert("Failed to insert text: " + res.error.message);
        }
      },
    );
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <h2 className="text-sm font-bold text-gray-800">Clause Assist</h2>
        <p className="text-xs text-gray-500 mt-1">
          Select text in your document, then click "Get AI analysis".
        </p>
      </div>

      <div className="space-y-2">
        <button
          onClick={getSelectedText}
          className="w-full border rounded-lg px-3 py-2 text-sm text-blue-600 border-blue-300 hover:bg-blue-50"
        >
          Get selected text
        </button>

        {selectedText && (
          <div className="rounded-lg border bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500 font-medium mb-1">Selected text:</p>
            <p className="text-xs text-gray-700 line-clamp-4">{selectedText}</p>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      <button
        onClick={analyse}
        disabled={loading || !selectedText}
        className="w-full bg-blue-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Analysing…" : "Get AI analysis"}
      </button>

      {result && (
        <div className="space-y-3">
          <div className="rounded-lg border bg-amber-50 border-amber-200 p-3">
            <p className="text-xs font-semibold text-amber-800 mb-1">AI Analysis</p>
            <p className="text-xs text-gray-700 whitespace-pre-wrap">{result}</p>
          </div>
          <button
            onClick={insertClause}
            className="w-full border border-emerald-400 text-emerald-700 rounded-lg px-3 py-2 text-sm hover:bg-emerald-50"
          >
            Insert AI suggestion at cursor
          </button>
        </div>
      )}
    </div>
  );
}
