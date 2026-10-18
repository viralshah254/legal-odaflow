"use client"
import { useTranslations } from "next-intl"

import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { FileImage, FileText, FileUp, Lock, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface DocumentsStepProps {
  isAuthenticated: boolean
  selectedFiles: File[]
  onFilesSelected: (files: File[]) => void
  onRequireSignUp: () => void
  layoutWide?: boolean
}

function getFileIcon(file: File) {
  if (file.type.startsWith("image/")) return FileImage
  return FileText
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DocumentsStep({
  isAuthenticated,
  selectedFiles,
  onFilesSelected,
  onRequireSignUp,
  layoutWide = false,
}: DocumentsStepProps) {
  const t = useTranslations("issueChecker")
  const inputRef = useRef<HTMLInputElement>(null)

  const handlePickFiles = () => {
    if (!isAuthenticated) {
      onRequireSignUp()
      return
    }
    inputRef.current?.click()
  }

  const removeFile = (index: number) => {
    onFilesSelected(selectedFiles.filter((_, i) => i !== index))
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (!isAuthenticated) {
      onRequireSignUp()
      return
    }
    const dropped = Array.from(e.dataTransfer.files)
    onFilesSelected([...selectedFiles, ...dropped])
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    onFilesSelected([...selectedFiles, ...picked])
    e.target.value = ""
  }

  return (
    <div className="space-y-5">
      <div>
        <Label className="text-sm font-semibold">
          {t("supportingDocuments")}{" "}
          <span className="font-normal text-muted-foreground text-xs">{t("optional")}</span>
        </Label>
        <p className="text-xs text-muted-foreground mt-1">
          {t("documentsHelpAnalysis")}
          {!isAuthenticated && ` ${t("accountRequiredForFiles")}`}
        </p>
      </div>

      <div
        className={cn(
          "rounded-xl border-2 border-dashed text-center transition-colors cursor-pointer",
          layoutWide ? "p-6 lg:p-8 lg:min-h-[220px] flex flex-col items-center justify-center" : "p-8",
          isAuthenticated ? "hover:border-primary/50 hover:bg-muted/30" : "opacity-70",
        )}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={handlePickFiles}
      >
        <div className="flex justify-center gap-2 mb-3">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
            <FileText className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
            <FileImage className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <FileUp className="h-5 w-5 text-primary" />
          </div>
        </div>
        <p className="text-sm font-medium mb-1">
          {isAuthenticated ? t("dragOrBrowse") : t("signUpToAttachFiles")}
        </p>
        <p className="text-xs text-muted-foreground mb-3">{t("pdf_doc_png_jpg_webp_up_to_20_mb")}</p>
        <Button
          type="button"
          variant={isAuthenticated ? "outline" : "secondary"}
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            handlePickFiles()
          }}
        >
          {isAuthenticated ? (
            <>
              <FileUp className="mr-2 h-3.5 w-3.5" />
              {t("chooseFiles")}
            </>
          ) : (
            <>
              <Lock className="mr-2 h-3.5 w-3.5" />
              {t("signUpToAttach")}
            </>
          )}
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.txt"
          onChange={handleFileInput}
        />
      </div>

      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {t("filesSelected", { count: selectedFiles.length })}
          </p>
          <ul className={cn(layoutWide && selectedFiles.length > 1 ? "grid gap-2 lg:grid-cols-2" : "space-y-1.5")}>
            {selectedFiles.map((file, index) => {
              const Icon = getFileIcon(file)
              return (
                <li
                  key={`${file.name}-${file.size}-${index}`}
                  className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2"
                >
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
                    aria-label={t("removeFile", { name: file.name })}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{t("previewWithoutDocuments")}</p>
    </div>
  )
}
