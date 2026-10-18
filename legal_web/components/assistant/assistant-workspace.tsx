"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Upload } from "lucide-react";
import { useTenant } from "@/lib/contexts/tenant-context";
import { useApiData } from "@/lib/hooks/use-api-data";
import { listPromptLibrary, type PromptLibraryEntry } from "@/lib/api/prompt-library";
import {
  createCopilotSession,
  listCopilotSessions,
  sendCopilotMessage,
  getCopilotSessionMessages,
  generateDeliverable,
  type CopilotSessionApi,
  type DeliverableType,
  type DeliverableResult,
} from "@/lib/api/assistant";
import { cn } from "@/lib/utils";

const DELIVERABLE_OPTIONS: { value: DeliverableType; label: string }[] = [
  { value: "key_issues_list", label: "Key Issues List" },
  { value: "clause_summary", label: "Clause Summary" },
  { value: "research_memo", label: "Research Memo" },
  { value: "redline_report", label: "Redline Report" },
];

export function AssistantWorkspace() {
  const { activeTenantId } = useTenant();
  const [sessions, setSessions] = useState<CopilotSessionApi[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [taskDefinition, setTaskDefinition] = useState("");
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [deliverableType, setDeliverableType] = useState<DeliverableType>("key_issues_list");
  const [deliverable, setDeliverable] = useState<DeliverableResult | null>(null);
  const [attachedText, setAttachedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: prompts = [] } = useApiData(
    ["prompt-library", activeTenantId],
    {
      apiFn: () => listPromptLibrary(activeTenantId!),
      enabled: !!activeTenantId,
    },
  );

  const loadSessions = useCallback(async () => {
    if (!activeTenantId) return;
    try {
      const list = await listCopilotSessions(activeTenantId);
      setSessions(list);
      if (!activeSessionId && list.length > 0) {
        setActiveSessionId(list[0].id);
      }
    } catch {
      setSessions([]);
    }
  }, [activeTenantId, activeSessionId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (!activeTenantId || !activeSessionId) return;
    getCopilotSessionMessages(activeTenantId, activeSessionId)
      .then((msgs) => {
        setMessages(msgs.map((m) => ({ role: m.role, content: m.content })));
      })
      .catch(() => {
        setMessages([]);
      });
  }, [activeTenantId, activeSessionId]);

  const handleNewSession = async () => {
    if (!activeTenantId) return;
    const session = await createCopilotSession(activeTenantId, {}, deliverableType);
    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(session.id);
    setMessages([]);
    setDeliverable(null);
  };

  const handleSend = async () => {
    if (!activeTenantId || !taskDefinition.trim()) return;
    setLoading(true);
    try {
      let sessionId = activeSessionId;
      if (!sessionId) {
        const session = await createCopilotSession(activeTenantId, {}, deliverableType);
        sessionId = session.id;
        setActiveSessionId(sessionId);
        setSessions((prev) => [session, ...prev]);
      }

      const res = await sendCopilotMessage(activeTenantId, {
        message: taskDefinition,
        sessionId,
      });

      setMessages((prev) => [
        ...prev,
        { role: "user", content: taskDefinition },
        { role: "assistant", content: res.message?.content ?? "" },
      ]);
      setTaskDefinition("");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDeliverable = async () => {
    if (!activeTenantId || !activeSessionId) return;
    setGenerating(true);
    try {
      const result = await generateDeliverable(activeTenantId, activeSessionId, {
        deliverableType,
        documentText: attachedText || undefined,
      });
      setDeliverable(result);
    } finally {
      setGenerating(false);
    }
  };

  const handlePromptSelect = (entry: PromptLibraryEntry) => {
    setTaskDefinition(entry.promptText);
    if (entry.deliverableType) {
      setDeliverableType(entry.deliverableType as DeliverableType);
    }
  };

  const handleFileUpload = async (file: File) => {
    const text = await file.text();
    setAttachedText(text.slice(0, 100_000));
  };

  if (!activeTenantId) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Loading workspace…
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4 p-4">
      {/* Session list */}
      <aside className="w-56 shrink-0 flex flex-col gap-2 border-r pr-4">
        <Button size="sm" onClick={handleNewSession} className="w-full">
          <Plus className="h-4 w-4 mr-1" />
          New session
        </Button>
        <div className="flex-1 overflow-y-auto space-y-1">
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSessionId(s.id)}
              className={cn(
                "w-full text-left text-xs px-2 py-2 rounded-lg truncate",
                activeSessionId === s.id ? "bg-primary/10 text-primary" : "hover:bg-muted",
              )}
            >
              Session {s.id.slice(-6)}
            </button>
          ))}
        </div>
      </aside>

      {/* Main chat + task */}
      <main className="flex-1 flex flex-col gap-4 min-w-0">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Task definition</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-1" />
                Upload file
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.doc,.docx,.pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileUpload(f);
                }}
              />
              {attachedText && (
                <span className="text-xs text-muted-foreground self-center">
                  Document attached ({Math.round(attachedText.length / 1000)}k chars)
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {prompts.slice(0, 4).map((p) => (
                <Button
                  key={p.id}
                  variant="secondary"
                  size="sm"
                  className="text-xs"
                  onClick={() => handlePromptSelect(p)}
                >
                  {p.title}
                </Button>
              ))}
            </div>

            <Textarea
              value={taskDefinition}
              onChange={(e) => setTaskDefinition(e.target.value)}
              placeholder="Describe your task — e.g. Review the attached MSA and prepare a Key Issues List"
              rows={4}
            />

            <div className="flex gap-2">
              <Button onClick={handleSend} disabled={loading || !taskDefinition.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
              </Button>
              <Select
                value={deliverableType}
                onValueChange={(v) => setDeliverableType(v as DeliverableType)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DELIVERABLE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={handleGenerateDeliverable}
                disabled={generating || !activeSessionId}
              >
                {generating ? "Generating…" : "Generate deliverable"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex-1 overflow-y-auto space-y-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "rounded-lg px-3 py-2 text-sm max-w-[90%]",
                m.role === "user" ? "bg-primary text-primary-foreground ml-auto" : "bg-muted",
              )}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Deliverable panel */}
      <aside className="w-80 shrink-0 border-l pl-4 flex flex-col">
        <h3 className="text-sm font-semibold mb-2">Deliverable</h3>
        <div className="flex-1 overflow-y-auto rounded-lg border bg-muted/30 p-3">
          {deliverable ? (
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-xs">
              {deliverable.content}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Generate a deliverable from your session — Key Issues List, clause summary, research
              memo, or redline report.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
