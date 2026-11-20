/**
 * Read-only visual inventory of deployed Story Hubs and game HTML.
 * SVG assets are REVIEW candidates, not automatically bad. File names and
 * textual provenance hints are not substitutes for a visual/rights audit.
 */
import { readdir, readFile, stat, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const SOURCE_DIRS = ["public/hubs", "public/storyhub"];
const ART_EXT = new Set([".svg", ".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"]);
const TEXT_EXT = new Set([".html", ".css", ".md"]);
const budget = 2_500_000;
const media = [];
const documents = [];
const suspect = /(?:AI[- ](?:generated|authored)|generated (?:interpretive|reconstruction|illustration)|(?:illustrated|artistic) reconstruction|synthetic (?:art|scene|image))/ig;

async function walk(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const filepath = path.join(folder, entry.name);
    if (entry.isDirectory()) { await walk(filepath); continue; }
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    const size = (await stat(filepath)).size;
    const normalized = filepath.split(path.sep).join("/");
    if (ART_EXT.has(ext)) {
      media.push({ filepath: normalized, ext, bytes: size, isSvg: ext === ".svg" });
    }
    if (!TEXT_EXT.has(ext) || size > budget) continue;
    const contents = await readFile(filepath, "utf8");
    const imageRefs = [...contents.matchAll(/(?:src|poster|data-src)=["']([^"'<>]+\.(?:svg|jpe?g|png|webp|avif|gif)(?:\?[^"']*)?)["']/gi)]
      .map(m => m[1]);
    const inlineSvg = (contents.match(/<svg(?:\s|>)/gi) || []).length;
    const hints = [...contents.matchAll(suspect)].slice(0, 12).map(m => m[0]);
    documents.push({
      filepath: normalized,
      bytes: size,
      imageRefs: [...new Set(imageRefs)],
      svgImageRefs: [...new Set(imageRefs.filter(ref => /\.svg(?:\?|$)/i.test(ref)))],
      inlineSvg,
      provenanceLanguageHints: hints,
    });
  }
}

for (const dir of SOURCE_DIRS) await walk(dir);
const storyCatalog = await readFile("src/data/storyhubs.ts", "utf8");
const interactiveCatalog = await readFile("src/data/interactiveExperiences.ts", "utf8");
const covers = [...storyCatalog.matchAll(/\bcover:\s*'([^']+)'/g)].map(m => m[1]);
const storySvgCovers = covers.filter(p => /\.svg(?:\?|$)/i.test(p));
const catalogArtHints = [...storyCatalog.matchAll(suspect)].map(m => ({ phrase: m[0], offset: m.index }));
// Match only record fields, not the discriminated union declared on the Hub interface.
const entries = [...interactiveCatalog.matchAll(/^\s{4}section:\s*'(game|simulation|investigation|practice)'/gm)];
const sections = Object.fromEntries(["game", "simulation", "investigation", "practice"].map(section => [section, entries.filter(m=>m[1]===section).length]));
const svgImageDocuments = documents.filter(d => d.svgImageRefs.length).sort((a,b)=>b.svgImageRefs.length-a.svgImageRefs.length);
const result = {
  generatedAt: new Date().toISOString(),
  scope: SOURCE_DIRS,
  totals: {
    registeredStoryCovers: covers.length,
    registeredSvgStoryCovers: storySvgCovers.length,
    registeredInteractives: entries.length,
    sections,
    artAssets: media.length,
    svgAssets: media.filter(x=>x.isSvg).length,
    htmlDocs: documents.filter(x=>x.filepath.endsWith(".html")).length,
    documentsWithSvgImageRefs: svgImageDocuments.length,
    documentsWithProvenanceHints: documents.filter(x=>x.provenanceLanguageHints.length).length,
  },
  storySvgCovers,
  storyCatalogProvenanceHints: catalogArtHints,
  svgSceneAssets: media.filter(x=>x.isSvg && /\/storyhub\//.test(x.filepath)),
  htmlDocumentsWithSvgRefs: svgImageDocuments,
  documentsWithProvenanceHints: documents.filter(x=>x.provenanceLanguageHints.length),
  files: media,
};
await mkdir("browser-results/catalog-media", { recursive: true });
await writeFile("browser-results/catalog-media/inventory.json", JSON.stringify(result, null, 2) + "\n");
console.log("CATALOG MEDIA AUDIT " + JSON.stringify(result.totals));
console.log("STORY SVG COVERS: " + JSON.stringify(storySvgCovers));
console.log("MOST SVG IMAGE REFS: " + JSON.stringify(svgImageDocuments.slice(0, 20).map(x=>({path:x.filepath,refs:x.svgImageRefs.length}))));
console.log("PROVENANCE LANGUAGE: " + JSON.stringify(catalogArtHints.slice(0,20)));
console.log("Artifacts: browser-results/catalog-media/inventory.json");
