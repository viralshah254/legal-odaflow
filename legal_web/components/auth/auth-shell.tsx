import { Card } from "@/components/ui/card"
import { UmbrellaLogo } from "@/components/brand/umbrella-logo"
import { cn } from "@/lib/utils"

interface AuthShellProps {
  children: React.ReactNode
  className?: string
  /** Show logo above the card (sign-in/up). */
  showLogo?: boolean
}

export function AuthShell({ children, className, showLogo = true }: AuthShellProps) {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center hero-gradient px-4 py-8 sm:px-6">
      <div className="absolute inset-0 hero-dot-grid opacity-50 pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 -right-24 h-[420px] w-[420px] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-[360px] w-[360px] rounded-full bg-primary/7 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md space-y-6">
        {showLogo && (
          <div className="flex justify-center">
            <UmbrellaLogo height={40} />
          </div>
        )}
        <Card
          className={cn(
            "border border-primary/20 bg-card/95 backdrop-blur shadow-2xl shadow-primary/10 ring-1 ring-primary/10",
            className,
          )}
        >
          {children}
        </Card>
      </div>
    </div>
  )
}
