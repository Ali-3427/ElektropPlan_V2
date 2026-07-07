import {
  test,
  expect,
  clearLocalStorageKeys,
  gotoRoute,
  inputAfterLabel,
  selectAfterLabel,
} from "./fixtures.js";

test.describe("Projects flow from saved records", () => {
  test("Motor formula record can be saved into a new project and group", async ({ page }) => {
    const projectName = `Motor Project ${Date.now()}`;
    const groupName = `Motor Group ${Date.now()}`;

    await clearLocalStorageKeys(page, ["elektroplan.page.projects"]);
    await gotoRoute(page, "/#/projects");
    await page.locator("main").getByRole("button", { name: /Yeni proje/i }).click();
    await page.locator("main input").first().fill(projectName);
    await page.locator("main").getByRole("button", { name: /^Kaydet$/i }).click();

    await gotoRoute(page, "/#/motor");

    await page.getByText(/Form.*Modu/).click();
    await page.getByRole("button", { name: /Hesapla/ }).click();
    await page.getByRole("button", { name: /^Kaydet$/i }).click();

    await selectAfterLabel(page, /^Proje$/i).selectOption({ label: projectName });
    await selectAfterLabel(page, /^Grup$/i).selectOption("__new__");
    await inputAfterLabel(page, /Yeni grup adi/i).fill(groupName);
    await page.getByRole("button", { name: /^Kaydet$/i }).last().click();

    await gotoRoute(page, "/#/projects");

    const projectCard = page.locator("main").getByRole("button", { name: new RegExp(projectName) }).first();
    await expect(projectCard).toBeVisible();
    await projectCard.click();
    await expect(page.locator("main").getByText(groupName).first()).toBeVisible();
    await expect(page.locator("main").getByText(/Motor/i).first()).toBeVisible();
  });

  test("Project groups can be created and deleted from the projects screen", async ({ page }) => {
    await clearLocalStorageKeys(page, ["elektroplan.page.projects"]);
    await gotoRoute(page, "/#/projects");

    await page.locator("main").getByRole("button", { name: /Yeni proje/i }).click();
    const projectName = `Projects Spec ${Date.now()}`;
    await page.locator("main input").first().fill(projectName);
    await page.locator("main").getByRole("button", { name: /^Kaydet$/i }).click();

    const groupName = `Grup A ${Date.now()}`;
    await page.getByPlaceholder(/Kat 1/i).fill(groupName);
    await page.locator("main").getByRole("button", { name: /Ol.*tur/i }).click();

    await expect(
      page.locator("main").getByRole("button", { name: new RegExp(projectName) }).first(),
    ).toBeVisible();
    await expect(page.locator("main").getByText(groupName).first()).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await page
      .locator("article")
      .filter({ hasText: groupName })
      .getByRole("button", { name: /^Sil$/i })
      .click();

    await expect(page.locator("main").locator("article").filter({ hasText: groupName })).toHaveCount(0);
  });
});
