import { test, expect, gotoRoute, selectAfterLabel } from "./fixtures.js";

test.describe("Motor screen", () => {
  test("Formula Mode blank inputs calculate with defaults and show assumptions", async ({ page }) => {
    await gotoRoute(page, "/#/motor");
    await page.getByText(/Form.*Modu/).click();

    const voltageSelect = selectAfterLabel(page, /Gerilim \(V\)/);
    await expect(voltageSelect).toHaveValue("380");

    const submitBtn = page.getByRole("button", { name: /Hesapla/ });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    const currentValue = page
      .locator('xpath=//span[normalize-space()="Akim"]/following-sibling::span[1]')
      .first();
    await expect(currentValue).toBeVisible();

    await page.getByRole("button", { name: /Varsay/ }).click();
    await expect(page.getByText(/default/).first()).toBeVisible();
  });

  test("Formula Mode phase switch yields 220V for 1-phase and 380V for 3-phase", async ({ page }) => {
    await gotoRoute(page, "/#/motor");
    await page.getByText(/Form.*Modu/).click();

    const phaseSelect = selectAfterLabel(page, /^Faz$/i);
    const voltageSelect = selectAfterLabel(page, /Gerilim \(V\)/);

    await expect(voltageSelect).toHaveValue("380");

    await phaseSelect.selectOption("1");
    await expect(voltageSelect).toHaveValue("220");
    await expect(page.getByText(/Gerilim Modu/)).toHaveCount(0);

    await phaseSelect.selectOption("3");
    await expect(voltageSelect).toHaveValue("380");
    await expect(page.getByText(/Gerilim Modu/)).toBeVisible();
  });

  test("Formula Mode 3-phase LN matches LL numerically", async ({ page }) => {
    await gotoRoute(page, "/#/motor");
    await page.getByText(/Form.*Modu/).click();

    const phaseSelect = selectAfterLabel(page, /^Faz$/i);
    const voltageModeSelect = selectAfterLabel(page, /Gerilim Modu/);
    const currentValue = page
      .locator('xpath=//span[normalize-space()="Akim"]/following-sibling::span[1]')
      .first();
    const submitBtn = page.getByRole("button", { name: /Hesapla/ });

    await phaseSelect.selectOption("3");
    await voltageModeSelect.selectOption("LL");
    await submitBtn.click();
    await expect(currentValue).toBeVisible();
    const llCurrent = await currentValue.textContent();

    await voltageModeSelect.selectOption("LN");
    await submitBtn.click();
    await expect(currentValue).toBeVisible();
    const lnCurrent = await currentValue.textContent();

    expect(lnCurrent).toBe(llCurrent);
  });

  test("Table Mode â€” 22 kW 380V", async ({ page }) => {
    await gotoRoute(page, "/#/motor");
    await page.getByText("Tablo Modu").click();

    const kwSelect = selectAfterLabel(page, /Motor Gucu|kW/i);
    await kwSelect.selectOption("22");

    const radio380 = page.locator('input[name="voltage"][value="380"]');
    await page.locator("label").filter({ hasText: /^380 V$/ }).click();
    await expect(radio380).toBeChecked();
    await page.getByRole("button", { name: /Hesapla/ }).click();

    await expect(page.getByText(/30(?:[.,]0+)?\s*PS/)).toBeVisible();
    await expect(page.getByText(/0[,.]87/)).toBeVisible();
    await expect(page.getByText(/89(?:[.,]0+)?\s*%/)).toBeVisible();
    await expect(page.getByText(/43(?:[.,]0+)?\s*A/)).toBeVisible();
    await expect(page.getByText(/4\s*x\s*10/)).toBeVisible();
  });

  test("Table Mode â€” 110 kW 380V disabled", async ({ page }) => {
    await gotoRoute(page, "/#/motor");
    await page.getByText("Tablo Modu").click();

    const kwSelect = selectAfterLabel(page, /Motor Gucu|kW/i);
    await kwSelect.selectOption("110");

    const radio380 = page.locator('input[name="voltage"][value="380"]');
    await expect(radio380).toBeDisabled();

    const radio220 = page.locator('input[name="voltage"][value="220"]');
    await expect(radio220).toBeChecked();
    await page.getByRole("button", { name: /Hesapla/ }).click();

    await expect(page.getByText(/204(?:[.,]0+)?\s*A/)).toBeVisible();
  });
});
