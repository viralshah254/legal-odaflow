"use client"

import { cn } from "@/lib/utils"

interface IntakeAppShellProps {
  children: React.ReactNode
  header?: React.ReactNode
  mobileProgress?: React.ReactNode
  aside?: React.ReactNode
  /** Rendered inside the card on desktop; fixed sticky bar on mobile */
  footer?: React.ReactNode
  className?: string
}

export function IntakeAppShell({
  children,
  header,
  mobileProgress,
  aside,
  footer,
  className,
}: IntakeAppShellProps) {
  return (
    <div className={cn("w-full p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8", className)}>
      {header}

      {mobileProgress && <div className="mb-4 lg:hidden">{mobileProgress}</div>}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1.4fr)_360px] gap-6 items-start">
        <div className="min-w-0 space-y-6">{children}</div>

        {aside && (
          <aside className="hidden lg:flex lg:flex-col lg:gap-4 lg:sticky lg:top-6 lg:self-start">
            {aside}
          </aside>
        )}
      </div>

      {footer && (
        <div
          className={cn(
            "fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur",
            "p-4 pr-16 pb-[max(1rem,env(safe-area-inset-bottom))]",
            "lg:hidden",
          )}
        >
          {footer}
        </div>
      )}
    </div>
  )
}
