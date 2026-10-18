import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime"

function resolvePostAuthPath(
  user: { userType?: string; mustChangePassword?: boolean },
  redirectTo?: string | null,
): string {
  if (user.mustChangePassword) return "/auth/change-password"
  if (redirectTo && redirectTo.startsWith("/")) return redirectTo
  if (user.userType === "SUPER_ADMIN") return "/admin/home"
  if (user.userType === "CONSUMER") return "/consumer/dashboard"
  return "/app/home"
}

export function redirectAfterAuth(
  user: { userType?: string; mustChangePassword?: boolean },
  router: AppRouterInstance,
  redirectTo?: string | null,
) {
  const path = resolvePostAuthPath(user, redirectTo)
  // Full navigation ensures HttpOnly session cookies are picked up by middleware.
  if (typeof window !== "undefined") {
    window.location.assign(path)
    return
  }
  router.push(path)
}
