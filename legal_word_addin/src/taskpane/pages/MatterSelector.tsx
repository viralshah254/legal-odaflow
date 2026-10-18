import { useState, useEffect } from "react";
import { AddinSession } from "../App";
import { listMatters } from "../../api/client";

interface Matter {
  id: string;
  title: string;
  status: string;
  client?: { name: string };
}

interface Props {
  session: AddinSession;
}

export function MatterSelector({ session }: Props) {
  const [matters, setMatters] = useState<Matter[]>([]);
  const [loading, setLoading] = useState(true);
  const [linked, setLinked] = useState<Matter | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    listMatters(session.tenantId)
      .then((data) => setMatters(data.items ?? data ?? []))
      .catch(() => setMatters([]))
      .finally(() => setLoading(false));
  }, [session.tenantId]);

  const filtered = matters.filter((m) =>
    m.title.toLowerCase().includes(search.toLowerCase()),
  );

  const linkMatter = async (matter: Matter) => {
    setLinked(matter);
    // Store in Office document settings (persists with the document)
    Office.context.document.settings.set("linked_matter_id", matter.id);
    Office.context.document.settings.set("linked_matter_title", matter.title);
    await new Promise<void>((res, rej) =>
      Office.context.document.settings.saveAsync((r) =>
        r.status === Office.AsyncResultStatus.Succeeded ? res() : rej(r.error),
      ),
    );
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <h2 className="text-sm font-bold text-gray-800">Link to Matter</h2>
        <p className="text-xs text-gray-500 mt-1">
          Link this document to a matter for AI context and filing.
        </p>
      </div>

      {linked && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs font-semibold text-emerald-700">Linked</p>
          <p className="text-sm font-medium text-emerald-800">{linked.title}</p>
          {linked.client && (
            <p className="text-xs text-emerald-600">{linked.client.name}</p>
          )}
          <button
            onClick={() => setLinked(null)}
            className="mt-2 text-xs text-emerald-600 underline"
          >
            Change
          </button>
        </div>
      )}

      {!linked && (
        <>
          <input
            type="search"
            placeholder="Search matters…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="spinner" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-xs text-gray-500 py-8">No matters found.</p>
          ) : (
            <div className="space-y-2">
              {filtered.slice(0, 15).map((m) => (
                <button
                  key={m.id}
                  onClick={() => linkMatter(m)}
                  className="w-full text-left border rounded-lg px-3 py-2.5 hover:border-blue-400 hover:bg-blue-50 transition-colors"
                >
                  <p className="text-sm font-medium text-gray-800 truncate">{m.title}</p>
                  {m.client && (
                    <p className="text-xs text-gray-500 truncate">{m.client.name}</p>
                  )}
                  <span
                    className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full ${
                      m.status === "OPEN"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {m.status}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
