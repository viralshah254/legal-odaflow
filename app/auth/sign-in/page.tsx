"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuthStore } from "@/lib/store"
import { Shield, Mail, Zap } from "lucide-react"

const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required").optional(),
  otp: z.string().min(6, "OTP must be 6 digits").max(6, "OTP must be 6 digits").optional(),
})

type SignInForm = z.infer<typeof signInSchema>

export default function SignInPage() {
  const router = useRouter()
  const { login, loginWithOTP } = useAuthStore()
  const [error, setError] = useState<string | null>(null)
  const [useOTP, setUseOTP] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<SignInForm>({
    resolver: zodResolver(signInSchema),
  })

  const onSubmit = async (data: SignInForm) => {
    try {
      setError(null)
      if (useOTP) {
        if (!data.otp) {
          setError("OTP is required")
          return
        }
        await loginWithOTP(data.email, data.otp)
      } else {
        if (!data.password) {
          setError("Password is required")
          return
        }
        await login(data.email, data.password)
      }
      router.push("/app")
    } catch (err) {
      setError(useOTP ? "Invalid email or OTP code" : "Invalid email or password")
    }
  }

  const toggleAuthMethod = () => {
    setUseOTP(!useOTP)
    reset()
    setError(null)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <Shield className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">Sign In</CardTitle>
          <CardDescription>
            {useOTP ? "Enter your email and OTP code" : "Enter your credentials to access your account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@lawfirm.com"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
            {useOTP ? (
              <div className="space-y-2">
                <Label htmlFor="otp">OTP Code</Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="111111"
                  maxLength={6}
                  {...register("otp")}
                />
                {errors.otp && (
                  <p className="text-sm text-destructive">{errors.otp.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Demo OTP code: <span className="font-mono font-semibold">111111</span>
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  {...register("password")}
                />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>
            )}
            <div className="flex items-center justify-between">
              {!useOTP && (
                <Link href="/auth/forgot-password" className="text-sm text-primary hover:underline">
                  Forgot password?
                </Link>
              )}
              <button
                type="button"
                onClick={toggleAuthMethod}
                className="text-sm text-primary hover:underline"
              >
                {useOTP ? "Use password instead" : "Use OTP instead"}
              </button>
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Sign In"}
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link href="/auth/sign-up" className="text-primary hover:underline">
                Sign up
              </Link>
            </div>
            <div className="pt-4 border-t">
              <Link href="/auth/demo">
                <Button variant="outline" className="w-full">
                  <Zap className="mr-2 h-4 w-4" />
                  Quick Demo Access (No Password)
                </Button>
              </Link>
            </div>
            <div className="pt-4 border-t">
              <p className="text-xs text-center text-muted-foreground mb-2">
                Demo credentials:
              </p>
              <p className="text-xs text-center text-muted-foreground">
                Email: john.doe@lawfirm.com<br />
                {useOTP ? (
                  <>OTP: <span className="font-mono font-semibold">111111</span></>
                ) : (
                  <>Password: password</>
                )}
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

