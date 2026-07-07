import {
  test,
  expect,
  clearLocalStorageKeys,
  gotoRoute,
  inputInLabeledField,
  voltageDropTreeScenarioFixture,
} from "./fixtures.js";
import type { Page } from "@playwright/test";

// Run note: these specs target Playwright's Electron project; if Electron launch is blocked in your environment, use a local manual UI pass on /#/voltage-drop as a fallback check.

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseTrNumber(value: string): number {
  return Number(value.trim().replace(/\./g, "").replace(",", "."));
}

async function ensureSidebarExpanded(page: Page) {
  const shell = page.locator("[data-sidebar-collapsed]").first();
  await expect(shell).toBeVisible();

  const collapsed = (await shell.getAttribute("data-sidebar-collapsed")) === "true";
  if (!collapsed) {
    return;
  }

  await page.getByRole("button", { name: /Menuyu genislet/i }).first().click();
  await expect(shell).toHaveAttribute("data-sidebar-collapsed", "false");
}

async function ensureSidebarCollapsed(page: Page) {
  const shell = page.locator("[data-sidebar-collapsed]").first();
  await expect(shell).toBeVisible();

  const collapsed = (await shell.getAttribute("data-sidebar-collapsed")) === "true";
  if (collapsed) {
    return;
  }

  await page.getByRole("button", { name: /Menuyu daralt/i }).first().click();
  await expect(shell).toHaveAttribute("data-sidebar-collapsed", "true");
}

function inspector(page: Page) {
  return page.locator("section").filter({ hasText: /Segment denetleyici/i }).first();
}

function segmentList(page: Page) {
  return page.locator("section").filter({ hasText: /Segment listesi/i }).first();
}

function treeCard(page: Page) {
  return page.locator("section").filter({ hasText: /Segment agaci/i }).first();
}

function treeSvg(page: Page) {
  return page.getByRole("img", { name: /Segment agaci/i });
}

function treeToolbar(page: Page) {
  return page.getByLabel(/Segment agi araclari/i);
}

async function setSelectedSegmentValues(
  page: Page,
  values: { title?: string; kW?: string; lengthM?: string },
) {
  const panel = inspector(page);
  if (values.title !== undefined) {
    await inputInLabeledField(panel, /Brans adi/i).fill(values.title);
  }
  if (values.kW !== undefined) {
    await inputInLabeledField(panel, /Yuk \(kW\)/i).fill(values.kW);
  }
  if (values.lengthM !== undefined) {
    await inputInLabeledField(panel, /Uzunluk \(m\)/i).fill(values.lengthM);
  }
}

async function selectCanvasNode(page: Page, title: string) {
  const trigger = segmentList(page).getByRole(
    "button",
    { name: new RegExp(`^${escapeRegExp(title)}\\s+segmentini\\s+sec$`, "i") },
  );
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-pressed", "true");
}

async function selectSegmentFromList(page: Page, title: string) {
  const trigger = segmentList(page).getByRole("button", {
    name: new RegExp(`${escapeRegExp(title)}\\s+segmentini\\s+sec`, "i"),
  }).first();
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-pressed", "true");
}

async function addChildFromList(page: Page, title: string) {
  const trigger = segmentList(page).getByRole("button", {
    name: new RegExp(`^${escapeRegExp(title)}\\s+segmentini\\s+sec$`, "i"),
  }).first();
  const row = trigger.locator("xpath=ancestor::div[contains(@class, 'row')][1]");
  await row.getByRole("button", { name: /^Alt segment$/i }).click();
}

function resultRowByTitle(page: Page, title: string) {
  return page.locator(`xpath=//tbody/tr[td[1][normalize-space()="${title}"]]`).first();
}

test.describe("Voltage drop screen", () => {
  test("builds the tree fixture and validates flow/path expectations", async ({ page }) => {
    await clearLocalStorageKeys(page, ["elektroplan.page.voltageDrop"]);
    await gotoRoute(page, "/#/voltage-drop");
    await ensureSidebarExpanded(page);

    await expect(page.getByText(/Gerilim Dusumu/i)).toBeVisible();
    await inputInLabeledField(page, /Grup adi/i).fill(`Tree Scenario ${Date.now()}`);

    await setSelectedSegmentValues(page, {
      title: "Ana besleme",
      kW: "0.1",
      lengthM: "150",
    });
    await addChildFromList(page, "Ana besleme");
    await addChildFromList(page, "Ana besleme");

    await selectCanvasNode(page, "Segment 2");
    await setSelectedSegmentValues(page, {
      title: "Dal 1",
      kW: "10",
      lengthM: "40",
    });

    await selectCanvasNode(page, "Segment 3");
    await setSelectedSegmentValues(page, {
      title: "Dal 2",
      kW: "8",
      lengthM: "35",
    });

    await selectCanvasNode(page, "Dal 1");
    await addChildFromList(page, "Dal 1");

    await selectCanvasNode(page, "Segment 4");
    await setSelectedSegmentValues(page, {
      title: "Dal 1.1",
      kW: "3",
      lengthM: "20",
    });

    const calculateButton = page.getByRole("button", { name: /^Hesapla$/i });
    await expect(calculateButton).toBeEnabled();
    await calculateButton.click();

    for (const [title, expectedFlow] of Object.entries(
      voltageDropTreeScenarioFixture.expectedFlowPowerKWByTitle,
    )) {
      const row = resultRowByTitle(page, title);
      await expect(row).toBeVisible();
      const flowText = await row.locator("td").nth(3).innerText();
      expect(parseTrNumber(flowText)).toBe(expectedFlow);
    }

    await expect(resultRowByTitle(page, "Dal 2").locator("td").nth(2)).toHaveText(/^Dal 2$/i);
  });

  test("supports updated UI interactions and shows result row with automatic section label", async ({
    page,
  }) => {
    await clearLocalStorageKeys(page, ["elektroplan.page.voltageDrop"]);
    await gotoRoute(page, "/#/voltage-drop");
    await ensureSidebarExpanded(page);

    const shell = page.locator("[data-sidebar-collapsed]").first();
    const main = page.locator("main").first();
    const canvasCard = treeCard(page);

    const mainBefore = await main.boundingBox();
    const canvasBefore = await canvasCard.boundingBox();
    expect(mainBefore).not.toBeNull();
    expect(canvasBefore).not.toBeNull();

    await page.getByRole("button", { name: /Menuyu daralt/i }).first().click();
    await expect(shell).toHaveAttribute("data-sidebar-collapsed", "true");

    const mainAfter = await main.boundingBox();
    const canvasAfter = await canvasCard.boundingBox();
    expect(mainAfter).not.toBeNull();
    expect(canvasAfter).not.toBeNull();
    expect(mainAfter!.width).toBeGreaterThan(mainBefore!.width + 50);
    expect(canvasAfter!.width).toBeGreaterThan(canvasBefore!.width);

    await setSelectedSegmentValues(page, { title: "Ana besleme", kW: "5", lengthM: "60" });
    await addChildFromList(page, "Ana besleme");
    await selectCanvasNode(page, "Segment 2");
    await setSelectedSegmentValues(page, { title: "Dal 1", kW: "3", lengthM: "25" });
    await selectCanvasNode(page, "Dal 1");

    await page.getByRole("button", { name: /^Hesapla$/i }).click();
    const row = resultRowByTitle(page, "Dal 1");
    await expect(row).toBeVisible();
    await expect(row.locator("td").nth(5)).toHaveText(/Otomatik:\s*\d+/i);
  });

  test("supports list-driven editing with tree hidden and keeps add-child selection-aware", async ({
    page,
  }) => {
    await clearLocalStorageKeys(page, ["elektroplan.page.voltageDrop"]);
    await gotoRoute(page, "/#/voltage-drop");
    await ensureSidebarExpanded(page);

    await expect(segmentList(page)).toBeVisible();
    await page.getByRole("button", { name: /Agaci gizle/i }).click();
    await expect(page.getByRole("button", { name: /Agaci goster/i })).toBeVisible();
    await expect(treeCard(page)).toHaveCount(0);
    await expect(segmentList(page)).toBeVisible();

    await setSelectedSegmentValues(page, {
      title: "Ana besleme",
      kW: "0.1",
      lengthM: "120",
    });

    await page.getByRole("button", { name: /Seciliye alt segment/i }).click();
    await selectSegmentFromList(page, "Segment 2");
    await setSelectedSegmentValues(page, {
      title: "Dal 1",
      kW: "6",
      lengthM: "35",
    });

    await page.getByRole("button", { name: /Seciliye alt segment/i }).click();
    await selectSegmentFromList(page, "Segment 3");
    await setSelectedSegmentValues(page, {
      title: "Dal 1.1",
      kW: "2",
      lengthM: "18",
    });

    await page.getByRole("button", { name: /^Hesapla$/i }).click();

    const row = resultRowByTitle(page, "Dal 1.1");
    await expect(row).toBeVisible();
    await expect(segmentList(page).getByText(/Ust: Dal 1/i)).toBeVisible();
    await expect(row.locator("td").nth(2)).toHaveText(/^Dal 1\.1$/i);
  });

  test("auto-fits the tree after layout changes and grows canvas height for larger trees", async ({
    page,
  }) => {
    await clearLocalStorageKeys(page, ["elektroplan.page.voltageDrop"]);
    await gotoRoute(page, "/#/voltage-drop");
    await ensureSidebarExpanded(page);

    const shell = page.locator("[data-sidebar-collapsed]").first();
    const canvasCard = treeCard(page);
    const canvasViewport = canvasCard.locator("svg").locator("xpath=ancestor::div[contains(@class, 'canvas')][1]");

    const viewBoxBefore = await treeSvg(page).getAttribute("viewBox");
    const canvasBefore = await canvasViewport.boundingBox();
    expect(viewBoxBefore).not.toBeNull();
    expect(canvasBefore).not.toBeNull();

    await setSelectedSegmentValues(page, { title: "Ana besleme" });
    for (let index = 0; index < 6; index += 1) {
      await addChildFromList(page, "Ana besleme");
    }

    const canvasAfterGrowth = await canvasViewport.boundingBox();
    expect(canvasAfterGrowth).not.toBeNull();
    expect(canvasAfterGrowth!.height).toBeGreaterThan(canvasBefore!.height + 40);

    await page.getByRole("button", { name: /Menuyu daralt/i }).first().click();
    await expect(shell).toHaveAttribute("data-sidebar-collapsed", "true");

    const viewBoxAfterResize = await treeSvg(page).getAttribute("viewBox");
    const canvasAfterResize = await canvasCard.boundingBox();
    expect(canvasAfterResize).not.toBeNull();
    expect(canvasAfterResize!.width).toBeGreaterThan(canvasBefore!.width);
    expect(viewBoxAfterResize).not.toBe(viewBoxBefore);
  });

  test("restores calculated result, save action, and tree visibility from persisted page state", async ({
    page,
  }) => {
    await clearLocalStorageKeys(page, ["elektroplan.page.voltageDrop"]);
    await gotoRoute(page, "/#/voltage-drop");
    await ensureSidebarExpanded(page);

    await inputInLabeledField(page, /Grup adi/i).fill(`Kalici grup ${Date.now()}`);
    await setSelectedSegmentValues(page, {
      title: "Ana besleme",
      kW: "4",
      lengthM: "60",
    });
    await page.getByRole("button", { name: /Seciliye alt segment/i }).click();
    await selectCanvasNode(page, "Segment 2");
    await setSelectedSegmentValues(page, {
      title: "Dal 1",
      kW: "2",
      lengthM: "24",
    });

    await page.getByRole("button", { name: /^Hesapla$/i }).click();
    await expect(resultRowByTitle(page, "Dal 1")).toBeVisible();

    const saveButton = page.getByRole("button", { name: /^Kaydet$/i });
    await expect(saveButton).toBeEnabled();

    await page.getByRole("button", { name: /Agaci gizle/i }).click();
    await expect(page.getByRole("button", { name: /Agaci goster/i })).toBeVisible();
    await page.waitForFunction(() => {
      const raw = globalThis.localStorage.getItem("elektroplan.page.voltageDrop");
      if (!raw) return false;
      try {
        return JSON.parse(raw).value?.treeVisible === false;
      } catch {
        return false;
      }
    });

    await gotoRoute(page, "/#/projects");
    await gotoRoute(page, "/#/voltage-drop");

    await expect(inputInLabeledField(page, /Grup adi/i)).toHaveValue(/Kalici grup/i);
    await expect(resultRowByTitle(page, "Dal 1")).toBeVisible();
    await expect(page.getByRole("button", { name: /Agaci goster/i })).toBeVisible();
    await expect(saveButton).toBeEnabled();
  });

  const responsiveViewports = [
    { label: "desktop-wide", width: 1440, height: 900 },
    { label: "desktop-compact", width: 1280, height: 800 },
    { label: "mobile", width: 390, height: 844 },
  ] as const;

  for (const viewport of responsiveViewports) {
    test(`responsive QA (${viewport.label})`, async ({ page }) => {
      await clearLocalStorageKeys(page, ["elektroplan.page.voltageDrop"]);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await gotoRoute(page, "/#/voltage-drop");
      if (viewport.width <= 480) {
        await ensureSidebarCollapsed(page);
      } else {
        await ensureSidebarExpanded(page);
      }

      const heading = page.getByText(/Gerilim Dusumu/i).first();
      const calculateButton = page.getByRole("button", { name: /^Hesapla$/i });
      const canvasSvg = treeSvg(page);
      const canvasCard = treeCard(page);
      const inspectorCard = page.locator("section").filter({ hasText: /Segment denetleyici/i }).first();

      if (viewport.width > 480) {
        await expect(heading).toBeVisible();
      }
      await expect(calculateButton).toBeVisible();
      await expect(canvasSvg).toBeVisible();

      const headingBox = viewport.width > 480 ? await heading.boundingBox() : null;
      const calculateBox = await calculateButton.boundingBox();
      const canvasBox = await canvasSvg.boundingBox();
      const canvasCardBox = await canvasCard.boundingBox();
      const inspectorCardBox = await inspectorCard.boundingBox();

      if (viewport.width > 480) {
        expect(headingBox).not.toBeNull();
      }
      expect(calculateBox).not.toBeNull();
      expect(canvasBox).not.toBeNull();
      expect(canvasCardBox).not.toBeNull();
      expect(inspectorCardBox).not.toBeNull();

      if (headingBox) {
        const overlap =
          headingBox.x < calculateBox!.x + calculateBox!.width &&
          headingBox.x + headingBox.width > calculateBox!.x &&
          headingBox.y < calculateBox!.y + calculateBox!.height &&
          headingBox.y + headingBox.height > calculateBox!.y;
        expect(overlap).toBe(false);
      }
      expect(canvasBox!.width).toBeGreaterThan(viewport.width <= 480 ? 120 : 200);
      expect(canvasBox!.height).toBeGreaterThan(
        viewport.width <= 480 ? 70 : viewport.width <= 1280 ? 120 : 200,
      );

      if (viewport.width <= 1120) {
        expect(inspectorCardBox!.y).toBeGreaterThan(canvasCardBox!.y + 100);
      } else {
        expect(inspectorCardBox!.x).toBeGreaterThan(canvasCardBox!.x + 100);
      }

      if (viewport.width <= 480) {
        return;
      }

      await setSelectedSegmentValues(page, { title: "Ana besleme", kW: "4", lengthM: "50" });
      await page.getByRole("button", { name: /Seciliye alt segment/i }).click();
      await selectCanvasNode(page, "Segment 2");
      await setSelectedSegmentValues(page, { title: "Dal 1", kW: "2", lengthM: "20" });
      await page.getByRole("button", { name: /^Hesapla$/i }).click();

      const table = page.locator("table").first();
      await expect(table).toBeVisible();

      if (viewport.width <= 390) {
        const tableWrap = table.locator("xpath=ancestor::div[1]");
        const scrollMetrics = await tableWrap.evaluate((node) => ({
          overflowX:
            node.ownerDocument.defaultView?.getComputedStyle(node).overflowX ?? "",
          scrollWidth: node.scrollWidth,
          clientWidth: node.clientWidth,
        }));
        expect(scrollMetrics.overflowX).toBe("auto");
        if (scrollMetrics.scrollWidth > scrollMetrics.clientWidth) {
          expect(scrollMetrics.scrollWidth).toBeGreaterThan(scrollMetrics.clientWidth);
        }
      }
    });
  }
});
