import type { Metadata } from "next"
import { buildLegalFormsMetadata } from "@/lib/seo/site-metadata"

export async function generateMetadata(): Promise<Metadata> {
  return buildLegalFormsMetadata()
}

export default function LegalFormsLayout({ children }: { children: React.ReactNode }) {
  return children
}
