import { test, expect } from "@playwright/test"

/**
 * Lightweight mobile viewport smoke tests.
 * These assert public / shell chrome is reachable without auth where possible.
 */
test.describe("Mobile viewport smoke", () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test("marketing header hamburger opens menu", async ({ page }) => {
    await page.goto("/")
    const menuBtn = page.getByRole("button", { name: "Open menu" })
    await expect(menuBtn).toBeVisible()
    await menuBtn.click()
    const dialog = page.getByRole("dialog", { name: "Menu" })
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByRole("navigation", { name: "Mobile" }).getByRole("link").first(),
    ).toBeVisible()
  })

  test("marketing menu includes key CTAs", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("button", { name: "Open menu" }).click()
    const dialog = page.getByRole("dialog", { name: "Menu" })
    await expect(dialog).toBeVisible()
    // Auth may still be resolving; wait until guest CTAs appear
    await expect(
      dialog.getByRole("link", { name: /get started|demo/i }).first(),
    ).toBeVisible({ timeout: 15_000 })
  })

  test("guest signup sheet and streamlined hero", async ({ page }) => {
    await page.goto("/")

    // Streamlined mobile hero — marketing body copy hidden
    await expect(
      page.getByText(/Explain your situation in plain language/i),
    ).toBeHidden()
    await expect(page.getByText("Free preview always included")).toBeHidden()
    await expect(page.getByText("Never used to train AI")).toBeHidden()
    await expect(page.getByText("Private to your account")).toBeHidden()

    // Issue Checker input remains available for typing
    const issueInput = page.getByPlaceholder(
      /Describe what happened, who was involved/i,
    )
    await expect(issueInput).toBeVisible()

    // Guest signup sheet appears after ~2s delay
    const sheet = page.getByRole("dialog")
    await expect(sheet.getByText("Free Credits today")).toBeVisible({
      timeout: 5_000,
    })
    await expect(sheet.getByText("Private to your account")).toBeVisible()
    await expect(sheet.getByRole("link", { name: /sign up free/i })).toBeVisible()
    await expect(
      sheet.getByRole("button", { name: /continue as guest/i }),
    ).toBeVisible()

    await sheet.getByRole("button", { name: /continue as guest/i }).click()
    await expect(sheet).toBeHidden()
    await expect(issueInput).toBeVisible()
  })

  test("fresh geo overrides a stale saved country", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("odaflow_detected_country", "FR")
      window.localStorage.setItem("odaflow_country_user_confirmed", "1")
    })
    await page.route("**/api/geo/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ countryCode: "IN", regionCode: "MH", source: "vercel-ip-country" }),
      })
    })

    await page.goto("/legal-issue-checker")
    await page.getByRole("button", { name: /continue as guest/i }).click({ timeout: 8_000 }).catch(() => {})

    const countrySelect = page.locator('[data-tour="intake-issue-input"]').getByRole("combobox").first()
    await expect(countrySelect).toContainText("India", { timeout: 10_000 })
    await expect(countrySelect).not.toContainText("France")

    await countrySelect.click()
    await page.getByRole("option", { name: "France", exact: true }).click()
    await expect(countrySelect).toContainText("France")

    await page.reload()
    const reloadedCountrySelect = page
      .locator('[data-tour="intake-issue-input"]')
      .getByRole("combobox")
      .first()
    await expect(reloadedCountrySelect).toContainText("India", { timeout: 10_000 })
  })

  test("country defaults to India when geo fails on French-locale device", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "language", { get: () => "fr-FR" })
      Object.defineProperty(navigator, "languages", { get: () => ["fr-FR"] })
    })
    await page.route("**/api/geo/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ countryCode: null, regionCode: null, source: "none" }),
      })
    })

    await page.goto("/legal-issue-checker")
    await page.getByRole("button", { name: /continue as guest/i }).click({ timeout: 8_000 }).catch(() => {})

    const countrySelect = page.locator('[data-tour="intake-issue-input"]').getByRole("combobox").first()
    await expect(countrySelect).toContainText("India", { timeout: 10_000 })
    await expect(countrySelect).not.toContainText("France")
  })
})

test.describe("Tablet viewport smoke", () => {
  test.use({ viewport: { width: 768, height: 1024 } })

  test("marketing hamburger hidden at md breakpoint", async ({ page }) => {
    await page.goto("/")
    // At md (768) desktop nav shows; hamburger is md:hidden
    await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden()
  })
})
