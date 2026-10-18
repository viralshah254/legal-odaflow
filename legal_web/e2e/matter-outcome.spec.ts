import { test, expect } from "@playwright/test"

test.describe("Matter outcome page", () => {
  test("outcome route renders or redirects to auth", async ({ page }) => {
    await page.goto("/app/matters/demo-matter-id/outcome")
    const url = page.url()
    const hasAuthRedirect = url.includes("sign-in") || url.includes("auth")
    const hasOutcomeContent = await page
      .getByText(/outcome|probability|analysis/i)
      .first()
      .isVisible()
      .catch(() => false)

    expect(hasAuthRedirect || hasOutcomeContent).toBeTruthy()
  })
})
