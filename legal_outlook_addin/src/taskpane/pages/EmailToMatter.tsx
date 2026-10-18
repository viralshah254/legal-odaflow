import { useState, useEffect } from "react";
import { extractEmailData, createMatterFromEmail, getEmailBody, type ExtractedEmailData } from "../../api/client";

interface EmailContext {
  subject: string;
  from: string;
  body: string;
}

export function EmailToMatter() {
  const [emailCtx, setEmailCtx] = useState<EmailContext | null>(null);
  const [extracted, setExtracted] = useState<ExtractedEmailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Office.onReady(() => {
      const item = Office.context.mailbox.item as Office.MessageRead;
      getEmailBody()
        .then((body) => {
          setEmailCtx({
            subject: item.subject ?? "",
            from: (item.from as Office.EmailAddressDetails)?.emailAddress ?? "",
            body,
          });
        })
        .catch(() => {
          setEmailCtx({
            subject: item.subject ?? "",
            from: (item.from as Office.EmailAddressDetails)?.emailAddress ?? "",
            body: "",
          });
        });
    });
  }, []);

  const handleExtract = async () => {
    if (!emailCtx) return;
    setLoading(true);
    setError(null);
    try {
      const data = await extractEmailData(emailCtx.body, emailCtx.subject);
      setExtracted(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to extract matter details");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMatter = async () => {
    if (!extracted || !emailCtx) return;
    setLoading(true);
    setError(null);
    try {
      await createMatterFromEmail({
        title: extracted.summary.slice(0, 100) || emailCtx.subject,
        clientName: extracted.clientName || emailCtx.from,
        clientEmail: extracted.clientEmail || emailCtx.from,
        jurisdiction: extracted.jurisdiction,
        description: extracted.summary,
        emailSubject: emailCtx.subject,
        emailBody: emailCtx.body,
      });
      setCreated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create matter");
    } finally {
      setLoading(false);
    }
  };

  const urgencyColor = {
    LOW: "text-green-600",
    MEDIUM: "text-amber-600",
    HIGH: "text-red-600",
  };

  return (
    <div className="p-3 space-y-3">
      <div>
        <h3 className="text-sm font-bold text-gray-800">Create Matter from Email</h3>
        {emailCtx && (
          <p className="text-xs text-gray-500 mt-1 truncate">From: {emailCtx.from}</p>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {created ? (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
          <p className="text-sm font-semibold text-emerald-700">Matter created</p>
          <p className="text-xs text-emerald-600 mt-1">{extracted?.summary?.slice(0, 80)}</p>
        </div>
      ) : extracted ? (
        <div className="space-y-2">
          <div className="rounded-lg border bg-gray-50 p-2.5 space-y-1.5">
            <p className="text-xs font-semibold text-gray-700 mb-1">Extracted details</p>
            <p className="text-xs">
              <span className="text-gray-500">Issue: </span>
              {extracted.issueType}
            </p>
            <p className="text-xs">
              <span className="text-gray-500">Parties: </span>
              {extracted.parties.join(", ")}
            </p>
            <p className="text-xs">
              <span className="text-gray-500">Jurisdiction: </span>
              {extracted.jurisdiction}
            </p>
            <p className="text-xs">
              <span className="text-gray-500">Urgency: </span>
              <span className={urgencyColor[extracted.urgency]}>{extracted.urgency}</span>
            </p>
            {extracted.summary && (
              <p className="text-xs text-gray-600 mt-2 line-clamp-3">{extracted.summary}</p>
            )}
          </div>
          <button
            onClick={handleCreateMatter}
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create matter"}
          </button>
        </div>
      ) : (
        <button
          onClick={handleExtract}
          disabled={loading || !emailCtx}
          className="w-full bg-blue-600 text-white rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-50"
        >
          {loading ? "Extracting…" : "Extract matter details"}
        </button>
      )}
    </div>
  );
}
