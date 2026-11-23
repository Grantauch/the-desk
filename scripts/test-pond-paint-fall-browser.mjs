import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

/**
 * Browser-level release gate for the user requirement:
 *    "Everything should still fall when you place it."
 *
 * Uses the *published Pond build* and real pointer interactions. No access to
 * PondSim internals or synthetic particle mocks. This complements the direct
 * PondSim unit tests in physics-gravity.test.ts.
 *
 * Environment: run npm run pond:build before executing this script. It
 * intentionally never edits production assets or weakens manifest validation.
 */
const folder = resolve(fileURLToPath(new URL("../public/hubs/pond/", import.meta.url)));
const out = resolve(fileURLToPath(new URL("../browser-results/pond-paint-fall/", import.meta.url)));
const origin = "http://127.0.0.1:4413";
const url = origin + "/hubs/pond/";
await mkdir(out, { recursive: true });

const mime = { ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".jpg": "image/jpeg" };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, url).pathname);
    if (!pathname.startsWith("/hubs/pond/")) { response.writeHead(404).end(); return; }
    const relativePath = pathname.slice("/hubs/pond/".length);
    const target = resolve(folder, relativePath || "index.html");
    if (!target.startsWith(folder + sep)) { response.writeHead(404).end(); return; }
    const body = await readFile(target);
    response.writeHead(200, { "content-type": mime[extname(target)] ?? "application/octet-stream", "cache-control": "no-store" }).end(body);
  } catch { response.writeHead(404).end(); }
});
await new Promise((resolveReady, reject) => {
  server.once("error", reject);
  server.listen(4413, "127.0.0.1", resolveReady);
});

let browser;
let checks = 0;
const report = [];
try {
  browser = await chromium.launch({ headless: true });
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    await context.route("**/*", (route) => {
      const address = new URL(route.request().url());
      return address.origin === origin ? route.continue() :
        route.fulfill({ status: 503, body: "Offline acceptance test" });
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.setDefaultTimeout(12000);
    try {
      const response = await page.goto(url, { waitUntil: "load" });
      assert.equal(response.status(), 200, "Pond must load");
      await page.getByRole("button", { name: "Make a mess" }).click();
      const canvas = page.getByRole("application", { name: /Living dish/ });
      await canvas.waitFor({ state: "visible" });
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await page.getByRole("button", { name: "Play", exact: true }).waitFor();

      // Measure pigment distribution in the actual rendered world. Empty
      // material is very dark; sand is ochre and water is blue. The thresholds
      // deliberately tolerate enhanced lighting and the classic renderer.
      const measure = async (material) => canvas.evaluate((element, type) => {
        const ctx = element.getContext("2d", { willReadFrequently: true });
        const { width, height } = element;
        const pixels = ctx.getImageData(0, 0, width, height).data;
        let count = 0, totalY = 0, maxY = 0;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const k = (y * width + x) * 4;
            const r = pixels[k], g = pixels[k + 1], b = pixels[k + 2];
            const sand = r > 145 && g > 95 && r > g + 10 && g > b + 8 && b < 185;
            const water = b > 115 && g > 72 && b > r + 32 && g > r + 12;
            if (pixels[k + 3] > 100 && (type === "Sand" ? sand : water)) {
              count++; totalY += y; maxY = Math.max(maxY, y);
            }
          }
        }
        return { count, meanY: count ? totalY / count : 0, maxY };
      }, material);

      for (const material of ["Sand", "Water"]) {
        await page.getByRole("button", { name: "Clear dish", exact: true }).click();
        await page.getByRole("button", { name: material, exact: true }).click();
        await page.getByRole("button", { name: "Brush 4", exact: true }).click();
        const box = await canvas.boundingBox();
        assert.ok(box?.width > 0, "interactive dish must have measurable dimensions");
        await canvas.click({ position: { x: box.width / 2, y: box.height * 0.29 } });
        await page.waitForTimeout(150); // allow a render, not a biology or physics tick
        const placed = await measure(material);
        assert.ok(placed.count >= 3, material + " brush must paint visible pixels");
        await page.waitForTimeout(300);
        const held = await measure(material);
        assert.ok(Math.abs(held.meanY - placed.meanY) <= 1.1,
          material + " must remain in place while paused");
        assert.ok(Math.abs(held.count - placed.count) <= 2,
          material + " must not disappear while paused");
        await page.screenshot({ path: out + "/" + viewport.width + "-" + material.toLowerCase() + "-paused.png" });

        await page.getByRole("button", { name: "Play", exact: true }).click();
        await page.waitForTimeout(840);
        const moved = await measure(material);
        assert.ok(moved.count >= 2, material + " must remain visible while falling/flowing");
        assert.ok(moved.meanY > held.meanY + 7,
          material + " must fall after Resume (from " + held.meanY.toFixed(1) +
          " to " + moved.meanY.toFixed(1) + ", world=" + viewport.width + "px)");
        await page.getByRole("button", { name: "Pause", exact: true }).click();
        await page.getByRole("button", { name: "Play", exact: true }).waitFor();
        await page.screenshot({ path: out + "/" + viewport.width + "-" + material.toLowerCase() + "-fallen.png" });
        report.push({ viewport: viewport.width, material, pausedMeanY: +held.meanY.toFixed(2),
          fallenMeanY: +moved.meanY.toFixed(2), pixels: moved.count });
        checks++;
      }
      assert.deepEqual(errors, [], "No uncaught browser errors at " + viewport.width + "px");
    } finally {
      await context.close();
    }
  }
  console.log("Pond browser-painted gravity/flow: " + checks + " material × viewport cases passed");
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
