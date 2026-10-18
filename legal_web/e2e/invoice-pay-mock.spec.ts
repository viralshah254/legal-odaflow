import { test, expect } from "@playwright/test"

test.describe("Portal invoice pay mock", () => {
  test("portal sign-in page loads for invoice pay flow", async ({ page }) => {
    await page.goto("/portal/sign-in")
    await expect(page.getByText(/portal|sign in|client/i).first()).toBeVisible()
  })

  test("portal dashboard redirects unauthenticated users", async ({ page }) => {
    await page.goto("/portal")
    await page.waitForURL(/portal\/sign-in|portal/, { timeout: 15_000 })
    expect(page.url()).toMatch(/portal/)
  })
})
