import { test as base, expect, _electron as electron } from "@playwright/test";
import type { ElectronApplication, Locator, Page } from "@playwright/test";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mainEntry = path.resolve(
  __dirname,
  "../../../apps/desktop/main/dist/index.js"
);
const desktopPackageEntry = path.resolve(
  __dirname,
  "../../../apps/desktop/package.json"
);
const desktopRequire = createRequire(desktopPackageEntry);

function resolveElectronExecutable(): string {
  return desktopRequire("electron");
}

export const test = base.extend<{ app: ElectronApplication; page: Page }>({
  app: async ({}, use) => {
    let app: ElectronApplication;
    try {
      app = await electron.launch({
        executablePath: resolveElectronExecutable(),
        args: [mainEntry],
        env: { ...process.env, NODE_ENV: "test" },
      });
    } catch (error) {
      throw new Error(
        [
          "Failed to launch the Playwright Electron project.",
          "Remediation: reinstall Electron dependencies (for example, run your install/bootstrap step again).",
          "Also inspect the test runner stderr/stdout logs for detailed launch diagnostics.",
        ].join(" "),
        { cause: error },
      );
    }
    await use(app);
    await app.close();
  },
  page: async ({ app }, use) => {
    const page = await app.firstWindow();
    await page.waitForLoadState("domcontentloaded");
    await use(page);
  },
});

export function inputAfterLabel(page: Page, label: RegExp, index = 0) {
  const labeledField = page.locator("label").filter({ hasText: label }).nth(index);
  return labeledField
    .locator("input, textarea")
    .first()
    .or(labeledField.locator("xpath=following-sibling::*[self::input or self::textarea][1]"));
}

export function selectAfterLabel(page: Page, label: RegExp, index = 0) {
  const labeledField = page.locator("label").filter({ hasText: label }).nth(index);
  return labeledField
    .locator("select")
    .first()
    .or(labeledField.locator("xpath=following-sibling::select[1]"));
}

type LabeledControlRoot = Page | Locator;

export function inputInLabeledField(
  root: LabeledControlRoot,
  label: RegExp,
  index = 0,
) {
  const labeledField = root.locator("label").filter({ hasText: label }).nth(index);
  return labeledField
    .locator("input, textarea")
    .first()
    .or(labeledField.locator("xpath=following-sibling::*[self::input or self::textarea][1]"));
}

export async function gotoRoute(page: Page, route: string) {
  const normalizedPath = route.startsWith("/#/")
    ? route.slice(2)
    : route.startsWith("#/")
      ? route.slice(1)
      : route.startsWith("/")
        ? route
        : `/${route}`;
  await page.evaluate((nextPath) => {
    (globalThis as { location?: { hash: string } }).location!.hash = nextPath;
  }, normalizedPath);
  await page.waitForFunction(
    (nextPath) => (globalThis as { location?: { hash: string } }).location?.hash === `#${nextPath}`,
    normalizedPath,
  );
}

export async function clearLocalStorageKeys(page: Page, keys: string[]) {
  await page.evaluate((nextKeys) => {
    for (const key of nextKeys) {
      globalThis.localStorage?.removeItem(key);
    }
  }, keys);
}

export const voltageDropTreeScenarioFixture = {
  nodes: [
    { title: "Ana besleme", parentTitle: null, loadPowerKW: "0.1", lengthM: "150" },
    { title: "Dal 1", parentTitle: "Ana besleme", loadPowerKW: "10", lengthM: "40" },
    { title: "Dal 2", parentTitle: "Ana besleme", loadPowerKW: "8", lengthM: "35" },
    { title: "Dal 1.1", parentTitle: "Dal 1", loadPowerKW: "3", lengthM: "20" },
  ],
  expectedFlowPowerKWByTitle: {
    "Ana besleme": 21.1,
    "Dal 1": 13,
    "Dal 2": 8,
    "Dal 1.1": 3,
  },
  expectedPathByTitle: {
    "Dal 2": ["Ana besleme", "Dal 2"],
  },
} as const;

export { expect };
