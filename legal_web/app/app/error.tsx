"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    // Log to console for debugging; Sentry captures automatically via instrumentation.
    console.error("[app/error]", error)
  }, [error])

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <AlertTriangle className="h-12 w-12 text-destructive" />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          The app ran into an unexpected error. Your data is safe — please try again.
        </p>
      </div>
      <div className="flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => router.push("/auth")}>
          Sign in again
        </Button>
      </div>
    </div>
  )
}
