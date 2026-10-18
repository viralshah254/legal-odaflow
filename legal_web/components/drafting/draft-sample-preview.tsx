"use client"

import { FileText } from "lucide-react"
import { cn } from "@/lib/utils"

interface DraftSamplePreviewProps {
  sample: string
  className?: string
}

export function DraftSamplePreview({ sample, className }: DraftSamplePreviewProps) {
  return (
    <div className={cn("flex flex-col h-full min-h-[420px]", className)}>
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/60">
        <FileText className="h-3.5 w-3.5 text-blue-500" />
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Sample form structure</span>
        <span className="text-[10px] text-gray-400 ml-auto">Preview only</span>
      </div>
      <pre className="flex-1 p-4 text-xs leading-relaxed whitespace-pre-wrap font-mono text-gray-700 dark:text-gray-300 overflow-y-auto">
        {sample}
      </pre>
    </div>
  )
}
