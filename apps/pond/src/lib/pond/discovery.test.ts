import assert from "node:assert/strict";
import { test } from "node:test";
import {
  STARTERS, FORMS, HABITATS, FORCES, TRAITS, OUTCOME_SPACE,
  MAX_DISCOVERIES, RECIPE_COUNT, combine, facetsFromIndex, facetIndex,
  getOutcome, idFromFacets, paintMaterial, restoreDiscoveries,
} from "./discovery.ts";
import { E } from "./elements.ts";

test("the structured catalog contains over ten million distinct stable identities", () => {
  assert.equal(FORMS.length, 40);
  assert.equal(HABITATS.length, 64);
  assert.equal(FORCES.length, 64);
  assert.equal(TRAITS.length, 64);
  assert.equal(OUTCOME_SPACE, 10_485_760);
  const tested = new Set<string>();
  for (let n = 0; n < 10000; n++) {
    const index = (n * 1013) % OUTCOME_SPACE;
    const facets = facetsFromIndex(index);
    assert.equal(facetIndex(facets), index);
    const id = idFromFacets(facets);
    const outcome = getOutcome(id);
    assert.ok(outcome);
    assert.equal(outcome.id, id);
    assert.equal(outcome.kind, "procedural");
    assert.ok(outcome.name.includes(FORMS[facets.form]));
    tested.add(id);
  }
  assert.equal(tested.size, 10000);
  assert.equal(idFromFacets(facetsFromIndex(OUTCOME_SPACE - 1)), "v:" + (OUTCOME_SPACE - 1).toString(36));
  assert.throws(() => facetsFromIndex(OUTCOME_SPACE), RangeError);
  assert.throws(() => facetsFromIndex(-1), RangeError);
  assert.throws(() => idFromFacets({ form: 40, habitat: 0, force: 0, trait: 0 }), RangeError);
});

test("familiar recipes are prioritized and discoverable from starter materials", () => {
  assert.ok(RECIPE_COUNT >= 75);
  assert.deepEqual(STARTERS, ["Water", "Fire", "Earth", "Wind"]);
  assert.equal(combine("Fire", "Water")?.name, "Steam");
  assert.equal(combine("Water", "Fire")?.name, "Steam");
  assert.equal(combine("Earth", "Fire")?.name, "Lava");
  assert.equal(combine("Lava", "Water")?.name, "Stone");
  assert.equal(combine("Water", "Water")?.name, "Lake");
  assert.equal(combine("Stone", "Wind")?.name, "Sand");
  assert.equal(combine("Sand", "Fire")?.name, "Glass");
  assert.equal(combine("Forest", "Tool")?.name, "Wood");
  assert.equal(combine("Metal", "Energy")?.name, "Clock");
  assert.equal(combine("Ice", "Mountain")?.name, "Glacier");
});

test("unexpected pairs always return reproducible, order-independent outcomes", () => {
  const cases: Array<[string, string]> = [
    ["Water", "Stone"], ["Fire", "Mountain"], ["Lake", "Rainbow"],
    ["Factory", "Butterfly"], ["v:0", "Water"], ["v:zz", "v:75"],
  ];
  for (const [a, b] of cases) {
    const first = combine(a, b);
    const reverse = combine(b, a);
    assert.ok(first);
    assert.ok(reverse);
    assert.deepEqual(first, reverse);
    assert.equal(getOutcome(first.id)?.name, first.name);
    assert.ok(first.name.length > 0);
  }
  assert.equal(combine("not a discovery", "Water"), null);
  assert.equal(combine("Water", "v:zzzzzz"), null);
});

test("legacy saves migrate without duplicates or prototype keys", () => {
  const migrated = restoreDiscoveries(null, ["Steam", "Steam", "v:0", "v:0", "__proto__", null, 1, "v:zzzzzz"]);
  assert.deepEqual(migrated, [...STARTERS, "Steam", "v:0"]);
  assert.deepEqual(restoreDiscoveries(["Lake", "v:1"], ["Steam"]), [...STARTERS, "Lake", "v:1"]);
  assert.deepEqual(restoreDiscoveries({ invalid: true }), [...STARTERS]);
  assert.equal(getOutcome("v:00"), null);
  assert.equal(getOutcome("v:ZZ"), null);
});

test("large saved collections are bounded and materials map to valid existing physics", () => {
  const ids = Array.from({ length: MAX_DISCOVERIES + 100 }, (_, n) => "v:" + n.toString(36));
  const recovered = restoreDiscoveries(ids);
  assert.equal(recovered.length, MAX_DISCOVERIES);
  assert.equal(new Set(recovered).size, recovered.length);
  for (const id of [STARTERS[0], "Steam", "v:0", "v:1234"]) {
    const outcome = getOutcome(id);
    assert.ok(outcome);
    assert.ok(Object.values(E).includes(paintMaterial(outcome)));
  }
});
