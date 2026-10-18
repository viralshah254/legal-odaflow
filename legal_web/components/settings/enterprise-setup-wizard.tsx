"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CreateMonitorDialog } from "@/components/monitors/create-monitor-dialog"
import { cn } from "@/lib/utils"
import {
  CheckCircle2,
  ChevronRight,
  ClipboardCopy,
  Lock,
  Radio,
  Shield,
  Wrench,
  X,
} from "lucide-react"

const WIZARD_KEY = "enterprise_wizard_dismissed"

interface EnterpriseStatus {
  addin: {
    wordAddinInstalled: boolean
    manifestUrl: string
  }
  monitors: {
    activeCount: number
  }
}

interface Step {
  id: string
  icon: typeof Wrench
  title: string
  description: string
}

const STEPS: Step[] = [
  {
    id: "addins",
    icon: Wrench,
    title: "Deploy Office Add-Ins",
    description: "Give your lawyers AI assistance directly inside Word and Outlook.",
  },
  {
    id: "monitors",
    icon: Radio,
    title: "Set up a Regulatory Monitor",
    description: "Track legal changes across your firm's jurisdictions automatically.",
  },
  {
    id: "soc2",
    icon: Shield,
    title: "Review SOC 2 compliance",
    description: "Encryption, audit logging, and access review are already active — review the checklist.",
  },
]

export function EnterpriseSetupWizard({
  status,
  onRefresh,
}: {
  status: EnterpriseStatus
  onRefresh?: () => void
}) {
  const [visible, setVisible] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())
  const [createMonitorOpen, setCreateMonitorOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const dismissed = typeof window !== "undefined" && localStorage.getItem(WIZARD_KEY)
    // Show if not dismissed AND firm hasn't configured things yet
    if (!dismissed && !status.addin.wordAddinInstalled && status.monitors.activeCount === 0) {
      setVisible(true)
    }
  }, [status])

  if (!visible) return null

  const handleDismiss = () => {
    setVisible(false)
    if (typeof window !== "undefined") localStorage.setItem(WIZARD_KEY, "1")
  }

  const markDone = (stepIdx: number) => {
    setCompletedSteps((prev) => new Set([...prev, stepIdx]))
    if (stepIdx < STEPS.length - 1) setActiveStep(stepIdx + 1)
  }

  const copyManifest = () => {
    navigator.clipboard.writeText(status.addin.manifestUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const allDone = completedSteps.size >= STEPS.length

  return (
    <>
      <Card className="border-primary/30 bg-primary/[0.02] overflow-hidden">
        {/* Top accent */}
        <div className="h-1 bg-gradient-to-r from-primary via-primary/60 to-primary/20" />

        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="h-3.5 w-3.5 text-primary" />
                </span>
                Enterprise Setup
                <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                  {completedSteps.size}/{STEPS.length} complete
                </Badge>
              </CardTitle>
              <CardDescription className="mt-1">
                Complete these steps to make your firm enterprise-ready.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pb-5">
          {allDone ? (
            <div className="flex flex-col items-center text-center gap-3 py-4">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="font-semibold text-sm">Your firm is enterprise-ready!</p>
              <p className="text-xs text-muted-foreground">
                All enterprise features are configured. You can dismiss this wizard.
              </p>
              <Button size="sm" onClick={handleDismiss}>
                Done
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Step indicators */}
              <div className="flex items-center gap-2 mb-4">
                {STEPS.map((step, idx) => {
                  const done = completedSteps.has(idx)
                  const active = idx === activeStep
                  return (
                    <button
                      key={step.id}
                      onClick={() => setActiveStep(idx)}
                      className="flex items-center gap-2 group"
                    >
                      <span
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold border transition-all",
                          done
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : active
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-border text-muted-foreground hover:border-primary/50",
                        )}
                      >
                        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : idx + 1}
                      </span>
                      <span
                        className={cn(
                          "text-xs font-medium hidden sm:inline",
                          done
                            ? "text-emerald-600 dark:text-emerald-400"
                            : active
                              ? "text-foreground"
                              : "text-muted-foreground",
                        )}
                      >
                        {step.title}
                      </span>
                      {idx < STEPS.length - 1 && (
                        <ChevronRight className="h-3.5 w-3.5 text-border mx-0.5" />
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Active step content */}
              <div className="rounded-xl border bg-card p-4 space-y-3">
                {activeStep === 0 && (
                  <>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Wrench className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{STEPS[0].title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{STEPS[0].description}</p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="flex-1 rounded-md border bg-muted/40 px-3 py-2 text-xs font-mono text-muted-foreground truncate">
                        {status.addin.manifestUrl}
                      </div>
                      <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={copyManifest}>
                        <ClipboardCopy className="h-3.5 w-3.5" />
                        {copied ? "Copied!" : "Copy URL"}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Share this URL with your IT admin to deploy the add-in across the firm via Microsoft 365 admin center.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <Button size="sm" onClick={() => markDone(0)}>
                        Mark as deployed
                      </Button>
                      <Link href="/app/settings/enterprise">
                        <Button size="sm" variant="ghost" className="text-xs">
                          Full install guide
                        </Button>
                      </Link>
                    </div>
                  </>
                )}

                {activeStep === 1 && (
                  <>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Radio className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{STEPS[1].title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{STEPS[1].description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <Button size="sm" onClick={() => setCreateMonitorOpen(true)}>
                        <Radio className="h-3.5 w-3.5 mr-1.5" />
                        Create first monitor
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs"
                        onClick={() => markDone(1)}
                      >
                        Skip for now
                      </Button>
                    </div>
                  </>
                )}

                {activeStep === 2 && (
                  <>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <Shield className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{STEPS[2].title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{STEPS[2].description}</p>
                      </div>
                    </div>
                    <div className="space-y-2 mt-1">
                      {[
                        { label: "AES-256 encryption at rest", done: true },
                        { label: "Full audit logging active", done: true },
                        { label: "Access review policy", done: false, href: "/app/settings/enterprise?tab=soc2" },
                        { label: "Data retention configured", done: false, href: "/app/settings/enterprise?tab=soc2" },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center gap-2">
                          {item.done ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                          ) : (
                            <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                          )}
                          <span className={cn("text-xs", item.done ? "text-foreground" : "text-muted-foreground")}>
                            {item.label}
                          </span>
                          {!item.done && item.href && (
                            <Link href={item.href} className="text-[10px] text-primary hover:underline ml-auto">
                              Configure
                            </Link>
                          )}
                        </div>
                      ))}
                    </div>
                    <Button size="sm" className="mt-2" onClick={() => markDone(2)}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                      Mark as reviewed
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateMonitorDialog
        open={createMonitorOpen}
        onOpenChange={setCreateMonitorOpen}
        onCreated={() => {
          setCreateMonitorOpen(false)
          markDone(1)
          onRefresh?.()
        }}
      />
    </>
  )
}
