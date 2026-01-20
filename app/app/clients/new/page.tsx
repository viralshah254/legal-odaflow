"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { clientsApi } from "@/lib/mock-api"
import type { ClientType } from "@/lib/types"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

const clientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["INDIVIDUAL", "COMPANY", "NGO", "PARTNERSHIP"]),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  zipCode: z.string().optional(),
  portalEnabled: z.boolean().default(false),
  notificationsEnabled: z.boolean().default(true),
})

type ClientForm = z.infer<typeof clientSchema>

export default function NewClientPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ClientForm>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      type: "INDIVIDUAL",
      portalEnabled: false,
      notificationsEnabled: true,
    },
  })

  const portalEnabled = watch("portalEnabled")
  const notificationsEnabled = watch("notificationsEnabled")

  const onSubmit = async (data: ClientForm) => {
    setIsSubmitting(true)
    try {
      await clientsApi.createClient({
        name: data.name,
        type: data.type as ClientType,
        email: data.email,
        phone: data.phone,
        address: data.street
          ? {
              street: data.street,
              city: data.city || "",
              state: data.state || "",
              country: data.country || "",
              zipCode: data.zipCode || "",
            }
          : undefined,
        portalEnabled: data.portalEnabled,
        notificationsEnabled: data.notificationsEnabled,
      })
      router.push("/app/clients")
    } catch (error) {
      console.error("Failed to create client:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/app/clients">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">New Client</h1>
          <p className="text-muted-foreground">Add a new client to your system</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>Client Information</CardTitle>
            <CardDescription>Enter the client's basic information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Client Name *</Label>
                <Input id="name" {...register("name")} />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Client Type *</Label>
                <Select
                  onValueChange={(value) => setValue("type", value as ClientType)}
                  defaultValue="INDIVIDUAL"
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                    <SelectItem value="COMPANY">Company</SelectItem>
                    <SelectItem value="NGO">NGO</SelectItem>
                    <SelectItem value="PARTNERSHIP">Partnership</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" {...register("email")} />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" {...register("phone")} />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold">Address (Optional)</h3>
              <div className="space-y-2">
                <Label htmlFor="street">Street</Label>
                <Input id="street" {...register("street")} />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" {...register("city")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input id="state" {...register("state")} />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input id="country" {...register("country")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zipCode">Zip Code</Label>
                  <Input id="zipCode" {...register("zipCode")} />
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="portalEnabled">Enable Client Portal</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow client to access their portal
                  </p>
                </div>
                <Switch
                  id="portalEnabled"
                  checked={portalEnabled}
                  onCheckedChange={(checked) => setValue("portalEnabled", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notificationsEnabled">Email/SMS Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Send notifications to client
                  </p>
                </div>
                <Switch
                  id="notificationsEnabled"
                  checked={notificationsEnabled}
                  onCheckedChange={(checked) => setValue("notificationsEnabled", checked)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <Link href="/app/clients">
                <Button type="button" variant="outline">Cancel</Button>
              </Link>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Client"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}

