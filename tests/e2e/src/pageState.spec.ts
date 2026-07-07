import { test, expect, gotoRoute, inputInLabeledField } from "./fixtures.js";

test("main pages restore last local UI state after navigation", async ({ page }) => {
  await gotoRoute(page, "/#/motor");
  await page.getByRole("button", { name: /Tablo Modu/i }).click();
  await gotoRoute(page, "/#/cable");
  await page.getByRole("button", { name: /Detayl.*Hesap/i }).click();
  await gotoRoute(page, "/#/motor");
  await expect(page.getByText(/Motor Se.*imi/i)).toBeVisible();

  await gotoRoute(page, "/#/voltage-drop");
  await inputInLabeledField(page, /Grup ad/i).fill("Kalici taslak");
  await gotoRoute(page, "/#/projects");
  await gotoRoute(page, "/#/voltage-drop");
  await expect(inputInLabeledField(page, /Grup ad/i)).toHaveValue("Kalici taslak");
});

test("settings and materials drafts survive route navigation", async ({ page }) => {
  await gotoRoute(page, "/#/settings");
  const firmNameInput = inputInLabeledField(page, /Firma Ad/i);
  await firmNameInput.fill("Yerel Taslak Firma");

  await gotoRoute(page, "/#/materials");
  const searchInput = page.getByPlaceholder(/Ad, marka veya model ara/i);
  await searchInput.fill("kablo");

  await gotoRoute(page, "/#/settings");
  await expect(firmNameInput).toHaveValue("Yerel Taslak Firma");

  await gotoRoute(page, "/#/materials");
  await expect(searchInput).toHaveValue("kablo");
});
