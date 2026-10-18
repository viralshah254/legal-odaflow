/**
 * Word.js document operations: read body, apply tracked changes, insert comments.
 */

export type RedlineChangeType = "replace" | "delete" | "insert";

export interface RedlineEditOp {
  id: string;
  changeType: RedlineChangeType;
  anchorText: string;
  originalText: string;
  proposedText: string;
  rationale: string;
  severity: string;
  sectionRef: string;
  paragraphIndex?: number;
  addComment: boolean;
}

export interface ApplyResult {
  applied: string[];
  failed: Array<{ id: string; reason: string }>;
}

export async function getDocumentText(): Promise<string> {
  return Word.run(async (context) => {
    const body = context.document.body;
    body.load("text");
    await context.sync();
    return body.text;
  });
}

export async function getSelectedText(): Promise<string> {
  return new Promise((resolve, reject) => {
    Office.context.document.getSelectedDataAsync(Office.CoercionType.Text, (res) => {
      if (res.status === Office.AsyncResultStatus.Succeeded) {
        resolve((res.value as string) ?? "");
      } else {
        reject(new Error(res.error?.message ?? "Failed to get selection"));
      }
    });
  });
}

export async function applyRedlineOps(ops: RedlineEditOp[]): Promise<ApplyResult> {
  return Word.run(async (context) => {
    context.document.changeTrackingMode = Word.ChangeTrackingMode.trackAll;

    const applied: string[] = [];
    const failed: Array<{ id: string; reason: string }> = [];

    for (const op of ops) {
      try {
        const searchTerm = op.anchorText || op.originalText.slice(0, 80);
        if (!searchTerm.trim()) {
          failed.push({ id: op.id, reason: "Empty anchor text" });
          continue;
        }

        const results = context.document.body.search(searchTerm, {
          matchCase: false,
          matchWholeWord: false,
        });
        results.load("items");
        await context.sync();

        if (results.items.length === 0) {
          failed.push({ id: op.id, reason: "Text not found in document" });
          continue;
        }
        if (results.items.length > 1) {
          failed.push({
            id: op.id,
            reason: "Ambiguous match — multiple occurrences; refine anchor",
          });
          continue;
        }

        const range = results.items[0];

        if (op.changeType === "delete") {
          range.delete();
        } else if (op.changeType === "insert") {
          range.insertText(op.proposedText, Word.InsertLocation.after);
        } else {
          range.insertText(op.proposedText, Word.InsertLocation.replace);
        }

        if (op.addComment && op.rationale) {
          range.insertComment(`Umbrella: ${op.rationale}`);
        }

        applied.push(op.id);
      } catch (err) {
        failed.push({
          id: op.id,
          reason: err instanceof Error ? err.message : "Apply failed",
        });
      }
    }

    await context.sync();
    return { applied, failed };
  });
}

export async function jumpToText(anchorText: string): Promise<boolean> {
  return Word.run(async (context) => {
    const results = context.document.body.search(anchorText.slice(0, 80), {
      matchCase: false,
    });
    results.load("items");
    await context.sync();

    if (results.items.length === 0) return false;

    results.items[0].select();
    await context.sync();
    return true;
  });
}

/** Replace entire document body with template content (Draft Library). */
export async function replaceDocumentBody(content: string): Promise<void> {
  return Word.run(async (context) => {
    context.document.body.clear();
    context.document.body.insertText(content, Word.InsertLocation.start);
    await context.sync();
  });
}
