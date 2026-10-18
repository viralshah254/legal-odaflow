import { useState } from "react";
import { AddinSession } from "../App";
import { runResearch } from "../../api/client";

interface Props {
  session: AddinSession;
}

const COUNTRIES = [
  { code: "US", label: "United States" },
  { code: "IN", label: "India" },
  { code: "GB", label: "United Kingdom" },
  { code: "KE", label: "Kenya" },
  { code: "CA", label: "Canada" },
  { code: "AU", label: "Australia" },
];

export function ResearchPage({ session }: Props) {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("US");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const research = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const matterId = Office.context.document.settings.get("linked_matter_id") as
        | string
        | undefined;
      const res = await runResearch({
        query,
        countryCode: country,
        tenantId: session.tenantId,
        matterId: matterId || undefined,
      });
      setResult(res.outputMarkdown ?? JSON.stringify(res, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research failed");
    } finally {
      setLoading(false);
    }
  };

  const insertResult = () => {
    if (!result) return;
    Office.context.document.setSelectedDataAsync(
      result,
      { coercionType: Office.CoercionType.Text },
    );
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <h2 className="text-sm font-bold text-gray-800">Legal Research</h2>
        <p className="text-xs text-gray-500 mt-1">
          Run a legal research query without leaving Word.
        </p>
      </div>

      <div className="space-y-2">
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>

        <textarea
          rows={4}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. What are the notice requirements for termination under a commercial lease in New York?"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        onClick={research}
        disabled={loading || !query.trim()}
        className="w-full bg-blue-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Researching…" : "Run research"}
      </button>

      {result && (
        <div className="space-y-2">
          <div className="rounded-lg border bg-gray-50 p-3 max-h-64 overflow-y-auto">
            <p className="text-xs text-gray-700 whitespace-pre-wrap">{result}</p>
          </div>
          <button
            onClick={insertResult}
            className="w-full border border-blue-400 text-blue-700 rounded-lg px-3 py-2 text-sm hover:bg-blue-50"
          >
            Insert into document
          </button>
        </div>
      )}
    </div>
  );
}
