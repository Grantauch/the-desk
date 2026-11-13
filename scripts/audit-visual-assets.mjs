#!/usr/bin/env node
/**
 * Read-only historical visual-asset recovery inventory.
 * Run in a clone with origin/main and remote branches fetched:
 *   node scripts/audit-visual-assets.mjs
 * This is deliberately an evidence report, not an automatic cherry-picker.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, extname, dirname, basename } from 'node:path';

const root = process.cwd();
const reportDir = join(root, 'reports', 'visual-assets');
mkdirSync(reportDir, { recursive: true });
const ASSET_RE = /\.(?:blend|glb|gltf|fbx|obj|stl|png|jpe?g|avif|webp|gif|svg|ktx2|hdr|exr|tiff?|mp4|webm|mov|mp3|ogg|wav)$/i;
const VISUAL_CODE_RE = /^(?:public\/(?:hubs|storyhub|atlas|images|assets)\/|src\/(?:pages|components|styles|data)\/|apps\/over-the-somme\/)/i;
const SOURCE_RE = /\.(?:html|astro|jsx?|tsx?|mjs|cjs|css|scss|json)$/i;
const PRIORITY_RE = /(arsenal|over.the.top|over.the.somme|wwi|world.war|atlas|history|marne|trench)/i;
const git = (args, options = {}) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, ...options });
const gitStatus = args => spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
const baseRef = gitStatus(['rev-parse', '--verify', 'refs/remotes/origin/main']).status === 0
  ? 'refs/remotes/origin/main' : 'main';
const baseCommit = git(['rev-parse', baseRef]).trim();

function filesAt(ref) {
  const raw = git(['ls-tree', '-r', '-l', '-z', ref]);
  const result = new Map();
  for (const record of raw.split('\0')) {
    if (!record) continue;
    const tab = record.indexOf('\t');
    if (tab < 0) continue;
    const [, type, sha, size] = record.slice(0, tab).split(/\s+/);
    if (type !== 'blob') continue;
    result.set(record.slice(tab + 1), { sha, bytes: Number(size) || 0 });
  }
  return result;
}

function branches() {
  const lines = git(['for-each-ref', '--format=%(refname:short)|%(objectname)', 'refs/remotes/origin/']);
  return lines.split('\n').filter(Boolean).map(line => {
    const [name, sha] = line.split('|');
    return { name, sha };
  }).filter(item => item.name !== 'origin/HEAD' && item.name !== 'origin/main');
}
const main = filesAt(baseRef);
const mainAssets = [...main].filter(([path]) => ASSET_RE.test(path));
const mainShas = new Set(mainAssets.map(([, file]) => file.sha));
const allBranches = branches();
const allCandidates = new Map();
const reviewed = [];
const branchSummary = [];

for (const branch of allBranches) {
  // Do not confuse an old, fully merged ref with unpublished work.
  const alreadyAncestor = gitStatus(['merge-base', '--is-ancestor', branch.sha, baseCommit]).status === 0;
  if (alreadyAncestor) {
    branchSummary.push({ branch: branch.name, commit: branch.sha, ancestorOfMain: true, unpublishedCommits: 0, newAssetPaths: 0, novelAssetBlobs: 0, changedVisualCode: 0 });
    continue;
  }
  const forward = Number(git(['rev-list', '--count', baseRef + '..' + branch.sha]).trim());
  if (!forward) {
    branchSummary.push({ branch: branch.name, commit: branch.sha, ancestorOfMain: false, unpublishedCommits: 0, newAssetPaths: 0, novelAssetBlobs: 0, changedVisualCode: 0 });
    continue;
  }
  const files = filesAt(branch.sha);
  const branchAssets = [...files].filter(([path]) => ASSET_RE.test(path));
  let missing = 0, novel = 0, changedCode = 0;
  for (const [path, file] of branchAssets) {
    if (!main.has(path)) missing++;
    // A copied/moved blob on main is not genuinely stranded.
    if (mainShas.has(file.sha)) continue;
    if (main.get(path)?.sha === file.sha) continue;
    novel++;
    const key = path + '|' + file.sha;
    const present = allCandidates.get(key) || {
      path, gitBlobSha: file.sha, mainPathSha: main.get(path)?.sha || null,
      bytes: file.bytes, priority: PRIORITY_RE.test(path), branches: []
    };
    present.branches.push(branch.name);
    allCandidates.set(key, present);
  }
  for (const [path, file] of files) {
    if (VISUAL_CODE_RE.test(path) && /\.(?:html|astro|css|js|mjs|ts|tsx)$/.test(path)
        && main.get(path)?.sha !== file.sha) changedCode++;
  }
  branchSummary.push({
    branch: branch.name, commit: branch.sha, ancestorOfMain: false,
    unpublishedCommits: forward, newAssetPaths: missing,
    novelAssetBlobs: novel, changedVisualCode: changedCode
  });
  reviewed.push(branch.name);
}

const referencedText = [];
const sourceFiles = [...main.keys()].filter(path =>
  SOURCE_RE.test(path) && /^(?:src\/|public\/|storyhub\/stories\/|apps\/over-the-somme\/)/.test(path) &&
  !/\/(?:vendor|node_modules|\.cache)\//.test(path) && main.get(path).bytes < 1_800_000
);
for (const path of sourceFiles) {
  const full = join(root, path);
  if (!existsSync(full)) continue;
  try { referencedText.push({ path, content: readFileSync(full, 'utf8') }); } catch {}
}

// Source-level approximation: direct URL > same-directory name > generic basename.
// A bundle may compute URLs at runtime, and HTML can be reachable without catalog links.
// Never delete or publish an asset on the strength of these classifications alone.
function usage(path) {
  const url = '/' + path.replace(/^public\//, '');
  const base = basename(path);
  const stem = base.replace(/\.[^.]+$/, '');
  const direct = [], related = [], weak = [];
  const ownDir = dirname(path);
  for (const source of referencedText) {
    if (source.path === path) continue;
    if (source.content.includes(url) || source.content.includes(path)) {
      if (direct.length < 10) direct.push(source.path);
    } else if (source.path.startsWith(ownDir + '/') && source.content.includes(base)) {
      if (related.length < 10) related.push(source.path);
    } else if (source.content.includes(base) && weak.length < 3) {
      weak.push(source.path);
    } else if (/\.glb$/i.test(path) && source.path.startsWith(ownDir.replace(/\/models$/, '') + '/')
      && source.content.includes(stem.replace(/_web$/, ''))) {
      if (related.length < 10) related.push(source.path);
    }
  }
  const classification = direct.length ? 'direct-source-reference'
    : related.length ? 'local-or-computed-reference'
    : weak.length ? 'basename-reference-only'
    : 'no-static-reference-found';
  return { classification, direct, related, weak };
}

const usageRecords = mainAssets
  .filter(([path]) => path.startsWith('public/'))
  .map(([path, file]) => ({ path, gitBlobSha: file.sha, bytes: file.bytes, ...usage(path) }));
const usageSummary = usageRecords.reduce((a, item) => (a[item.classification] = (a[item.classification] || 0) + 1, a), {});
const candidateRecords = [...allCandidates.values()].sort((a, b) =>
  Number(b.priority) - Number(a.priority) || b.branches.length - a.branches.length || a.path.localeCompare(b.path)
);

// SHA-256 verifies content separately from Git's SHA-1 blob object identifier.
// Bound to candidate blobs; long-running scans should not hash entire branch trees.
const hashed = new Map();
for (const record of candidateRecords) {
  if (hashed.has(record.gitBlobSha)) {
    record.contentSha256 = hashed.get(record.gitBlobSha);
    continue;
  }
  try {
    const bytes = execFileSync('git', ['cat-file', 'blob', record.gitBlobSha], {
      cwd: root, maxBuffer: Math.max(16 * 1024 * 1024, record.bytes + 2048)
    });
    const sum = createHash('sha256').update(bytes).digest('hex');
    hashed.set(record.gitBlobSha, sum);
    record.contentSha256 = sum;
  } catch (error) {
    record.contentSha256 = null;
    record.hashError = String(error.message).slice(0, 160);
  }
}

const report = {
  generatedAt: new Date().toISOString(), repository: 'Grantauch/the-desk',
  baseRef, baseCommit, mainTrackedFiles: main.size, mainVisualAssets: mainAssets.length,
  branchesInspected: allBranches.length, divergentBranches: reviewed.length,
  mainPublicVisualUsageSummary: usageSummary,
  branchSummary, candidateRecords, mainPublicVisualUsage: usageRecords
};
writeFileSync(join(reportDir, 'inventory.json'), JSON.stringify(report, null, 2) + '\n');
const important = candidateRecords.filter(item => item.priority);
const uniqueCandidateContents = new Set(candidateRecords.map(item => item.gitBlobSha)).size;
const noRef = usageRecords.filter(item => item.classification === 'no-static-reference-found').sort((a, b) => b.bytes - a.bytes);
const table = (items, format, limit = 70) => items.slice(0, limit).map(format).join('\n') || '| None found | | |';
const md = `# Repository-wide visual recovery — ${report.generatedAt.slice(0, 10)}

**Base:** \`${baseRef}\` @ \`${baseCommit}\`  
**Branches inspected:** ${allBranches.length}; divergent with unpublished commits: ${reviewed.length}.  
**Main tracked files:** ${main.size}; main visual/media/source assets: ${mainAssets.length}.  
**Branch-exclusive asset-path variants:** ${candidateRecords.length} (**${uniqueCandidateContents} distinct file contents**) (priority-themed: ${important.length}).

## What the inventory means

Assets were compared by path, Git blob SHA and separately computed raw-file SHA-256. A branch file already present anywhere on \`main\` with the same blob SHA is not considered stranded. A candidate requires manual provenance, visual and runtime review; this inventory **must not** automatically publish it. Source-level usage is intentionally heuristic; dynamic paths, embedded blobs and feature-flagged assets can be missed.

## Branch-exclusive priority artwork (review queue)

| Branch source(s) | Path | Bytes | SHA-256 prefix |
| --- | --- | ---: | --- |
${table(important, x => `| ${x.branches.slice(0, 2).join(', ')} | \`${x.path}\` | ${x.bytes} | \`${x.contentSha256?.slice(0, 16) || 'error'}\` |`, 65)}

## Other branch-exclusive media and art (sample)

| Branch source(s) | Path | Bytes |
| --- | --- | ---: |
${table(candidateRecords.filter(item => !item.priority), x => `| ${x.branches.slice(0, 2).join(', ')} | \`${x.path}\` | ${x.bytes} |`, 50)}

## Source-level asset references in main

${Object.entries(usageSummary).map(([key, count]) => '- ' + key + ': ' + count).join('\n')}

### Potentially unreferenced public media (not proof of unused)

| Path | Bytes | Notes |
| --- | ---: | --- |
${table(noRef, x => `| \`${x.path}\` | ${x.bytes} | No exact/basename references in checked source files |`, 65)}

## Release policy

1. Open the intended lesson and confirm the asset really renders, rather than merely responding HTTP 200.
2. Confirm licensing and historical labeling. No unsupported primary-source claims for reconstructions.
3. Compare against the polished current image and keep a static/procedural fallback.
4. Test desktop, mobile, reduced-motion, offline/error handling and WebGL disabled.
5. Submit a narrow PR and get CI + independent review before merging.
6. Verify the actual production URL after deployment.

See \`inventory.json\` for **every inspected ref**, candidate's path and SHAs, and every public asset's static source references.
`;
writeFileSync(join(reportDir, 'triage.md'), md);
const brief = `VISUAL_AUDIT base=${baseCommit.slice(0, 12)} branches=${allBranches.length} divergent=${reviewed.length} assetPaths=${candidateRecords.length} uniqueAssetBlobs=${uniqueCandidateContents} priority=${important.length} noStaticRef=${noRef.length}\n`;
process.stdout.write(brief);
console.log('PRIORITY_CANDIDATES');
for (const item of important.slice(0, 20)) console.log(item.path, item.bytes, item.branches.slice(0, 3).join(','));
console.log('NO_STATIC_REFERENCE');
for (const item of noRef.slice(0, 20)) console.log(item.path, item.bytes);
console.log('Reports:', reportDir);
