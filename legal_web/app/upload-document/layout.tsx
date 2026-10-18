import type { Metadata } from "next"
import { buildUploadDocumentMetadata } from "@/lib/seo/site-metadata"

export async function generateMetadata(): Promise<Metadata> {
  return buildUploadDocumentMetadata()
}

export default function UploadDocumentLayout({ children }: { children: React.ReactNode }) {
  return children
}
