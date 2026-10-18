"use client"

import { useState, type ReactNode } from "react"
import { PanelRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

interface ResponsiveAsideProps {
  children: ReactNode
  /** Label for the mobile Sheet trigger / title. */
  title?: string
  /** Extra classes for the desktop aside. */
  className?: string
  /** Extra classes for the Sheet content. */
  sheetClassName?: string
  /** Side of the Sheet drawer. Default: right. */
  side?: "left" | "right"
}

/**
 * Desktop: sticky aside panel. Mobile (&lt; lg): Sheet drawer with trigger button.
 */
export function ResponsiveAside({
  children,
  title = "Details",
  className,
  sheetClassName,
  side = "right",
}: ResponsiveAsideProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Desktop aside */}
      <aside
        className={cn(
          "hidden lg:block w-80 xl:w-96 shrink-0 overflow-y-auto border-l px-4 py-6",
          className,
        )}
      >
        {children}
      </aside>

      {/* Mobile trigger + sheet */}
      <div className="lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="fixed bottom-20 right-4 z-20 h-10 gap-2 shadow-md"
            >
              <PanelRight className="h-4 w-4" />
              {title}
            </Button>
          </SheetTrigger>
          <SheetContent
            side={side}
            className={cn("w-full sm:max-w-md overflow-y-auto", sheetClassName)}
          >
            <SheetHeader className="mb-4">
              <SheetTitle>{title}</SheetTitle>
            </SheetHeader>
            {children}
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
