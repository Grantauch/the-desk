import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

// Public museums use a small, deliberately supported GLB subset, not arbitrary
// GLTFLoader features. Keep the exhibits, Blender sources and page registries in sync.
const root = new URL('../', import.meta.url);
const publicFile = path => new URL('../public/' + path, import.meta.url);
const blenderFile = stem => new URL('../assets/wwi-blender/' + stem + '.blend', import.meta.url);
const modelFile = stem => publicFile('hubs/ush9-the-arsenal/models/' + stem + '_web.glb');
const readPage = path => readFileSync(publicFile(path), 'utf8');

const exhibits = [
  // Arsenal museum
  ['mark1_male_1916', 8, 'arsenal'],
  ['smle_mkiii_rifle', 7, 'arsenal'],
  ['vickers_mki_1914', 7, 'arsenal'],
  ['qf18_field_gun_1914', 6, 'arsenal'],
  ['sopwith_camel_1917', 10, 'arsenal'],
  ['small_box_respirator_1916', 8, 'arsenal'],
  ['screw_picket_wire_1916', 2, 'arsenal'],
  ['wex_flamethrower_1917', 7, 'arsenal'],
  ['zeppelin_1915', 6, 'arsenal'],
  ['uboat_1916', 7, 'arsenal'],
  // Over the Top trench
  ['trench_sandbag_1916', 1, 'trench'],
  ['m1917_helmet_1917', 3, 'trench'],
  ['adrian_helmet_1915', 3, 'trench'],
  ['wooden_trench_periscope_1917', 7, 'trench'],
  ['springfield_m1903_1918', 5, 'trench'],
  ['timber_supply_case_1916', 5, 'trench'],
];

function inspectGlb(stem) {
  const data = readFileSync(modelFile(stem));
  assert.ok(data.length >= 28 && data.length < 700_000, stem + ': unexpected model weight');
  assert.equal(data.readUInt32LE(0), 0x46546c67, stem + ': GLB magic');
  assert.equal(data.readUInt32LE(4), 2, stem + ': GLB version');
  assert.equal(data.readUInt32LE(8), data.length, stem + ': GLB total length');
  let offset = 12;
  let json = null;
  let binaryChunks = 0;
  while (offset < data.length) {
    assert.ok(offset + 8 <= data.length, stem + ': truncated chunk');
    const length = data.readUInt32LE(offset);
    const type = data.readUInt32LE(offset + 4);
    assert.ok(offset + 8 + length <= data.length, stem + ': chunk exceeds file');
    if (type === 0x4e4f534a) {
      assert.equal(json, null, stem + ': multiple JSON chunks');
      json = JSON.parse(data.subarray(offset + 8, offset + 8 + length).toString('utf8'));
    } else if (type === 0x004e4942) {
      binaryChunks++;
    } else {
      assert.fail(stem + ': unsupported chunk type ' + type);
    }
    offset += 8 + length;
  }
  assert.equal(offset, data.length, stem + ': trailing data');
  assert.equal(binaryChunks, 1, stem + ': expected one binary chunk');
  assert.ok(json && Array.isArray(json.meshes), stem + ': missing mesh list');
  assert.ok(!json.images?.length && !json.textures?.length, stem + ': embedded textures need a reviewed loader');
  assert.ok(!json.animations?.length, stem + ': animation needs explicit review');
  assert.ok(!json.extensionsRequired?.length, stem + ': unsupported GLTF extension');
  assert.ok((json.buffers || []).every(buffer => !buffer.uri), stem + ': external data dependency');
  return { meshes: json.meshes.length, bytes: data.length };
}

test('every published WWI Blender export has a matching source and a student-facing loader', () => {
  const arsenal = readPage('hubs/ush9-the-arsenal.html');
  const trench = readPage('hubs/ush9-over-the-top.html');
  const somme = readPage('hubs/ush9-over-the-somme/somme.js');
  const stems = exhibits.map(([stem]) => stem);
  assert.equal(stems.length, new Set(stems).size, 'duplicate exhibit in inventory');

  for (const [stem, , where] of exhibits) {
    assert.ok(existsSync(blenderFile(stem)), stem + ': source .blend missing');
    assert.ok(existsSync(modelFile(stem)), stem + ': browser .glb missing');
    const fileName = stem + '_web.glb';
    if (where === 'arsenal') {
      assert.ok(arsenal.includes(fileName), stem + ': not registered in Arsenal');
    } else if (stem === 'trench_sandbag_1916') {
      assert.ok(trench.includes(fileName), stem + ': no sandbag loader');
    } else {
      // Over the Top constructs each URL from the registered stem.
      assert.ok(trench.includes("'" + stem + "'"), stem + ': not registered in Over the Top');
    }
  }

  const published = readdirSync(publicFile('hubs/ush9-the-arsenal/models/'))
    .filter(name => name.endsWith('_web.glb')).sort();
  assert.deepEqual(published, stems.map(stem => stem + '_web.glb').sort(),
    'unreferenced or missing export in WWI public model directory');

  assert.ok(existsSync(publicFile('hubs/ush9-over-the-somme/models/mark1_male_1916_web.glb')));
  assert.ok(somme.includes('/hubs/ush9-over-the-somme/models/mark1_male_1916_web.glb'),
    'Somme tank export is not connected to the flight scene');
  assert.deepEqual(
    readFileSync(publicFile('hubs/ush9-over-the-somme/models/mark1_male_1916_web.glb')),
    readFileSync(modelFile('mark1_male_1916')),
    'Somme and Arsenal tank exports drifted'
  );
});

test('WWI model exports stay inside their audited browser parser and download budgets', () => {
  let total = 0;
  for (const [stem, expectedMeshes] of exhibits) {
    const result = inspectGlb(stem);
    assert.equal(result.meshes, expectedMeshes, stem + ': material batch contract changed');
    total += result.bytes;
  }
  assert.ok(total < 4_000_000, 'WWI model package exceeds 4 MB: ' + total);
});

test('the optional Blender upgrades retain the original procedural scenes as fallbacks', () => {
  const arsenal = readPage('hubs/ush9-the-arsenal.html');
  const trench = readPage('hubs/ush9-over-the-top.html');
  assert.ok(arsenal.includes('__loadWW1BlenderModel') && arsenal.includes('fallback'));
  assert.ok(trench.includes('__upgradeWWISandbags') && trench.includes('__upgradeTrenchProp'));
  assert.ok(trench.includes("dataset[key] = 'fallback'") &&
    trench.includes('original prop retained'), 'Over the Top fallback contract missing');
  assert.ok(readFileSync(new URL('../assets/wwi-blender/README.md', import.meta.url), 'utf8')
    .includes('historical approximations'), 'educational model caveat missing');
});
