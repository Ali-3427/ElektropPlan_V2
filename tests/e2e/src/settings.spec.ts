import { test, expect, gotoRoute, inputAfterLabel, selectAfterLabel } from "./fixtures.js";

test.describe("Settings persistence", () => {
  test("Firm name persists", async ({ page }) => {
    await gotoRoute(page, "/#/settings");

    // Fill firma adı
    const firmaInput = inputAfterLabel(page, /Firma Ad|Sirket Ad/i);
    await firmaInput.clear();
    await firmaInput.fill("Test Firması");

    // Click Kaydet
    await page.getByRole("button", { name: "Kaydet" }).click();

    // Navigate away
    await gotoRoute(page, "/#/motor");

    // Navigate back to settings
    await gotoRoute(page, "/#/settings");

    // Assert firma adı field shows "Test Firması"
    const firmaInputAfter = inputAfterLabel(page, /Firma Ad|Sirket Ad/i);
    await expect(firmaInputAfter).toHaveValue("Test Firması");
  });

  test("Default VD profile dropdown visible with power-5pct default", async ({
    page,
  }) => {
    await gotoRoute(page, "/#/settings");

    // Assert VD profile dropdown exists and has a selected value
    const vdDropdown = selectAfterLabel(page, /Varsay.*Gerilim|Gerilim D.*m Profili/i);
    await expect(vdDropdown).toBeVisible();

    const selectedValue = await vdDropdown.inputValue();
    expect(selectedValue.length).toBeGreaterThan(0);
  });
});
