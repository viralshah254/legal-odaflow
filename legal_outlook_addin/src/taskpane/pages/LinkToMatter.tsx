import { useState, useEffect } from "react";
import { listMatters, searchMatters, linkEmailToMatter, getEmailBody, type Matter } from "../../api/client";

export function LinkToMatter() {
  const [matters, setMatters] = useState<Matter[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [linked, setLinked] = useState<Matter | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMatters()
      .then(setMatters)
      .catch(() => setError("Failed to load matters"))
      .finally(() => setLoading(false));
  }, []);

  const handleSearch = async (query: string) => {
    setSearch(query);
    if (query.length < 2) return;
    try {
      const results = await searchMatters(query);
      setMatters(results);
    } catch {
      // keep existing list on search failure
    }
  };

  const handleLinkEmail = async (matter: Matter) => {
    setLinking(true);
    setError(null);
    try {
      const item = Office.context.mailbox.item as Office.MessageRead;
      const subject = item.subject ?? "";
      const from = (item.from as Office.EmailAddressDetails)?.emailAddress ?? "";

      let body = "";
      try {
        body = await getEmailBody();
      } catch {
        // best effort
      }

      await linkEmailToMatter(matter.id, {
        type: "EMAIL",
        title: subject,
        description: `Email from ${from}: ${subject}`,
        emailSubject: subject,
        emailFrom: from,
        emailBody: body.slice(0, 2000),
      });

      setLinked(matter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to link email");
    } finally {
      setLinking(false);
    }
  };

  const filtered = matters.filter((m) =>
    m.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-3 space-y-3">
      <div>
        <h3 className="text-sm font-bold text-gray-800">Link to Matter</h3>
        <p className="text-xs text-gray-500 mt-1">
          Append this email to an existing matter's timeline.
        </p>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {linked ? (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
          <p className="text-sm font-semibold text-emerald-700">Email linked</p>
          <p className="text-xs text-emerald-600 mt-1">{linked.title}</p>
        </div>
      ) : (
        <>
          <input
            type="search"
            placeholder="Search matters…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {loading ? (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {filtered.slice(0, 15).map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleLinkEmail(m)}
                  disabled={linking}
                  className="w-full text-left border rounded-lg px-3 py-2 hover:border-blue-400 hover:bg-blue-50 transition-colors disabled:opacity-50"
                >
                  <p className="text-xs font-medium text-gray-800 truncate">{m.title}</p>
                  {m.clientName && (
                    <p className="text-[10px] text-gray-500 truncate">{m.clientName}</p>
                  )}
                  <span className="text-[10px] text-gray-400">{m.status}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-xs text-gray-500 py-4">No matters found.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
