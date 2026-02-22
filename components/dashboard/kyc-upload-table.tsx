"use client"

import { useState } from "react"
import { KycDocument, KycDocType, KycDocStatus, getKycDocTypeLabel } from "@/lib/types/kyc"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Upload, X, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface KycUploadTableProps {
  documents: KycDocument[]
  onUpdate: (docId: string, updates: Partial<KycDocument>) => void
  className?: string
}

export function KycUploadTable({ documents, onUpdate, className }: KycUploadTableProps) {
  const [uploading, setUploading] = useState<string | null>(null)

  const handleMockUpload = (docId: string) => {
    setUploading(docId)
    // Simulate upload delay
    setTimeout(() => {
      onUpdate(docId, {
        fileName: `document-${docId}.pdf`,
        uploadedAt: new Date(),
        status: "RECEIVED" as KycDocStatus,
      })
      setUploading(null)
    }, 1000)
  }

  return (
    <div className={cn("space-y-2", className)}>
      {documents.map((doc) => (
        <div
          key={doc.id}
          className={cn(
            "flex items-center gap-4 p-4 rounded-lg border",
            doc.status === "MISSING" ? "border-red-500/20 bg-red-500/5" :
            doc.status === "VERIFIED" ? "border-green-500/20 bg-green-500/5" :
            "border-border/50 bg-muted/30"
          )}
        >
          <div className="flex-1">
            <div className="font-medium text-sm mb-1">{getKycDocTypeLabel(doc.docType)}</div>
            {doc.fileName ? (
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3 text-green-600" />
                {doc.fileName}
                {doc.uploadedAt && (
                  <span className="text-muted-foreground">
                    • Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">No file uploaded</div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {doc.status === "MISSING" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleMockUpload(doc.id)}
                disabled={uploading === doc.id}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading === doc.id ? "Uploading..." : "Upload"}
              </Button>
            )}
            <Badge
              variant={doc.status === "VERIFIED" ? "default" : doc.status === "RECEIVED" ? "secondary" : "outline"}
              className={cn(
                doc.status === "VERIFIED" && "bg-green-500/10 text-green-700 dark:text-green-400",
                doc.status === "RECEIVED" && "bg-blue-500/10 text-blue-700 dark:text-blue-400"
              )}
            >
              {doc.status}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  )
}




