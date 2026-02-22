"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Shield, Zap, Users, Briefcase, CheckSquare, DollarSign, UserPlus, Settings, Eye, FileText } from "lucide-react"
import { useAuthStore } from "@/lib/store"
import type { User as AuthUser } from "@/lib/types"
import { useRole } from "@/lib/contexts/role-context"
import { createSubscription, getCurrentSubscription } from "@/lib/mock/subscription"
import { mockUsers } from "@/lib/mock/users"
import { UserRole } from "@/lib/types/roles"
import { usePricing } from "@/lib/contexts/pricing-context"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const roleConfigs = [
  {
    role: "PARTNER_ADMIN" as UserRole,
    name: "Partner (Admin)",
    icon: Shield,
    description: "Full access to all features and settings",
    color: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
  },
  {
    role: "JUNIOR_PARTNER" as UserRole,
    name: "Junior Partner",
    icon: Briefcase,
    description: "Team management and matter oversight",
    color: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30",
  },
  {
    role: "ASSOCIATE" as UserRole,
    name: "Associate",
    icon: FileText,
    description: "Matter management and client work",
    color: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30",
  },
  {
    role: "PARALEGAL" as UserRole,
    name: "Paralegal",
    icon: CheckSquare,
    description: "Task management and document support",
    color: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30",
  },
  {
    role: "FINANCE" as UserRole,
    name: "Finance",
    icon: DollarSign,
    description: "Financial reporting and invoicing",
    color: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  },
  {
    role: "INTAKE" as UserRole,
    name: "Intake",
    icon: UserPlus,
    description: "Client onboarding and intake",
    color: "bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-500/30",
  },
  {
    role: "OPS_HR" as UserRole,
    name: "Ops/HR",
    icon: Users,
    description: "Operations and human resources",
    color: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/30",
  },
  {
    role: "RECEPTION" as UserRole,
    name: "Reception",
    icon: Zap,
    description: "Front desk and scheduling",
    color: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30",
  },
  {
    role: "READ_ONLY" as UserRole,
    name: "Read-Only",
    icon: Eye,
    description: "View-only access for auditors",
    color: "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/30",
  },
]

export default function DemoSignInPage() {
  const router = useRouter()
  const { loginWithOTP, setUser } = useAuthStore()
  const { setCurrentRole, setCurrentUser } = useRole()
  const { pricing } = usePricing()
  const [loading, setLoading] = useState<string | null>(null)

  const handleDemoLogin = async (role: UserRole, plan: "STARTER" | "PROFESSIONAL") => {
    setLoading(`${role}-${plan}`)
    try {
      // Find user with this role
      const user = mockUsers.find((u) => u.role === role) || mockUsers[0]
      
      // Set up subscription
      const monthlyPrice = plan === "PROFESSIONAL" ? pricing.pricePerUser * 1.5 : pricing.pricePerUser
      createSubscription(
        plan,
        "monthly",
        1, // Start with 1 user
        monthlyPrice,
        pricing.currency,
        pricing.currencySymbol
      )

      // Set user and role (auth store expects User from lib/types with firmId)
      const authUser: AuthUser = { ...user, firmId: "firm-1", role: user.role as AuthUser["role"] }
      setUser(authUser)
      setCurrentUser(user)
      setCurrentRole(role)
      
      // Save to localStorage for persistence
      localStorage.setItem("dev-current-role", role)
      localStorage.setItem("dev-current-user", JSON.stringify(user))

      // Navigate to dashboard
      router.push("/app/dashboard")
    } catch (error) {
      console.error("Demo login error:", error)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20 p-4">
      <div className="w-full max-w-6xl">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Shield className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Demo Accounts</h1>
          <p className="text-muted-foreground">
            Quick access to test different roles and plans. No password required!
          </p>
        </div>

        <Tabs defaultValue="starter" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
            <TabsTrigger value="starter">
              Starter Plan
            </TabsTrigger>
            <TabsTrigger value="professional">
              Professional Plan
            </TabsTrigger>
          </TabsList>

          <TabsContent value="starter" className="space-y-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {roleConfigs.map((config) => {
                const Icon = config.icon
                const isLoading = loading === `${config.role}-STARTER`
                return (
                  <Card key={config.role} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2 rounded-lg ${config.color}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-lg">{config.name}</CardTitle>
                          <Badge variant="outline" className="mt-1">Starter</Badge>
                        </div>
                      </div>
                      <CardDescription className="text-sm">
                        {config.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button
                        className="w-full"
                        onClick={() => handleDemoLogin(config.role, "STARTER")}
                        disabled={isLoading}
                      >
                        {isLoading ? "Signing in..." : "Sign In as " + config.name}
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>

          <TabsContent value="professional" className="space-y-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {roleConfigs.map((config) => {
                const Icon = config.icon
                const isLoading = loading === `${config.role}-PROFESSIONAL`
                return (
                  <Card key={config.role} className="hover:shadow-lg transition-shadow border-primary/20">
                    <CardHeader>
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2 rounded-lg ${config.color}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-lg">{config.name}</CardTitle>
                          <Badge className="mt-1 bg-primary">Professional</Badge>
                        </div>
                      </div>
                      <CardDescription className="text-sm">
                        {config.description}
                      </CardDescription>
                      <div className="mt-2 text-xs text-muted-foreground">
                        ✓ Advanced Reporting<br />
                        ✓ Client Portal<br />
                        ✓ API Access
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Button
                        className="w-full"
                        onClick={() => handleDemoLogin(config.role, "PROFESSIONAL")}
                        disabled={isLoading}
                      >
                        {isLoading ? "Signing in..." : "Sign In as " + config.name}
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-8 text-center">
          <Link href="/auth/sign-in">
            <Button variant="outline">
              Back to Regular Sign In
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

