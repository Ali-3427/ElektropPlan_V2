# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\e2e\src\pageState.spec.ts >> settings and materials drafts survive route navigation
- Location: tests\e2e\src\pageState.spec.ts:18:1

# Error details

```
Error: Failed to launch the Playwright Electron project. Remediation: reinstall Electron dependencies (for example, run your install/bootstrap step again). Also inspect the test runner stderr/stdout logs for detailed launch diagnostics.
```

# Test source

```ts
  1  | import { test as base, expect, _electron as electron } from "@playwright/test";
  2  | import type { ElectronApplication, Locator, Page } from "@playwright/test";
  3  | import path from "node:path";
  4  | import { fileURLToPath } from "node:url";
  5  | 
  6  | const __dirname = path.dirname(fileURLToPath(import.meta.url));
  7  | const mainEntry = path.resolve(
  8  |   __dirname,
  9  |   "../../../apps/desktop/main/dist/index.js"
  10 | );
  11 | 
  12 | export const test = base.extend<{ app: ElectronApplication; page: Page }>({
  13 |   app: async ({}, use) => {
  14 |     let app: ElectronApplication;
  15 |     try {
  16 |       app = await electron.launch({
  17 |         args: [mainEntry],
  18 |         env: { ...process.env, NODE_ENV: "test" },
  19 |       });
  20 |     } catch (error) {
> 21 |       throw new Error(
     |             ^ Error: Failed to launch the Playwright Electron project. Remediation: reinstall Electron dependencies (for example, run your install/bootstrap step again). Also inspect the test runner stderr/stdout logs for detailed launch diagnostics.
  22 |         [
  23 |           "Failed to launch the Playwright Electron project.",
  24 |           "Remediation: reinstall Electron dependencies (for example, run your install/bootstrap step again).",
  25 |           "Also inspect the test runner stderr/stdout logs for detailed launch diagnostics.",
  26 |         ].join(" "),
  27 |         { cause: error },
  28 |       );
  29 |     }
  30 |     await use(app);
  31 |     await app.close();
  32 |   },
  33 |   page: async ({ app }, use) => {
  34 |     const page = await app.firstWindow();
  35 |     await page.waitForLoadState("domcontentloaded");
  36 |     await use(page);
  37 |   },
  38 | });
  39 | 
  40 | export function inputAfterLabel(page: Page, label: RegExp, index = 0) {
  41 |   return page
  42 |     .locator("label")
  43 |     .filter({ hasText: label })
  44 |     .nth(index)
  45 |     .locator("xpath=following-sibling::input[1]");
  46 | }
  47 | 
  48 | export function selectAfterLabel(page: Page, label: RegExp, index = 0) {
  49 |   return page
  50 |     .locator("label")
  51 |     .filter({ hasText: label })
  52 |     .nth(index)
  53 |     .locator("xpath=following-sibling::select[1]");
  54 | }
  55 | 
  56 | type LabeledControlRoot = Page | Locator;
  57 | 
  58 | export function inputInLabeledField(
  59 |   root: LabeledControlRoot,
  60 |   label: RegExp,
  61 |   index = 0,
  62 | ) {
  63 |   return root.locator("label").filter({ hasText: label }).nth(index).locator("input").first();
  64 | }
  65 | 
  66 | export const voltageDropTreeScenarioFixture = {
  67 |   nodes: [
  68 |     { title: "Ana besleme", parentTitle: null, loadPowerKW: "0", lengthM: "150" },
  69 |     { title: "Dal 1", parentTitle: "Ana besleme", loadPowerKW: "10", lengthM: "40" },
  70 |     { title: "Dal 2", parentTitle: "Ana besleme", loadPowerKW: "8", lengthM: "35" },
  71 |     { title: "Dal 1.1", parentTitle: "Dal 1", loadPowerKW: "3", lengthM: "20" },
  72 |   ],
  73 |   expectedFlowPowerKWByTitle: {
  74 |     "Ana besleme": 21,
  75 |     "Dal 1": 13,
  76 |     "Dal 2": 8,
  77 |     "Dal 1.1": 3,
  78 |   },
  79 |   expectedPathByTitle: {
  80 |     "Dal 2": ["Ana besleme", "Dal 2"],
  81 |   },
  82 | } as const;
  83 | 
  84 | export { expect };
  85 | 
```