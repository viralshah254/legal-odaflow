"use client"

import { useRef, useState } from "react"
import { Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  importTemplateFile,
  TEMPLATE_UPLOAD_ACCEPT,
  type ImportedTemplateFile,
} from "@/lib/templates/import-template-file"

interface TemplateFileUploadProps {
  onImport: (result: ImportedTemplateFile) => void
}

export function TemplateFileUpload({ onImport }: TemplateFileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File | null) => {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      onImport(await importTemplateFile(file))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={TEMPLATE_UPLOAD_ACCEPT}
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
      />
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        disabled={loading}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-4 w-4" />
        {loading ? "Importing…" : "Upload Word, HTML, or TXT file"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
