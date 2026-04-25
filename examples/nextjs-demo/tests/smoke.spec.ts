import { expect, test } from "@playwright/test"

test("ProxyMart main flow", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByText("ProxyMart")).toBeVisible()
  await expect(page.getByRole("heading", { name: /Mainboard/ })).toBeVisible({ timeout: 15_000 })
  await expect(page.locator("img").first()).toBeVisible({ timeout: 20_000 })
})
