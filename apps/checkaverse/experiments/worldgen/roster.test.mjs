// Read-only audit of the 300 proposed concepts. Run from any working directory:
// node --test apps/checkaverse/experiments/worldgen/roster.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REGION_THEMES } from "./prototype.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.resolve(here, "../../../../docs/checklings/preproduction/300-line-concept-register.csv");
const source = fs.readFileSync(file, "utf8");

function parseCsv(input) {
  const records = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else {
      if (c === '"') quoted = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n") {
        if (cell || row.length) { row.push(cell.replace(/\r$/, "")); records.push(row); row = []; cell = ""; }
      } else cell += c;
    }
  }
  if (quoted) throw new Error("Unterminated CSV field");
  if (cell || row.length) { row.push(cell); records.push(row); }
  const header = records.shift();
  for (const record of records) if (record.length !== header.length) throw new Error("Mismatched CSV column count");
  return records.map(values => Object.fromEntries(header.map((name, i) => [name, values[i]])));
}

const rows = parseCsv(source);
const counts = (items, property) => items.reduce((m, row) => m.set(row[property], (m.get(row[property]) || 0) + 1), new Map());

test("300 sequential slots, unique concept hooks, no missing columns", () => {
  assert.equal(rows.length, 300);
  assert.equal(new Set(rows.map(r => r.id)).size, 300);
  assert.equal(new Set(rows.map(r => r.concept.toLowerCase())).size, 300);
  for (const [i, row] of rows.entries()) {
    assert.equal(row.id, "CK" + String(i + 1).padStart(3, "0"));
    for (const name of ["region", "type", "category", "concept", "role", "care_focus", "status", "source", "wave"]) {
      assert.ok(row[name] && row[name].trim(), row.id + " missing " + name);
    }
  }
});

test("first twelve remain exact canonical identities", () => {
  const locked = [
    ["Mochi", "meadow", "two-stage"], ["Bolt", "gear", "two-stage"],
    ["Zee", "cosmic", "two-stage"], ["Ember", "ember", "two-stage"],
    ["Bramble", "meadow", "care-morph"], ["Reedling", "tide", "care-morph"],
    ["Lantern", "ember", "care-morph"], ["Mossbit", "stone", "care-morph"],
    ["Spindle", "gear", "non-evolver"], ["Cloudlet", "cosmic", "non-evolver"],
    ["Flickit", "storm", "non-evolver"], ["Hushmoth", "shade", "non-evolver"]
  ];
  rows.slice(0, 12).forEach((row, i) => {
    assert.deepEqual([row.concept, row.type, row.category], locked[i]);
    assert.equal(row.status, "locked—wave-one.md");
    assert.equal(row.wave, "1");
  });
  assert.ok(rows.slice(12).every(r => r.status === "concept seed—unapproved"));
});

test("evolution categories and eight-type distribution exactly match the Bible", () => {
  const classes = counts(rows, "category");
  assert.deepEqual(Object.fromEntries([...classes].sort()), {
    "care-morph": 100, "non-evolver": 100, "two-stage": 100
  });
  const types = counts(rows, "type");
  for (const type of ["meadow", "gear", "cosmic", "ember"]) assert.equal(types.get(type), 38);
  for (const type of ["tide", "stone", "storm", "shade"]) assert.equal(types.get(type), 37);
  assert.equal(types.size, 8);
});

test("each of 25 release waves has 12 slots and each biome has 24 new slots", () => {
  const waves = counts(rows, "wave");
  assert.equal(waves.size, 25);
  for (let n = 1; n <= 25; n++) assert.equal(waves.get(String(n)), 12, "wave " + n);
  const newRows = rows.slice(12);
  const biomes = counts(newRows, "region");
  assert.equal(biomes.size, 12);
  for (const [biome, n] of biomes) assert.equal(n, 24, biome);
});

test("each biome has two waves with equal class and type opportunities", () => {
  const regions = {
    "Bramblefen Basin": "bramblefen_basin",
    "Cindergear Expanse": "cindergear_expanse",
    "Tempest Crown": "tempest_crown",
    "Starfall Gloam": "starfall_gloam",
    "Verdant Crown": "verdant_crown",
    "Frostglass Reach": "frostglass_reach",
    "Emberfall Caldera": "emberfall_caldera",
    "Saltwind Coast": "saltwind_coast",
    "Glassdune Wastes": "glassdune_wastes",
    "Hollowdeep": "hollowdeep",
    "Sungrass Steppe": "sungrass_steppe",
    "Whisperwood": "whisperwood"
  };
  rows.slice(12).forEach(r => {
    const slug = regions[r.region];
    assert.ok(slug, "Unknown biome: " + r.region);
    assert.ok(REGION_THEMES[slug].includes(r.type), "Type outside biome plan: " + r.id);
  });
  for (const [name, slug] of Object.entries(regions)) {
    const ours = rows.filter(r => r.region === name);
    const types = REGION_THEMES[slug].slice(1);
    for (const type of types) assert.equal(ours.filter(r => r.type === type).length, 12);
    for (const category of ["two-stage", "care-morph", "non-evolver"]) {
      assert.equal(ours.filter(r => r.category === category).length, 8);
    }
    const regionalWaves = new Set(ours.map(r => r.wave));
    assert.equal(regionalWaves.size, 2);
    for (const wave of regionalWaves) {
      const part = ours.filter(r => r.wave === wave);
      assert.equal(part.length, 12);
      for (const type of types) assert.equal(part.filter(r => r.type === type).length, 6);
      for (const category of ["two-stage", "care-morph", "non-evolver"]) {
        assert.equal(part.filter(r => r.category === category).length, 4);
      }
    }
  }
});

test("provisional concepts are not accidentally marked released", () => {
  for (const row of rows.slice(12)) {
    assert.ok(!/\blive\b|released|canonical/i.test(row.status), row.id);
    assert.equal(row.source, "preproduction plan");
  }
});
