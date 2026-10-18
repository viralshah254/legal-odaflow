"use client";

import { AssistantWorkspace } from "@/components/assistant/assistant-workspace";

export default function AssistantPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4">
        <h1 className="text-2xl font-bold">Assistant</h1>
        <p className="text-sm text-muted-foreground">
          Review files, take notes, and turn them into deliverables.
        </p>
      </div>
      <AssistantWorkspace />
    </div>
  );
}
