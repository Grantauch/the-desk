/**
 * P01: read-only guest-browser acceptance against the REAL production Pond.
 *
 * This intentionally tests no preview deployment and never writes to an API.
 * Each scenario uses a fresh Playwright browser context; save data, mixes,
 * and simulation edits stay inside that disposable context.
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const BASE = process.env.POND_PRODUCTION_URL || "https://grant-desk.com/hubs/pond/";
const URL_ROOT = new URL(BASE);
if (URL_ROOT.hostname !== "grant-desk.com" || URL_ROOT.pathname !== "/hubs/pond/") {
  throw new Error("Refusing to sign off against a nonproduction Pond URL");
}
const OUT = "browser-results/pond-production";
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {}),
});
const outcomes = [];

async function inspect(viewport, mobile) {
  const context = await browser.newContext({
    viewport,
    hasTouch: mobile,
    acceptDownloads: false,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  const pageErrors = [];
  const pondAssets = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("response", response => {
    if (response.url().startsWith("https://grant-desk.com/hubs/pond/assets/")) {
      pondAssets.push({ url: response.url(), status: response.status() });
    }
  });
  try {
    const result = await page.goto(BASE, { waitUntil: "load", timeout: 45_000 });
    assert.equal(result?.status(), 200, "Public Pond document returns 200");

    // Check the deployed React interface and real, loaded JS/CSS assets.
    await page.getByRole("button", { name: "Make a mess", exact: true }).click();
    await page.getByRole("heading", { name: "Discovery lab", exact: true }).waitFor();
    await page.getByRole("heading", { name: "Field kit", exact: true }).waitFor();
    await page.getByRole("heading", { name: "World atlas", exact: true }).waitFor();
    await page.getByRole("button", { name: "Rich pixel graphics" }).waitFor();
    assert.ok(pondAssets.some(a => /\.js(?:\?|$)/.test(a.url) && a.status === 200),
      "Deployed Pond JavaScript asset loaded with 200");
    assert.ok(pondAssets.some(a => /\.css(?:\?|$)/.test(a.url) && a.status === 200),
      "Deployed Pond CSS asset loaded with 200");
    assert.equal(pondAssets.filter(a => a.status >= 400).length, 0, "No failed Pond asset responses");

    const canvas = page.getByRole("application", { name: /Living dish/ });
    assert.ok(await canvas.isVisible());
    const canvasSize = await canvas.evaluate(el => ({ w: el.width, h: el.height, bytes: el.toDataURL().length }));
    assert.equal(canvasSize.w, 192, "Initial simulation has a 192-cell real canvas");
    assert.equal(canvasSize.h, 192);
    assert.ok(canvasSize.bytes > 1000, "Simulation canvas contains pixels");

    // Painting and undo should act on the simulation rather than only the UI.
    await page.getByRole("button", { name: "Blank", exact: true }).click();
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.getByRole("button", { name: "Play", exact: true }).waitFor();
    await page.getByRole("button", { name: "Stone", exact: true }).click();
    const first = await canvas.evaluate(el => el.toDataURL());
    await canvas.click({ position: { x: 92, y: 92 } });
    await page.getByRole("button", { name: "Undo", exact: true }).waitFor({ state: "visible" });
    assert.equal(await page.getByRole("button", { name: "Undo", exact: true }).isEnabled(), true,
      "Painting creates an undo checkpoint");
    await page.waitForTimeout(80);
    const painted = await canvas.evaluate(el => el.toDataURL());
    assert.notEqual(painted, first, "Painting updates the visible simulation pixels");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await page.waitForTimeout(80);
    const undone = await canvas.evaluate(el => el.toDataURL());
    assert.notEqual(undone, painted, "Undo changes the painted simulation back");

    // One curated mix and its living specimen must be real, undoable gameplay.
    await page.getByRole("button", { name: "Mix Fire", exact: true }).click();
    await page.getByRole("button", { name: "Mix Water", exact: true }).click();
    await page.getByText(/Fire \+ Water = Steam/).waitFor();
    await page.getByRole("button", { name: "Place in pond", exact: true }).click();
    await canvas.click({ position: { x: 94, y: 95 } });
    await page.getByText(/1 living creations/).waitFor();
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await page.getByText(/0 living creations/).waitFor();

    // The primary mobile dock must select tools without blocking the world.
    if (mobile) {
      const quick = page.getByRole("navigation", { name: "Quick material tools" });
      assert.ok(await quick.isVisible(), "Mobile quick-material dock visible");
      await quick.getByRole("button", { name: "Quick Water", exact: true }).click();
      assert.equal(await quick.getByRole("button", { name: "Quick Water" }).getAttribute("aria-pressed"), "true");
    }

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    assert.equal(overflow, false, "No horizontal layout overflow");
    assert.deepEqual(pageErrors, [], "No uncaught JavaScript errors");
    const name = mobile ? "mobile-390" : "desktop-1365";
    await page.screenshot({ path: OUT + "/" + name + ".png", fullPage: true });
    const evidence = {
      viewport, publicURL: BASE, documentStatus: result.status(),
      deployedAssets: pondAssets, canvasSize, mixing: "Steam",
      specimenPlacementAndUndo: "passed", paintAndUndo: "passed",
      mobileQuickTools: mobile ? "passed" : "not applicable", jsErrors: pageErrors,
      horizontalOverflow: overflow, passed: true,
    };
    outcomes.push(evidence);
    console.log("PASS production Pond P01: " + name + " (mix, paint, undo, living specimen, asset loading)");
  } catch (error) {
    const name = mobile ? "mobile-390" : "desktop-1365";
    await page.screenshot({ path: OUT + "/" + name + "-failure.png", fullPage: true }).catch(() => {});
    outcomes.push({ viewport, publicURL: BASE, deployedAssets: pondAssets, jsErrors: pageErrors, passed: false, error: String(error) });
    throw error;
  } finally {
    await context.close();
  }
}

try {
  await inspect({ width: 390, height: 844 }, true);
  await inspect({ width: 1365, height: 900 }, false);
} finally {
  await writeFile(OUT + "/p01-results.json", JSON.stringify(outcomes, null, 2));
  await browser.close();
}
