"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  ShieldCheck,
  Lock,
  Eye,
  FileText,
  CheckCircle2,
  Server,
  Key,
  Users,
  Clock,
  ExternalLink,
  Download,
  Globe,
  AlertTriangle,
  Zap,
} from "lucide-react"
import Link from "next/link"
import { CinematicNavbar } from "@/components/marketing/cinematic-navbar"
import { CinematicFooter } from "@/components/marketing/cinematic-footer"

const TRUST_CONTROLS = [
  {
    id: "CC6",
    label: "Logical access controls",
    description: "Role-based access (RBAC), ethical walls, multi-factor authentication, and SSO/SAML.",
    status: "operational" as const,
    icon: Key,
  },
  {
    id: "CC7",
    label: "System operations",
    description: "24/7 uptime monitoring, automated alerting, and incident response runbooks.",
    status: "operational" as const,
    icon: Server,
  },
  {
    id: "CC8",
    label: "Change management",
    description: "All code changes are reviewed, tested in CI, and deployed via automated pipelines.",
    status: "operational" as const,
    icon: CheckCircle2,
  },
  {
    id: "CC9",
    label: "Risk mitigation",
    description: "Vendor risk assessments, sub-processor agreements, and business continuity planning.",
    status: "operational" as const,
    icon: ShieldCheck,
  },
  {
    id: "A1",
    label: "Availability",
    description: "99.9% uptime SLA with geographic redundancy and automated failover.",
    status: "operational" as const,
    icon: Zap,
  },
  {
    id: "C1",
    label: "Confidentiality",
    description: "Data encrypted at rest (AES-256) and in transit (TLS 1.3). Strict data residency controls.",
    status: "operational" as const,
    icon: Lock,
  },
  {
    id: "PI1",
    label: "Processing integrity",
    description: "AI outputs are logged, auditable, and governed by lawyer approval gates before client delivery.",
    status: "operational" as const,
    icon: Eye,
  },
  {
    id: "CC1",
    label: "Control environment",
    description: "Board-level security governance, security training, and documented policies.",
    status: "operational" as const,
    icon: Users,
  },
]

const CERTIFICATIONS = [
  {
    label: "SOC 2 Type II (in progress)",
    description: "Independent audit of security, availability, and confidentiality controls.",
    status: "in-progress",
    href: "/trust/soc2",
  },
  {
    label: "DPDP Act (India)",
    description: "India Digital Personal Data Protection Act compliance.",
    status: "compliant",
    href: "/trust/dpdp",
  },
  {
    label: "GDPR (EU)",
    description: "General Data Protection Regulation for EU data subjects.",
    status: "compliant",
    href: "/trust/gdpr",
  },
  {
    label: "ISO 27001 (planned)",
    description: "Information security management system certification.",
    status: "planned",
    href: null,
  },
]

const ETHICAL_AI_COMMITMENTS = [
  "All AI-generated legal outputs require explicit lawyer review and approval before reaching clients.",
  "Ethical walls prevent cross-matter data leakage between conflicted parties.",
  "Training data consent is opt-in only — your firm's data is never used to train shared models without permission.",
  "Every AI output is logged with model version, prompt hash, and timestamp for full auditability.",
  "Citation confidence scores and treatment badges are shown on all research — no silent hallucinations.",
  "Outcome analyses are gated behind partner approval before portal publication.",
]

const STATUS_CONFIG = {
  operational: { label: "Operational", className: "bg-green-100 text-green-700" },
  "in-progress": { label: "In progress", className: "bg-blue-100 text-blue-700" },
  compliant: { label: "Compliant", className: "bg-green-100 text-green-700" },
  planned: { label: "Planned", className: "bg-gray-100 text-gray-600" },
}

export default function TrustCenterPage() {
  return (
    <div className="marketing-light min-h-screen bg-white text-slate-950">
      <CinematicNavbar />
      <main className="mx-auto max-w-4xl space-y-12 px-4 py-12">
      {/* Hero */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 ring-1 ring-primary/20 mx-auto">
          <ShieldCheck className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Umbrella Trust Center</h1>
        <p className="text-muted-foreground max-w-xl mx-auto text-sm leading-relaxed">
          We hold legal data to a higher standard. This page surfaces our security controls, compliance certifications, and ethical AI commitments for enterprise evaluation.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Badge className="gap-1 border-green-200 bg-green-100 text-green-700">
            <CheckCircle2 className="h-3 w-3" />
            All systems operational
          </Badge>
          <Badge variant="outline" className="gap-1 text-xs">
            <Clock className="h-3 w-3" />
            Updated {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </Badge>
        </div>
      </div>

      <Separator />

      {/* SOC 2 Controls */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold">Security controls (SOC 2 aligned)</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Controls mapped to the AICPA Trust Services Criteria. Independent audit underway.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TRUST_CONTROLS.map((control) => {
            const Icon = control.icon
            const statusConfig = STATUS_CONFIG[control.status]
            return (
              <Card key={control.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{control.label}</p>
                        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ml-auto shrink-0 ${statusConfig.className}`}>
                          {statusConfig.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {control.description}
                      </p>
                      <p className="text-[10px] text-primary mt-1 font-mono">{control.id}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      <Separator />

      {/* Certifications */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Certifications & compliance</h2>
        <div className="space-y-3">
          {CERTIFICATIONS.map((cert) => {
            const statusConfig = STATUS_CONFIG[cert.status as keyof typeof STATUS_CONFIG]
            return (
              <div key={cert.label} className="flex items-center gap-4 rounded-xl border p-4">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{cert.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{cert.description}</p>
                </div>
                <Badge variant="secondary" className={`text-[10px] px-2 py-0.5 shrink-0 ${statusConfig.className}`}>
                  {statusConfig.label}
                </Badge>
                {cert.href && (
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 shrink-0" asChild>
                    <Link href={cert.href}>
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <Separator />

      {/* Ethical AI commitments */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold">Ethical AI commitments</h2>
          <p className="text-sm text-muted-foreground mt-1">
            How Umbrella governs AI outputs to protect lawyers and their clients.
          </p>
        </div>
        <div className="rounded-xl border divide-y">
          {ETHICAL_AI_COMMITMENTS.map((commitment, i) => (
            <div key={i} className="flex items-start gap-3 p-4">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
              <p className="text-sm leading-relaxed">{commitment}</p>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Data handling */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Data handling</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <Lock className="h-5 w-5 text-primary mb-1" />
              <CardTitle className="text-sm">Encryption</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">AES-256 at rest, TLS 1.3 in transit. Keys managed via cloud KMS.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <Globe className="h-5 w-5 text-primary mb-1" />
              <CardTitle className="text-sm">Data residency</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Data stored in your selected region. No cross-border transfer without consent.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <Users className="h-5 w-5 text-primary mb-1" />
              <CardTitle className="text-sm">Access controls</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">RBAC + ethical walls. SCIM provisioning for enterprise identity management.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CTA */}
      <div className="rounded-2xl border bg-primary/5 p-8 text-center space-y-4">
        <h2 className="text-xl font-bold">Enterprise security review</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Request our security questionnaire response, penetration test reports, or a dedicated enterprise onboarding call.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Button asChild>
            <Link href="/contact?topic=enterprise-security">
              Request security review
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/app/settings/enterprise">
              Configure SSO & SCIM
            </Link>
          </Button>
        </div>
      </div>
      </main>
      <CinematicFooter />
    </div>
  )
}
