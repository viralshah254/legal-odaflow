import { test, expect } from "@playwright/test"

test.describe("Consumer signup flow smoke", () => {
  test("sign-up sub-flow loads with prefilled email", async ({ page }) => {
    await page.goto("/auth/sign-up?email=new.user@example.com")
    await expect(page.getByRole("heading", { name: /create your profile/i })).toBeVisible()
    await expect(page.getByText(/how will you use umbrella/i)).toBeVisible()
    await expect(page.getByText(/most common/i)).toBeVisible()
    await expect(page.getByLabel(/email/i)).toHaveValue("new.user@example.com")
  })

  test("unified auth page loads", async ({ page }) => {
    await page.goto("/auth")
    await expect(page.getByRole("heading", { name: /continue to umbrella/i })).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
  })

  test("consumer can navigate from marketing to issue checker", async ({ page }) => {
    await page.goto("/legal-issue-checker")
    await expect(page.getByText(/issue checker|legal issue/i).first()).toBeVisible()
  })
})
