"use client"
import { useTranslations } from "next-intl"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Check, ChevronRight, Loader2, Plus, Search, UserPlus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { PhoneInput } from "@/components/ui/phone-input"
import { cn } from "@/lib/utils"
import type { ConsumerCase } from "@/lib/api/types"
import { convertLead, type LawyerLead } from "@/lib/api/marketplace"
import { getLeadDisplayTitle } from "@/lib/leads/lead-display-title"
import { listClients, createClient, getClient } from "@/lib/api/clients"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useDefaultPhoneCountry } from "@/lib/hooks/use-default-phone-country"
import type { CountryCode } from "@/lib/api/types"
import type { ApiClient } from "@/lib/api/types"
import { isFuzzyDuplicate, digitsOnly, getPhoneCountry, normalizePhone } from "@/lib/phone"

type Mode = "select" | "new-client"

interface ConvertToMatterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lead: LawyerLead
  consumerCase?: ConsumerCase | null
  onConverted?: () => void
}

export function ConvertToMatterDialog({
  open,
  onOpenChange,
  lead,
  consumerCase,
  onConverted,
}: ConvertToMatterDialogProps) {
  const tCommon = useTranslations("common")
  const tBilling = useTranslations("billing")
  const tAuth = useTranslations("auth")
  const tAdmin = useTranslations("admin")
  const t = useTranslations("matters")
  const router = useRouter()
  const { activeTenantId, activeTenant } = useTenant()
  const { countryCode: defaultPhoneCountry, isLoading: phoneCountryLoading } = useDefaultPhoneCountry()

  const [mode, setMode] = useState<Mode>("select")
  const [clientSearch, setClientSearch] = useState("")
  const [clientResults, setClientResults] = useState<ApiClient[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedClient, setSelectedClient] = useState<ApiClient | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // New client form
  const [newName, setNewName] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [phoneCountry, setPhoneCountry] = useState(defaultPhoneCountry)
  const [phoneNational, setPhoneNational] = useState("")
  const [phoneValid, setPhoneValid] = useState(true)

  // Duplicate phone detection
  const [phoneDuplicate, setPhoneDuplicate] = useState<ApiClient | null>(null)
  const dupCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflictReview, setConflictReview] = useState<{
    summary?: string
    matchCount?: number
    matches?: Array<{ type?: string; name?: string; reason?: string }>
  } | null>(null)
  const [pendingClientId, setPendingClientId] = useState<string | undefined>()

  // Reset on open — pre-fill from lead's linked client or client name
  useEffect(() => {
    if (!open) return
    setMode("select")
    setClientResults([])
    setSelectedClient(null)
    setDropdownOpen(false)
    setNewName("")
    setNewEmail("")
    if (defaultPhoneCountry) {
      setPhoneCountry(defaultPhoneCountry as CountryCode)
    }
    setPhoneNational("")
    setPhoneValid(true)
    setPhoneDuplicate(null)
    setError(null)
    setConflictReview(null)
    setPendingClientId(undefined)

    if (lead.clientId && activeTenantId) {
      // Lead already has a linked client — fetch and pre-select it
      setClientSearch("")
      getClient(activeTenantId, lead.clientId)
        .then((client) => {
          setSelectedClient(client)
          setClientSearch(client.name)
        })
        .catch(() => {
          // Fall back to name-based search if fetch fails
          setClientSearch(lead.clientName || "")
          setDropdownOpen(!!lead.clientName)
        })
    } else {
      setClientSearch(lead.clientName || "")
      setDropdownOpen(!!lead.clientName)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultPhoneCountry])

  // Debounced client search
  useEffect(() => {
    if (!activeTenantId || !clientSearch.trim()) {
      setClientResults([])
      return
    }
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const results = await listClients(activeTenantId, clientSearch)
        setClientResults(results.slice(0, 8))
      } catch {
        // ignore
      } finally {
        setSearchLoading(false)
      }
    }, 300)
    return () => {
      if (searchRef.current) clearTimeout(searchRef.current)
    }
  }, [clientSearch, activeTenantId])

  // Auto-select when exactly one client matches the pre-filled lead name
  useEffect(() => {
    if (clientResults.length === 1 && !selectedClient) {
      const match = clientResults[0]
      if (match.name.toLowerCase() === clientSearch.trim().toLowerCase()) {
        setSelectedClient(match)
        setDropdownOpen(false)
      }
    }
  }, [clientResults, clientSearch, selectedClient])

  // Debounced phone duplicate check
  useEffect(() => {
    const localDigits = digitsOnly(phoneNational)
    if (!activeTenantId || localDigits.length < 7) {
      setPhoneDuplicate(null)
      return
    }
    if (dupCheckRef.current) clearTimeout(dupCheckRef.current)
    dupCheckRef.current = setTimeout(async () => {
      try {
        const pc = getPhoneCountry(phoneCountry)
        const normalized = normalizePhone(pc.dialCode, phoneNational) ?? ""
        const all = await listClients(activeTenantId, localDigits.slice(-7))
        const match = all.find((c) => c.phone && isFuzzyDuplicate(c.phone, normalized))
        setPhoneDuplicate(match ?? null)
      } catch {
        // ignore
      }
    }, 400)
    return () => {
      if (dupCheckRef.current) clearTimeout(dupCheckRef.current)
    }
  }, [phoneNational, phoneCountry, activeTenantId])

  const proposedTitle = getLeadDisplayTitle(lead, consumerCase)

  const handleConvert = async (overrideConflict = false) => {
    setSubmitting(true)
    setError(null)
    try {
      let clientId: string | undefined = overrideConflict ? pendingClientId : selectedClient?.id

      if (mode === "new-client" && !overrideConflict) {
        if (!newName.trim()) {
          setError("Client name is required.")
          setSubmitting(false)
          return
        }
        if (!phoneValid && digitsOnly(phoneNational)) {
          setError("Please enter a valid phone number for the selected country.")
          setSubmitting(false)
          return
        }
        if (phoneDuplicate) {
          setError(`A client with this phone number already exists: "${phoneDuplicate.name}". Select them from the search instead.`)
          setSubmitting(false)
          return
        }
        if (activeTenantId) {
          const pc = getPhoneCountry(phoneCountry)
          const fullPhone = normalizePhone(pc.dialCode, phoneNational)
          const created = await createClient(activeTenantId, {
            name: newName.trim(),
            email: newEmail.trim() || undefined,
            phone: fullPhone ?? undefined,
            type: "INDIVIDUAL",
            countryCode: lead.countryCode,
          })
          clientId = created.id
        }
      }

      const result = await convertLead(lead.id, clientId, { overrideConflict })

      if (result.conflictStatus === "REVIEW_REQUIRED" && !result.matter) {
        setPendingClientId(clientId)
        setConflictReview({
          summary: result.conflicts?.summary ?? "Potential conflicts require review before conversion.",
          matchCount: result.conflicts?.matchCount,
          matches: result.conflicts?.matches,
        })
        return
      }

      onConverted?.()
      onOpenChange(false)

      const matterId = result.matter?.id ?? result.convertedMatterId
      if (matterId) {
        const path = result.openDocumentsTab
          ? `/app/matters/${matterId}/draft`
          : `/app/matters/${matterId}`
        router.push(path)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const isAlreadyConverted = lead.status === "CONVERTED"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{tCommon("convert_to_matter")}</DialogTitle>
          <DialogDescription>
            This lead will become an active matter in your workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Matter preview */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{tCommon("matter_to_be_created")}</p>
            <p className="text-sm font-semibold leading-snug">{proposedTitle}</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className="text-xs">{lead.countryCode}</Badge>
              {lead.jurisdiction && (
                <Badge variant="outline" className="text-xs">{lead.jurisdiction}</Badge>
              )}
              <Badge variant="outline" className="text-xs">{lead.issueType}</Badge>
            </div>
          </div>

          {/* Client section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">{tBilling("client")}</Label>
              <button
                type="button"
                onClick={() => setMode(mode === "new-client" ? "select" : "new-client")}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                {mode === "new-client" ? (
                  <>
                    <Search className="h-3 w-3" />
                    Search existing
                  </>
                ) : (
                  <>
                    <UserPlus className="h-3 w-3" />
                    Add new client
                  </>
                )}
              </button>
            </div>

            {mode === "select" ? (
              <div className="relative">
                {selectedClient ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border bg-primary/5 border-primary/30 px-3 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {selectedClient.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{selectedClient.name}</p>
                        {selectedClient.email && (
                          <p className="text-xs text-muted-foreground truncate">{selectedClient.email}</p>
                        )}
                        {lead.clientId === selectedClient.id && (
                          <p className="text-xs text-primary/70 mt-0.5">Linked client</p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedClient(null); setClientSearch("") }}
                      className="text-xs text-primary hover:underline shrink-0"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      <Input
                        className="pl-8"
                        placeholder={tCommon("search_existing_clients")}
                        value={clientSearch}
                        onChange={(e) => {
                          setClientSearch(e.target.value)
                          setDropdownOpen(true)
                        }}
                        onFocus={() => setDropdownOpen(true)}
                        onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
                        autoComplete="off"
                      />
                      {searchLoading && (
                        <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    {dropdownOpen && clientSearch.trim() && (
                      <div className="absolute z-50 left-0 right-0 mt-1 rounded-lg border bg-background shadow-lg overflow-hidden">
                        {clientResults.length > 0 ? (
                          clientResults.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onMouseDown={() => {
                                setSelectedClient(c)
                                setClientSearch(c.name)
                                setDropdownOpen(false)
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/60 transition-colors"
                            >
                              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                {c.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{c.name}</p>
                                {c.email && <p className="text-xs text-muted-foreground truncate">{c.email}</p>}
                              </div>
                              <Check className="h-3.5 w-3.5 text-primary opacity-0 group-hover:opacity-100 shrink-0" />
                            </button>
                          ))
                        ) : (
                          !searchLoading && (
                            <button
                              type="button"
                              onMouseDown={() => {
                                setMode("new-client")
                                setNewName(clientSearch)
                                setDropdownOpen(false)
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted/60"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              No results — add &quot;{clientSearch}&quot; as new client
                            </button>
                          )
                        )}
                      </div>
                    )}
                    {!clientSearch.trim() && (
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Leave blank to auto-create a client from intake data.
                      </p>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-3 rounded-lg border p-3 bg-muted/20">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{tCommon("new_client_details")}</p>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="new-client-name" className="text-xs">{tAuth("fullName")}<span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="new-client-name"
                      placeholder={tCommon("eg_priya_sharma")}
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="new-client-email" className="text-xs">{tAdmin("email")}</Label>
                    <Input
                      id="new-client-email"
                      type="email"
                      placeholder={tCommon("emailexamplecom")}
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5 pb-1">
                    <Label htmlFor="new-client-phone" className="text-xs">{tAuth("phone")}</Label>
                    <PhoneInput
                      id="new-client-phone"
                      countryCode={phoneCountry}
                      nationalNumber={phoneNational}
                      preferredCountryCode={defaultPhoneCountry}
                      onCountryCodeChange={setPhoneCountry}
                      onNationalNumberChange={setPhoneNational}
                      onValidChange={setPhoneValid}
                    />
                    {/* Duplicate warning */}
                    {phoneDuplicate && (
                      <div className={cn(
                        "flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 mt-2",
                      )}>
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div className="text-xs text-amber-700 dark:text-amber-300 leading-snug">
                          <span className="font-medium">{phoneDuplicate.name}</span> already uses this phone number.{" "}
                          <button
                            type="button"
                            className="underline font-medium hover:no-underline"
                            onClick={() => {
                              setSelectedClient(phoneDuplicate)
                              setMode("select")
                              setPhoneNational("")
                            }}
                          >
                            Use existing client
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {lead.status !== "ACCEPTED" && lead.status !== "CONVERTED" && (
            <p className="text-xs text-muted-foreground bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2">
              {t("lead_auto_accept_before_conversion", { accepted: tCommon("accepted") })}
            </p>
          )}

          {conflictReview && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 space-y-2">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                Conflict review required
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                {conflictReview.summary}
              </p>
              {conflictReview.matches && conflictReview.matches.length > 0 && (
                <ul className="text-xs text-amber-800 dark:text-amber-300 space-y-1">
                  {conflictReview.matches.map((match, index) => (
                    <li key={`${match.name ?? "match"}-${index}`}>
                      <span className="font-medium">{match.name ?? match.type ?? "Match"}</span>
                      {match.reason ? ` — ${match.reason}` : ""}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted-foreground">
                Convert only after you have reviewed these matches.
              </p>
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          {conflictReview ? (
            <Button
              variant="destructive"
              onClick={() => void handleConvert(true)}
              disabled={submitting || isAlreadyConverted}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <AlertTriangle className="h-4 w-4 mr-2" />
              )}
              Convert anyway
            </Button>
          ) : (
            <Button
              onClick={() => void handleConvert()}
              disabled={submitting || isAlreadyConverted || (mode === "new-client" && !!phoneDuplicate)}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ChevronRight className="h-4 w-4 mr-2" />
              )}
              {isAlreadyConverted ? "Already converted" : "Convert to matter"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
