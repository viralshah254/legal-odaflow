import type { QueryClient } from "@tanstack/react-query"

export function invalidateCreditWalletQueries(
  queryClient: QueryClient,
  tenantId?: string | null,
): void {
  void queryClient.invalidateQueries({ queryKey: ["credit-wallet"] })
  void queryClient.invalidateQueries({ queryKey: ["credit-wallet-meter", tenantId] })
}
