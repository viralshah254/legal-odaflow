import type { Metadata } from "next"
import { buildDemoMetadata } from "@/lib/seo/site-metadata"

export async function generateMetadata(): Promise<Metadata> {
  return buildDemoMetadata()
}

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children
}
