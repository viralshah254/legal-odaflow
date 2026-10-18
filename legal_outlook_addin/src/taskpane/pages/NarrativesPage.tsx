import { useEffect, useState } from "react";
import {
  generateEmailNarratives,
  getEmailBody,
  getEmailSubject,
  type EmailNarrative,
} from "../../api/client";

interface Props {
  matterId?: string;
}

export default function NarrativesPage({ matterId }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [narratives, setNarratives] = useState<EmailNarrative[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [subject, setSubject] = useState("");

  useEffect(() => {
    void getEmailSubject().then(setSubject).catch(() => setSubject(""));
  }, []);

  const generate = async (saveSuggestions: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const [subj, body] = await Promise.all([getEmailSubject(), getEmailBody()]);
      const result = await generateEmailNarratives({
        subject: subj,
        body,
        matterId,
        saveSuggestions,
      });
      setNarratives(result.narratives);
      setSavedIds(result.savedSuggestionIds ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate narratives");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <h2 className="text-sm font-bold text-gray-800">Narratives</h2>
        <p className="text-xs text-gray-500 mt-1">
          Turn email activity into billable time descriptions — like Lucio Narratives.
        </p>
        {subject && (
          <p className="text-[10px] text-gray-400 mt-1 truncate" title={subject}>
            {subject}
          </p>
        )}
      </div>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-2">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => void generate(false)}
          className="flex-1 text-xs font-medium py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? "Analyzing…" : "Preview"}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void generate(true)}
          className="flex-1 text-xs font-medium py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Save to timesheet
        </button>
      </div>

      {savedIds.length > 0 && (
        <p className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg p-2">
          {savedIds.length} suggestion{savedIds.length === 1 ? "" : "s"} saved — approve in Umbrella
          Time.
        </p>
      )}

      {narratives.length > 0 && (
        <ul className="space-y-2">
          {narratives.map((n) => (
            <li key={n.id} className="border rounded-lg p-3 bg-gray-50">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] font-medium uppercase text-gray-500">
                  {n.activityType}
                </span>
                <span className="text-xs font-semibold text-gray-700">{n.minutes} min</span>
              </div>
              <p className="text-xs text-gray-800 leading-relaxed">{n.narrative}</p>
            </li>
          ))}
        </ul>
      )}

      {!loading && narratives.length === 0 && (
        <p className="text-xs text-gray-500 text-center py-4">
          Open an email and tap Preview to see suggested billable narratives.
        </p>
      )}
    </div>
  );
}
