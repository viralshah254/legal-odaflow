import { useEffect, useMemo, useState } from "react";
import { AddinSession } from "../App";
import {
  getTemplateContent,
  listDraftLibraryTemplates,
  listFirmTemplates,
  type DraftLibraryTemplate,
} from "../../api/client";
import { replaceDocumentBody } from "../../word/document-ops";

interface Props {
  session: AddinSession;
}

export function DraftLibraryPage({ session }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [library, setLibrary] = useState<DraftLibraryTemplate[]>([]);
  const [firmTemplates, setFirmTemplates] = useState<DraftLibraryTemplate[]>([]);
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [lib, firm] = await Promise.all([
          listDraftLibraryTemplates(session.tenantId),
          listFirmTemplates(session.tenantId),
        ]);
        if (cancelled) return;
        setLibrary(lib);
        setFirmTemplates(Array.isArray(firm) ? firm : []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load templates");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session.tenantId]);

  const allTemplates = useMemo(() => {
    const byId = new Map<string, DraftLibraryTemplate>();
    for (const t of library) byId.set(t.id, { ...t, source: "SYSTEM" });
    for (const t of firmTemplates) {
      if (!byId.has(t.id)) byId.set(t.id, { ...t, source: t.source ?? "FIRM" });
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [library, firmTemplates]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allTemplates;
    return allTemplates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.practiceArea ?? "").toLowerCase().includes(q) ||
        (t.category ?? "").toLowerCase().includes(q),
    );
  }, [allTemplates, search]);

  const openTemplate = async (template: DraftLibraryTemplate) => {
    setOpeningId(template.id);
    setError(null);
    try {
      let content = template.content;
      if (!content?.trim()) {
        const full = await getTemplateContent(session.tenantId, template.id);
        content = full.content;
      }
      if (!content?.trim()) {
        throw new Error("Template has no content");
      }
      await replaceDocumentBody(content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open template");
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <h2 className="text-sm font-bold text-gray-800">Draft Library</h2>
        <p className="text-xs text-gray-500 mt-1">
          Firm-approved golden templates — open as a new document in one click.
        </p>
      </div>

      <input
        type="search"
        placeholder="Search templates…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border rounded-lg px-2 py-1.5 text-xs"
      />

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-2">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-gray-500 text-center py-6">Loading templates…</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-6">No templates found.</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((template) => (
            <li
              key={template.id}
              className="border rounded-lg p-3 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800 truncate">{template.name}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {[template.practiceArea, template.category, template.countryCode]
                      .filter(Boolean)
                      .join(" · ") || "General"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={openingId === template.id}
                  onClick={() => void openTemplate(template)}
                  className="shrink-0 text-[10px] font-medium px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {openingId === template.id ? "Opening…" : "Open"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
