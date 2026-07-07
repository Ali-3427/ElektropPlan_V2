import { test, expect, gotoRoute, inputAfterLabel, selectAfterLabel } from "./fixtures.js";

test.describe("Cable sizing screen", () => {
  test("Installation method dropdown has exactly {A1,A2,B1,B2,C,D,E}", async ({ page }) => {
    await gotoRoute(page, "/#/cable");
    await page.getByRole("button", { name: /Detayl.*Hesap/i }).click();

    const methodSelect = selectAfterLabel(page, /Montaj/i);
    const options = await methodSelect.locator("option").all();
    const values = await Promise.all(options.map((o) => o.getAttribute("value")));
    const labels = await Promise.all(options.map((o) => o.innerText()));

    const nonEmpty = values.filter((v): v is string => v !== null && v !== "");
    expect(labels.join(" ")).toContain("A1 -");
    expect(labels.join(" ")).toContain("D - Toprak");
    expect(nonEmpty.sort()).toEqual(["A1", "A2", "B1", "B2", "C", "D", "E"]);
  });

  test("Blank exact-ac inputs calculate with default assumptions and save into projects", async ({ page }) => {
    const projectName = `Cable Project ${Date.now()}`;
    const groupName = `Cable Group ${Date.now()}`;

    await gotoRoute(page, "/#/projects");
    await page.locator("main").getByRole("button", { name: /Yeni proje/i }).click();
    await page.getByPlaceholder(/AVM panolar/i).fill(projectName);
    await page.locator("main").getByRole("button", { name: /^Kaydet$/i }).click();

    await gotoRoute(page, "/#/cable");
    await page.getByRole("button", { name: /Detayl.*Hesap/i }).click();

    await selectAfterLabel(page, /Empedans/i).selectOption("exact-ac");

    await expect(page.locator('input[placeholder*="45"]').first()).toHaveValue("");
    await expect(page.locator('input[placeholder*="0.08"]').first()).toHaveValue("");

    const submitBtn = page.getByRole("button", { name: /Hesapla/ });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    await expect(page.getByText(/Kablo Seçim Sonucu/i)).toBeVisible();

    const assumptionsToggle = page.getByRole("button", { name: /Varsay/ });
    await expect(assumptionsToggle).toBeVisible();
    await assumptionsToggle.click();
    await expect(page.getByText(/designCurrentA/)).toBeVisible();
    await expect(page.getByText(/reactanceOhmPerKm/)).toBeVisible();
    await expect(page.getByText(/default/).first()).toBeVisible();

    await page.getByRole("button", { name: /Kaydet/ }).first().click();

    await selectAfterLabel(page, /^Proje$/i).selectOption({ label: projectName });
    await selectAfterLabel(page, /^Grup$/i).selectOption("__new__");
    await inputAfterLabel(page, /Yeni grup adi/i).fill(groupName);
    await page.getByRole("button", { name: /^Kaydet$/ }).last().click();

    await gotoRoute(page, "/#/projects");

    await expect(
      page.locator("main").getByRole("button", { name: new RegExp(projectName) }).first(),
    ).toBeVisible();
  });
});
