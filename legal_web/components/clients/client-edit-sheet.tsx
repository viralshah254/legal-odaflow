"use client"

import type { Dispatch, FormEvent, SetStateAction } from "react"
import { useEffect, useRef } from "react"
import { Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"

import type { UpdateClientRequest } from "@/lib/api/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PhoneInput } from "@/components/ui/phone-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

interface ClientEditSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: UpdateClientRequest
  setForm: Dispatch<SetStateAction<UpdateClientRequest>>
  phoneCountry: string
  setPhoneCountry: (value: string) => void
  phoneNational: string
  setPhoneNational: (value: string) => void
  preferredPhoneCountry: string
  loading: boolean
  error: string | null
  onSubmit: (event: FormEvent) => void
}

export function ClientEditSheet({
  open,
  onOpenChange,
  form,
  setForm,
  phoneCountry,
  setPhoneCountry,
  phoneNational,
  setPhoneNational,
  preferredPhoneCountry,
  loading,
  error,
  onSubmit,
}: ClientEditSheetProps) {
  const t = useTranslations("clients")
  const tc = useTranslations("common")
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => nameRef.current?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [open])

  const updateContact = (
    index: number,
    field: "name" | "role" | "email" | "phone",
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      contactPeople: (current.contactPeople ?? []).map((person, personIndex) =>
        personIndex === index ? { ...person, [field]: value } : person,
      ),
    }))
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{t("editClient")}</SheetTitle>
          <SheetDescription>{t("editClientDescription")}</SheetDescription>
        </SheetHeader>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">{t("name")} *</Label>
            <Input
              ref={nameRef}
              id="edit-name"
              value={form.name ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder={t("clientNamePlaceholder")}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-email">{t("email")}</Label>
            <Input
              id="edit-email"
              type="email"
              value={form.email ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder={t("clientexamplecom")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-phone">{t("phone")}</Label>
            <PhoneInput
              id="edit-phone"
              countryCode={phoneCountry}
              nationalNumber={phoneNational}
              preferredCountryCode={preferredPhoneCountry}
              onCountryCodeChange={setPhoneCountry}
              onNationalNumberChange={setPhoneNational}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-address">{t("address")}</Label>
            <Input
              id="edit-address"
              value={form.address ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
              placeholder={t("addressPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-type">{t("type")}</Label>
            <Select
              value={form.type ?? "INDIVIDUAL"}
              onValueChange={(value: string) =>
                setForm((current) => ({
                  ...current,
                  type: value as UpdateClientRequest["type"],
                }))
              }
            >
              <SelectTrigger id="edit-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INDIVIDUAL">{t("types.INDIVIDUAL")}</SelectItem>
                <SelectItem value="COMPANY">{t("types.COMPANY")}</SelectItem>
                <SelectItem value="NGO">{t("types.NGO")}</SelectItem>
                <SelectItem value="PARTNERSHIP">{t("types.PARTNERSHIP")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-country">{t("countryCode")}</Label>
            <Input
              id="edit-country"
              value={form.countryCode ?? ""}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  countryCode: event.target.value.toUpperCase() as UpdateClientRequest["countryCode"],
                }))
              }
              placeholder={t("countryCodePlaceholder")}
              maxLength={2}
            />
          </div>

          <div className="space-y-3 border-t pt-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Label>{t("contactPeople")}</Label>
                <p className="mt-1 text-xs text-muted-foreground">{t("contactPeopleDescription")}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    contactPeople: [
                      ...(current.contactPeople ?? []),
                      { name: "", role: "", email: "", phone: "" },
                    ],
                  }))
                }
              >
                {t("addPerson")}
              </Button>
            </div>
            {(form.contactPeople ?? []).length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                {t("noContactPeopleYet")}
              </div>
            ) : (
              (form.contactPeople ?? []).map((person, index) => (
                <fieldset key={index} className="space-y-3 rounded-lg border p-3">
                  <legend className="px-1 text-xs font-medium text-muted-foreground">
                    {t("contactNumber", { number: index + 1 })}
                  </legend>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-destructive hover:text-destructive"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          contactPeople: (current.contactPeople ?? []).filter(
                            (_, personIndex) => personIndex !== index,
                          ),
                        }))
                      }
                    >
                      {tc("remove")}
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor={`contact-name-${index}`}>{t("name")} *</Label>
                      <Input
                        id={`contact-name-${index}`}
                        value={person.name}
                        onChange={(event) => updateContact(index, "name", event.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`contact-role-${index}`}>{t("roleTitle")}</Label>
                      <Input
                        id={`contact-role-${index}`}
                        value={person.role ?? ""}
                        onChange={(event) => updateContact(index, "role", event.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`contact-email-${index}`}>{t("email")}</Label>
                      <Input
                        id={`contact-email-${index}`}
                        type="email"
                        value={person.email ?? ""}
                        onChange={(event) => updateContact(index, "email", event.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`contact-phone-${index}`}>{t("phone")}</Label>
                      <Input
                        id={`contact-phone-${index}`}
                        type="tel"
                        value={person.phone ?? ""}
                        onChange={(event) => updateContact(index, "phone", event.target.value)}
                      />
                    </div>
                  </div>
                </fieldset>
              ))
            )}
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={loading} aria-busy={loading || undefined}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {t("saveChanges")}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
