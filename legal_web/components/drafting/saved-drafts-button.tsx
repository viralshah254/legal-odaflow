"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { History } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { savedDraftsScreenHref } from "@/lib/drafting/draft-navigation"
import { cn } from "@/lib/utils"

interface SavedDraftsButtonProps {
  count?: number
  className?: string
  size?: "sm" | "default"
}

export function SavedDraftsButton({ count, className, size = "sm" }: SavedDraftsButtonProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const returnTo = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`

  return (
    <Link
      href={savedDraftsScreenHref(returnTo)}
      className={cn(buttonVariants({ variant: "outline", size }), "gap-2", className)}
    >
      <History className="h-4 w-4" />
      Saved Drafts
      {count != null && count > 0 && (
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium">{count}</span>
      )}
    </Link>
  )
}
