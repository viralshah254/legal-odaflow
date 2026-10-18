import type { Metadata } from "next"
import { buildLawyersMetadata } from "@/lib/seo/site-metadata"

export async function generateMetadata(): Promise<Metadata> {
  return buildLawyersMetadata()
}

export default function LawyersLayout({ children }: { children: React.ReactNode }) {
  return children
}
