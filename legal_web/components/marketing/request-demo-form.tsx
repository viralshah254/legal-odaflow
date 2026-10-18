"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { submitDemoRequest } from "@/lib/api/marketing"
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react"

const FIRM_SIZES = [
  { value: "1-10", label: "1–10 people" },
  { value: "11-50", label: "11–50 people" },
  { value: "51-200", label: "51–200 people" },
  { value: "201-500", label: "201–500 people" },
  { value: "500+", label: "500+ people" },
]

const COUNTRIES = [
  { value: "IN", label: "India" },
  { value: "US", label: "United States" },
  { value: "GB", label: "United Kingdom" },
  { value: "KE", label: "Kenya" },
  { value: "OTHER", label: "Other" },
]

const fieldClass =
  "h-11 border-slate-300 bg-white text-slate-950 placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-500/20"
const selectTriggerClass =
  "h-11 border-slate-300 bg-white text-slate-950 focus:ring-blue-500/20 [&>span]:text-slate-950 [&>span[data-placeholder]]:text-slate-400"
const selectContentClass = "border-slate-200 bg-white text-slate-950"
const labelClass = "text-sm font-medium text-slate-800"

export function RequestDemoForm() {
  const [contactName, setContactName] = useState("")
  const [email, setEmail] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [phone, setPhone] = useState("")
  const [jobTitle, setJobTitle] = useState("")
  const [firmSize, setFirmSize] = useState("")
  const [countryCode, setCountryCode] = useState("IN")
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSubmitting(true)
    try {
      await submitDemoRequest({
        contactName: contactName.trim(),
        email: email.trim(),
        companyName: companyName.trim(),
        phone: phone.trim() || undefined,
        jobTitle: jobTitle.trim() || undefined,
        firmSize: firmSize || undefined,
        countryCode,
        message: message.trim() || undefined,
        source: "demo_page",
      })
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-7 text-center sm:p-9" role="status">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-7 w-7 text-emerald-700" />
        </span>
        <h3 className="text-xl font-semibold text-slate-950">Your demo request is in</h3>
        <p className="mx-auto max-w-md text-sm leading-6 text-slate-600">
          Thanks for your interest in Umbrella. Our team will reach out within one business day
          to schedule a personalized demo for {companyName || "your firm"}.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 text-slate-950" aria-describedby={error ? "demo-form-error" : undefined}>
      <p className="text-xs text-slate-500"><span className="text-rose-600">*</span> Required fields</p>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="demo-name" className={labelClass}>Full name <span className="text-rose-600">*</span></Label>
          <Input
            id="demo-name"
            required
            minLength={2}
            maxLength={120}
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Priya Sharma"
            autoComplete="name"
            className={fieldClass}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="demo-email" className={labelClass}>Work email <span className="text-rose-600">*</span></Label>
          <Input
            id="demo-email"
            type="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@lawfirm.com"
            autoComplete="email"
            className={fieldClass}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="demo-company" className={labelClass}>Company / firm name <span className="text-rose-600">*</span></Label>
          <Input
            id="demo-company"
            required
            minLength={2}
            maxLength={200}
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Sharma & Associates"
            autoComplete="organization"
            className={fieldClass}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="demo-phone" className={labelClass}>Phone <span className="font-normal text-slate-400">(optional)</span></Label>
          <Input
            id="demo-phone"
            type="tel"
            maxLength={30}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            autoComplete="tel"
            className={fieldClass}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="demo-title" className={labelClass}>Job title <span className="font-normal text-slate-400">(optional)</span></Label>
          <Input
            id="demo-title"
            maxLength={120}
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="Managing Partner"
            autoComplete="organization-title"
            className={fieldClass}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="demo-firm-size" className={labelClass}>Firm size <span className="font-normal text-slate-400">(optional)</span></Label>
          <Select value={firmSize} onValueChange={setFirmSize}>
            <SelectTrigger id="demo-firm-size" className={selectTriggerClass}>
              <SelectValue placeholder="Select team size" />
            </SelectTrigger>
            <SelectContent className={selectContentClass}>
              {FIRM_SIZES.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="focus:bg-blue-50 focus:text-slate-950">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="demo-country" className={labelClass}>Country</Label>
          <Select value={countryCode} onValueChange={setCountryCode}>
            <SelectTrigger id="demo-country" className={`${selectTriggerClass} sm:max-w-xs`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={selectContentClass}>
              {COUNTRIES.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="focus:bg-blue-50 focus:text-slate-950">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="demo-message" className={labelClass}>What would you like to see? <span className="font-normal text-slate-400">(optional)</span></Label>
        <Textarea
          id="demo-message"
          maxLength={2000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g. Matter management, Copilot, India drafting, client portal…"
          rows={3}
          className="min-h-[112px] resize-y border-slate-300 bg-white text-slate-950 placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-500/20 focus-visible:ring-offset-0"
        />
      </div>

      {error && (
        <p id="demo-form-error" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" disabled={submitting} size="lg" className="w-full rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700">
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Booking your demo…
          </>
        ) : (
          <>Book my personalised demo<ArrowRight className="ml-2 h-4 w-4" /></>
        )}
      </Button>
    </form>
  )
}
