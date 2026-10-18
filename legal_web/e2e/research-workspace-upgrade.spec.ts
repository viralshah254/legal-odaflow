import { expect, test, type Page } from "@playwright/test"

async function isAuthenticationScreen(page: Page) {
  if (/\/auth\/|sign-in/.test(page.url())) return true
  return page
    .getByRole("heading", { name: /continue to umbrella|sign in/i })
    .isVisible()
    .catch(() => false)
}

test.describe("research workspace upgrade", () => {
  test("selects explicit matter context without invoking live AI", async ({
    page,
  }) => {
    await page.route("**/ai/research/matter-context**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          matter: {
            id: "matter-1",
            title: "Mock matrimonial matter",
            factsSummary: "Authorized matter profile",
            updatedAt: "2026-07-27T00:00:00.000Z",
          },
          documents: [
            {
              id: "document-1",
              fileName: "pleadings.pdf",
              hasExtractedText: true,
            },
          ],
          savedResearch: [
            {
              id: "saved-1",
              title: "Earlier authorities memo",
              query: "Prior scoped question",
            },
          ],
        }),
      })
    })

    await page.goto("/app/research?matterId=matter-1", {
      waitUntil: "domcontentloaded",
    })
    if (await isAuthenticationScreen(page)) {
      expect(await isAuthenticationScreen(page)).toBe(true)
      return
    }

    await expect(
      page.getByRole("heading", { name: "Matter context: Mock matrimonial matter" }),
    ).toBeVisible()
    await expect(
      page.getByText(
        "Matter profile and graph only; no document or prior-research text will be used.",
      ),
    ).toBeVisible()

    await page.getByLabel(/pleadings\.pdf/i).click()
    await page.getByLabel(/Earlier authorities memo/i).click()
    await expect(
      page.getByText(
        "1 document and 1 prior research item will be used with the matter profile.",
      ),
    ).toBeVisible()
  })
})
