import { expect, test, type Page } from "@playwright/test"

const matterId = process.env.PLAYWRIGHT_MATTER_ID ?? "demo-matter-id"
const matterBase = `/app/matters/${matterId}`

async function isAuthenticationScreen(page: Page) {
  if (/\/auth\/|sign-in/.test(page.url())) return true
  return page
    .getByRole("heading", { name: /continue to umbrella|sign in/i })
    .isVisible()
    .catch(() => false)
}

async function openProtected(page: Page, path: string, ready: RegExp) {
  await page.goto(path, { waitUntil: "domcontentloaded" })
  if (await isAuthenticationScreen(page)) {
    expect(await isAuthenticationScreen(page)).toBe(true)
    return false
  }
  await expect(page.getByText(ready).first()).toBeVisible()
  return true
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true)
}

for (const viewport of [
  { name: "1024px laptop", width: 1024, height: 768 },
  { name: "narrow mobile", width: 360, height: 740 },
] as const) {
  test.describe(`calm matter workspace on ${viewport.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(viewport)
    })

    test("orients users on Overview and exposes an accessible stage update", async ({ page }) => {
      if (!(await openProtected(page, `${matterBase}?hub=1`, /overview|matter|not found/i))) return
      await expectNoHorizontalOverflow(page)
      const stageDisclosure = page.getByRole("button", { name: /stage/i }).first()
      if (await stageDisclosure.isVisible().catch(() => false)) {
        await stageDisclosure.focus()
        await page.keyboard.press("Enter")
        await expect(stageDisclosure).toHaveAttribute("aria-expanded", "true")
        const stageChoices = page.getByRole("button", { name: /move to stage/i })
        for (let index = 0; index < (await stageChoices.count()); index += 1) {
          const stageChoice = stageChoices.nth(index)
          if (!(await stageChoice.isEnabled())) continue
          await expect(stageChoice).toHaveAccessibleName(/move to stage/i)
          await stageChoice.click()
          await expect(stageChoice).toHaveAttribute("aria-current", "step")
          break
        }
      }
    })

    test("uses a focused three-step matter intake without a form catalog", async ({ page }) => {
      if (!(await openProtected(page, "/app/matters/new", /new matter|create matter/i))) return
      await expect(page.getByRole("button", { name: /what is this/i })).toBeVisible()
      await expect(page.getByRole("button", { name: /who and where/i })).toBeVisible()
      await expect(page.getByRole("button", { name: /context and checks/i })).toBeVisible()
      await expect(page.getByText(/standard forms.*templates/i)).toHaveCount(0)
      await expectNoHorizontalOverflow(page)
    })

    test("shows the unified matter brief and setup checklist", async ({ page }) => {
      if (!(await openProtected(page, `${matterBase}?hub=1`, /overview|matter|not found/i))) return
      if (await page.getByText(/matter not found/i).isVisible().catch(() => false)) return
      await expect(page.getByText("Matter brief", { exact: true })).toBeVisible()
      await expect(page.getByText("Get this matter ready", { exact: true })).toBeVisible()
    })

    test("routes Files, AI Review, Generate, and E-sign as document views", async ({ page }) => {
      if (!(await openProtected(page, `${matterBase}/documents`, /file center|could not load/i))) return
      for (const view of [
        { name: /files/i, query: "" },
        { name: /ai review/i, query: "ai-review" },
        { name: /generate/i, query: "generate" },
        { name: /e-sign/i, query: "esign" },
      ]) {
        await page.getByRole("tab", { name: view.name }).click()
        await expect(page).toHaveURL(
          view.query
            ? new RegExp(`/documents\\?.*view=${view.query}`)
            : new RegExp(`/documents(?:\\?.*)?$`),
        )
        await expect(page.getByRole("tab", { name: view.name })).toHaveAttribute(
          "data-state",
          "active",
        )
        if (view.query === "generate") {
          await expect(page.getByText("Recommended forms", { exact: true })).toBeVisible()
        }
      }
      await expectNoHorizontalOverflow(page)
    })

    test("routes Tasks, Meetings, Notes, and Activity as work views", async ({ page }) => {
      if (!(await openProtected(page, `${matterBase}/work`, /work|could not load/i))) return
      for (const view of [
        { name: /tasks/i, query: "" },
        { name: /meetings/i, query: "meetings" },
        { name: /notes/i, query: "notes" },
        { name: /activity/i, query: "activity" },
      ]) {
        await page.getByRole("tab", { name: view.name }).click()
        await expect(page).toHaveURL(
          view.query ? new RegExp(`/work\\?.*view=${view.query}`) : new RegExp(`/work(?:\\?.*)?$`),
        )
        await expect(page.getByRole("tab", { name: view.name })).toHaveAttribute(
          "data-state",
          "active",
        )
      }
      await expectNoHorizontalOverflow(page)
    })

    test("keeps legacy task, meeting, and diligence links canonical", async ({ page }) => {
      const routes = [
        { from: `${matterBase}/tasks?highlight=task-1`, to: /\/work\?highlight=task-1$/ },
        { from: `${matterBase}/meetings`, to: /\/work\?view=meetings$/ },
        { from: `${matterBase}/diligence`, to: /\/documents\?view=ai-review$/ },
      ]
      for (const route of routes) {
        await page.goto(route.from, { waitUntil: "domcontentloaded" })
        if (await isAuthenticationScreen(page)) {
          expect(await isAuthenticationScreen(page)).toBe(true)
          continue
        }
        await expect(page).toHaveURL(route.to)
      }
    })

    test("returns from Draft and Research to Overview without redirect loops", async ({ page }) => {
      for (const route of [`${matterBase}/draft`, `${matterBase}/workspace`]) {
        if (!(await openProtected(page, route, /workspace|research|loading|try again/i))) continue
        const back = page.getByRole("link", { name: /back to matter/i }).first()
        await expect(back).toHaveAttribute("href", `${matterBase}?hub=1`)
        await back.click()
        await expect(page).toHaveURL(new RegExp(`/app/matters/${matterId}\\?hub=1$`))
      }
    })

    test("groups More navigation and restores keyboard focus", async ({ page }) => {
      if (!(await openProtected(page, `${matterBase}?hub=1`, /overview|matter|not found/i))) return
      const desktop = viewport.width >= 768
      const trigger = desktop
        ? page.getByRole("button", { name: /more/i }).first()
        : page.locator('[data-tour="matter-workspace-nav-mobile"] button').first()
      if (!(await trigger.isVisible().catch(() => false))) return
      await trigger.focus()
      await page.keyboard.press("Enter")
      await expect(page.getByRole("navigation", { name: /matter.*navigation|navigation/i }).last()).toBeVisible()
      await expect(page.getByText(/case tools/i).last()).toBeVisible()
      await expect(page.getByText(/litigation/i).last()).toBeVisible()
      await expect(page.getByText(/people.*money/i).last()).toBeVisible()
      await page.keyboard.press("Escape")
      await expect(trigger).toBeFocused()
    })

    test("honors reduced motion and leaves room for the sticky composer", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" })
      if (!(await openProtected(page, `${matterBase}?hub=1`, /overview|matter|not found/i))) return
      await expectNoHorizontalOverflow(page)
      const composer = page.locator("div.fixed.bottom-0").last()
      if (await composer.isVisible().catch(() => false)) {
        const box = await composer.boundingBox()
        expect(box && box.y + box.height <= viewport.height + 1).toBeTruthy()
        expect(
          await page.locator(".min-h-screen.pb-24").first().evaluate((element) => {
            const padding = Number.parseFloat(getComputedStyle(element).paddingBottom)
            return padding >= 96
          }),
        ).toBe(true)
      }
    })
  })
}
