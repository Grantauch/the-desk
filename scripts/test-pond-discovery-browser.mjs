import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, extname, sep } from "node:path";
import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("../public/hubs/pond/", import.meta.url)));
const url = "http://127.0.0.1:4399/hubs/pond/";
const out = fileURLToPath(new URL("../browser-results/pond-discovery/", import.meta.url));
await mkdir(out, { recursive: true });

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
};
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, url).pathname);
    if (!pathname.startsWith("/hubs/pond/")) { response.writeHead(404).end(); return; }
    const candidate = resolve(root, "." + pathname.slice("/hubs/pond".length), pathname.endsWith("/") ? "index.html" : "");
    if (!candidate.startsWith(root + sep)) { response.writeHead(404).end(); return; }
    const body = await readFile(candidate);
    response.writeHead(200, { "content-type": types[extname(candidate)] ?? "application/octet-stream", "cache-control": "no-store" }).end(body);
  } catch { response.writeHead(404).end(); }
});

await new Promise((done, fail) => {
  server.once("error", fail);
  server.listen(4399, "127.0.0.1", done);
});
let browser;
let cases = 0;

async function run(viewport) {
  const context = await browser.newContext({ viewport });
  await context.route("**/*", route => {
    const address = new URL(route.request().url());
    return address.origin === new URL(url).origin ?
      route.continue() : route.fulfill({ status: 503, body: "Offline fixture" });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.setDefaultTimeout(10000);
  try {
    const response = await page.goto(url, { waitUntil: "load" });
    assert.equal(response.status(), 200);
    await page.getByRole("button", { name: "Make a mess" }).click();
    await page.getByRole("heading", { name: "Discovery lab" }).waitFor();
    // Layout contract: desktop has a three-zone field station; mobile puts
    // the living pond first, tools second and the ledger below.
    const chamber = page.locator(".field-observation");
    const notebook = page.locator(".field-ledger");
    const fieldKit = page.locator(".field-materials");
    assert.ok(await chamber.isVisible() && await notebook.isVisible() && await fieldKit.isVisible());
    const [chamberBox, notebookBox, kitBox] = await Promise.all([
      chamber.boundingBox(), notebook.boundingBox(), fieldKit.boundingBox(),
    ]);
    assert.ok(chamberBox && notebookBox && kitBox);
    if (viewport.width <= 400) {
      assert.ok(chamberBox.y < kitBox.y && kitBox.y < notebookBox.y, "mobile should keep observation above tools and discovery");
      assert.ok(chamberBox.width > 300, "mobile observation must use the device width");
    } else {
      assert.ok(notebookBox.x < chamberBox.x && chamberBox.x < kitBox.x, "desktop should use ledger / chamber / tools columns");
      assert.ok(Math.abs(notebookBox.y - chamberBox.y) < 70, "desktop regions begin at the same baseline");
    }
    assert.ok(await page.locator(".field-stage-plinth").isVisible(), "bespoke glass field stage must render");
    assert.ok(await page.getByRole("group", { name: "Crafting slots" }).isVisible());
    assert.ok(await page.getByRole("group", { name: "Materials" }).isVisible());
    // The field route makes the previously separate workbenches reachable
    // without rewriting any physics, recipes, world, or save state.
    const stations = page.getByRole("navigation", { name: "Pond field workflow" });
    assert.ok(await stations.isVisible());
    await stations.getByRole("button", { name: "Go to discovery mixing" }).click();
    await page.waitForFunction(() => document.activeElement?.id === "pond-discovery-lab");
    await stations.getByRole("button", { name: "Go to materials and painting" }).click();
    await page.waitForFunction(() => document.activeElement?.id === "pond-field-kit");
    await stations.getByRole("button", { name: "Go to world expansion or Atlas" }).click();
    await page.waitForFunction(() => document.activeElement?.id === "pond-world-controls");
    await stations.getByRole("button", { name: "Go to world backups and imports" }).click();
    await page.waitForFunction(() => document.activeElement?.id === "pond-field-archive");
    assert.ok(await page.locator(".field-specimen-grid button").count() <= 12,
      "initial discovery list should not bury the Atlas on mobile");

    if (viewport.width <= 400) {
      const quick = page.getByRole("navigation", { name: "Quick material tools" });
      assert.ok(await quick.isVisible(), "mobile quick-material dock must be reachable");
      await quick.getByRole("button", { name: "Quick Water" }).click();
      assert.equal(await quick.getByRole("button", { name: "Quick Water" }).getAttribute("aria-pressed"), "true");
      await quick.getByRole("button", { name: "Quick Sand" }).click();
      assert.equal(await quick.getByRole("button", { name: "Quick Sand" }).getAttribute("aria-pressed"), "true");
    }
    await page.getByRole("button", { name: "Mix Fire" }).click();
    await page.getByRole("button", { name: "Mix Water" }).click();
    await page.getByText(/Fire \+ Water = Steam/).waitFor();
    assert.ok(await page.getByRole("button", { name: "Place in pond" }).isVisible());
    await page.getByRole("button", { name: "Place in pond" }).click();
    const canvas = page.getByRole("application", { name: /Living dish/ });
    const box = await canvas.boundingBox();
    assert.ok(box);
    await canvas.click({ position: { x: box.width * 0.5, y: box.height * 0.5 } });
    await page.getByText(/1 living creations/).waitFor();
    await page.getByRole("button", { name: "Undo" }).click();
    await page.getByText(/0 living creations/).waitFor();

    // Undo pauses the pond but creation placement is still allowed.
    await canvas.click({ position: { x: box.width * 0.52, y: box.height * 0.48 } });
    await page.getByText(/1 living creations/).waitFor();
    // The richer graphics are a real render option, not just a CSS label.
    // Undo has paused physics, so compare the same world in both render modes.
    const graphics = pressed => page.getByRole("button", { name: "Rich pixel graphics", exact: true, pressed });
    await graphics(true).click();
    await graphics(false).waitFor();
    await page.waitForTimeout(100);
    const classicPixels = await page.getByRole("application").evaluate(el => el.toDataURL());
    await graphics(false).click();
    await graphics(true).waitFor();
    await page.waitForTimeout(100);
    const richPixels = await page.getByRole("application").evaluate(el => el.toDataURL());
    assert.notEqual(richPixels, classicPixels, "enhanced renderer must visually differ from the original");
    assert.equal(await page.evaluate(() => localStorage.getItem("pond-rich-graphics")), "1");
    await graphics(true).click();
    await graphics(false).waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem("pond-rich-graphics")), "0");
    await page.reload({ waitUntil: "load" });
    await page.getByRole("button", { name: "Make a mess" }).click();
    await graphics(false).waitFor();
    await graphics(false).click();
    await graphics(true).waitFor();
    await page.getByText(/1 living creations/).waitFor();
    await page.getByRole("button", { name: "Mix Steam" }).waitFor();

    // Expansion must add real simulation cells, not simply stretch the canvas.
    await page.getByRole("button", { name: /Expand pond to 256/ }).click();
    assert.equal(await page.getByRole("application").evaluate(el => el.width), 256);
    await page.getByText("256 × 256", { exact: false }).first().waitFor();
    await page.getByRole("button", { name: /Expand pond to 320/ }).click();
    assert.equal(await page.getByRole("application").evaluate(el => el.width), 320);
    await page.getByRole("button", { name: "Undo" }).click();
    assert.equal(await page.getByRole("application").evaluate(el => el.width), 256, "undo must restore the previous stage");
    await page.getByText(/1 living creations/).waitFor();
    await page.getByRole("button", { name: /Expand pond to 320/ }).click();
    assert.equal(await page.getByRole("application").evaluate(el => el.width), 320);
    await page.getByRole("button", { name: "Mix Steam" }).click();
    await page.getByRole("button", { name: "Place in pond" }).click();
    const expandedCanvas = page.getByRole("application");
    const expandedBox = await expandedCanvas.boundingBox();
    assert.ok(expandedBox);
    // New resident is placed in the NEW outer ring, outside the 192-cell bowl.
    await expandedCanvas.click({ position: { x: expandedBox.width * 0.86, y: expandedBox.height * 0.5 } });
    await page.getByText(/2 living creations/).waitFor();
    await page.reload({ waitUntil: "load" });
    await page.getByRole("button", { name: "Make a mess" }).click();
    assert.equal(await page.getByRole("application").evaluate(el => el.width), 320);
    await page.getByText(/2 living creations/).waitFor();

    // Build a world far beyond one viewport. The camera renders a crop instead
    // of scaling all 768 cells into the original circular canvas.
    await page.getByRole("button", { name: /Expand pond to 448/ }).click();
    assert.equal(await page.getByRole("application").evaluate(el => el.width), 256);
    await page.getByRole("button", { name: "Zoom in" }).click();
    assert.equal(await page.getByRole("application").evaluate(el => el.width), 192);
    await page.getByRole("button", { name: "Zoom out" }).click();
    assert.equal(await page.getByRole("application").evaluate(el => el.width), 256);
    await page.getByRole("button", { name: /Expand pond to 576/ }).click();
    await page.getByRole("button", { name: /Expand pond to 768/ }).click();
    assert.equal(await page.getByRole("application").evaluate(el => el.width), 256);
    await stations.getByRole("button", { name: "Go to world expansion or Atlas" }).click();
    await page.waitForFunction(() => document.activeElement?.id === "pond-field-atlas");

    const nav = page.getByRole("region", { name: "World navigation" });
    const atlas = page.getByRole("region", { name: "Exploration atlas" });
    await atlas.getByRole("heading", { name: "World atlas" }).waitFor();
    await atlas.getByText(/% explored/).waitFor();
    await atlas.getByText("Discovered locations").waitFor();
    assert.ok(await atlas.getByRole("button", { name: "Select a location on the world map to explore" }).isVisible());
    const beforePan = await nav.locator(".field-nav-top small").textContent();
    const largeCanvas = page.getByRole("application");
    const rect = await largeCanvas.boundingBox();
    assert.ok(rect);
    // Drag to explore, then move to a distant outer region with the controls.
    await page.mouse.move(rect.x + rect.width * 0.75, rect.y + rect.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(rect.x + rect.width * 0.35, rect.y + rect.height * 0.5, { steps: 8 });
    await page.mouse.up();
    for (let n = 0; n < 6; n++) await page.getByRole("button", { name: "Pan world right" }).click();
    const afterPan = await nav.locator(".field-nav-top small").textContent();
    assert.notEqual(afterPan, beforePan, "drag-and-pan changes the world camera");
    await atlas.getByRole("button", { name: "Select a location on the world map to explore" })
      .click({ position: { x: 235, y: 155 } });
    const afterAtlasJump = await nav.locator(".field-nav-top small").textContent();
    assert.notEqual(afterAtlasJump, afterPan, "the atlas should navigate the world camera");
    await page.getByRole("button", { name: "Explore: on" }).click();
    // Selection still works when returning to painting/placement mode.
    await page.getByRole("button", { name: "Mix Steam" }).click();
    await page.getByRole("button", { name: "Place in pond" }).click();
    const farCanvas = page.getByRole("application");
    const farRect = await farCanvas.boundingBox();
    assert.ok(farRect);
    await farCanvas.click({ position: { x: farRect.width * 0.5, y: farRect.height * 0.5 } });
    await page.getByText(/3 living creations/).waitFor();
    await page.reload({ waitUntil: "load" });
    await page.getByRole("button", { name: "Make a mess" }).click();
    assert.equal(await page.getByRole("application").evaluate(el => el.width), 256, "large world uses camera viewport");
    await page.getByText(/3 living creations/).waitFor();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export world" }).click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), "pond-world.json");
    const bytes = await readFile(await download.path(), "utf-8");
    const world = JSON.parse(bytes);
    assert.equal(world.version, 2);
    assert.equal(world.atlas?.version, 1);
    assert.equal(world.atlas?.worldSize, 768);
    assert.ok(typeof world.atlas?.explored === "string" && world.atlas.explored.length > 150);
    assert.equal(world.width, 768);
    assert.equal(world.height, 768);
    assert.equal(world.residents.length, 3);
    assert.equal(world.residents[0].id, "Steam");
    assert.equal(world.residents[1].id, "Steam");
    assert.equal(world.residents[2].id, "Steam");
    assert.ok(world.residents[1].x > 250, "first expansion ring accepts inhabitants");
    assert.ok(world.residents[2].x > 560, "distant camera territory accepts inhabitants");

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    assert.equal(overflow, false, "Pond should not overflow horizontally");
    assert.deepEqual(errors, [], "No browser errors");
    const name = viewport.width <= 400 ? "mobile" : "desktop";
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    await page.screenshot({ path: out + "/" + name + "-top.png" });
    await page.screenshot({ path: out + "/" + name + ".png", fullPage: true });
    console.log("PASS Pond discovery, placement, undo, autosave, export on " + name);
    cases++;
  } finally { await context.close(); }
}

try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?
      { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
  });
  await run({ width: 390, height: 844 });
  await run({ width: 1365, height: 900 });
  console.log("PASS " + cases + " Pond browser acceptance scenarios");
} finally {
  await browser?.close();
  await new Promise(done => server.close(done));
}
