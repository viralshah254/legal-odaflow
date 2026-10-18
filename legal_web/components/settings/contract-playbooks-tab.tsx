"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useTenant } from "@/lib/contexts/tenant-context";
import { useApiData } from "@/lib/hooks/use-api-data";
import {
  createContractPlaybook,
  deleteContractPlaybook,
  listContractPlaybooks,
  type ContractPlaybook,
} from "@/lib/api/contract-playbooks";

export function ContractPlaybooksTab() {
  const { activeTenantId } = useTenant();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    contractType: "contract",
    clauseType: "",
    description: "",
    preferredText: "",
    acceptableText: "",
    prohibitedPatterns: "",
    flaggedPatterns: "",
  });

  const { data: playbooks = [], isLoading } = useApiData(
    ["contract-playbooks", activeTenantId],
    {
      apiFn: () => listContractPlaybooks(activeTenantId!),
      enabled: !!activeTenantId,
    },
  );

  const handleCreate = async () => {
    if (!activeTenantId) return;
    setSaving(true);
    try {
      await createContractPlaybook(activeTenantId, {
        name: form.name,
        contractType: form.contractType,
        clauseType: form.clauseType,
        description: form.description || undefined,
        preferredText: form.preferredText || undefined,
        acceptableText: form.acceptableText || undefined,
        prohibitedPatterns: form.prohibitedPatterns
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        flaggedPatterns: form.flaggedPatterns
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      await queryClient.invalidateQueries({ queryKey: ["contract-playbooks", activeTenantId] });
      setCreateOpen(false);
      setForm({
        name: "",
        contractType: "contract",
        clauseType: "",
        description: "",
        preferredText: "",
        acceptableText: "",
        prohibitedPatterns: "",
        flaggedPatterns: "",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (playbook: ContractPlaybook) => {
    if (!activeTenantId) return;
    if (!confirm(`Deactivate rule "${playbook.name}"?`)) return;
    setDeletingId(playbook.id);
    try {
      await deleteContractPlaybook(activeTenantId, playbook.id);
      await queryClient.invalidateQueries({ queryKey: ["contract-playbooks", activeTenantId] });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Contract Rulebooks</h3>
          <p className="text-sm text-muted-foreground">
            Define preferred, fallback, and prohibited clause language for Word playbook review.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add rule
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : playbooks.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            No contract rules yet. Add rules for indemnification, termination, liability, etc.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {playbooks.map((pb) => (
            <Card key={pb.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{pb.name}</CardTitle>
                    <CardDescription>
                      {pb.contractType} · {pb.clauseType.replace(/_/g, " ")}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(pb)}
                    disabled={deletingId === pb.id}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              {pb.description && (
                <CardContent className="text-sm text-muted-foreground">{pb.description}</CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New contract rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="MSA — Liability cap"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Contract type</Label>
                <Input
                  value={form.contractType}
                  onChange={(e) => setForm({ ...form, contractType: e.target.value })}
                />
              </div>
              <div>
                <Label>Clause type</Label>
                <Input
                  value={form.clauseType}
                  onChange={(e) => setForm({ ...form, clauseType: e.target.value })}
                  placeholder="liability"
                />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
            <div>
              <Label>Preferred text</Label>
              <Textarea
                value={form.preferredText}
                onChange={(e) => setForm({ ...form, preferredText: e.target.value })}
                rows={3}
              />
            </div>
            <div>
              <Label>Acceptable / fallback text</Label>
              <Textarea
                value={form.acceptableText}
                onChange={(e) => setForm({ ...form, acceptableText: e.target.value })}
                rows={3}
              />
            </div>
            <div>
              <Label>Prohibited patterns (regex, one per line)</Label>
              <Textarea
                value={form.prohibitedPatterns}
                onChange={(e) => setForm({ ...form, prohibitedPatterns: e.target.value })}
                rows={2}
              />
            </div>
            <div>
              <Label>Flagged patterns (regex, one per line)</Label>
              <Textarea
                value={form.flaggedPatterns}
                onChange={(e) => setForm({ ...form, flaggedPatterns: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving || !form.name || !form.clauseType}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
