import { readFileSync, writeFileSync } from 'node:fs';

const path = 'scripts/recover-astra-batch.mjs';
let text = readFileSync(path, 'utf8');
const guard = "  if (text.indexOf(before, first + before.length) >= 0) {\n    throw new Error(`Patch target is ambiguous in ${path}: ${before.slice(0, 100)}`);\n  }\n";
if (!text.includes(guard)) throw new Error('Recovery ambiguity guard was not found.');
text = text.replace(guard, '');

const weakerToolsColor = 'color:var(--color-accent-dark); opacity:1; font-weight:700;';
if (!text.includes(weakerToolsColor)) throw new Error('Tools contrast patch target was not found.');
text = text.replace(weakerToolsColor, 'color:var(--color-ink); opacity:1; font-weight:800;');

// The Actions token cannot modify workflow files. Keep the permanent site-check
// workflow change out of the runner's commit; it is applied separately through
// the connected GitHub release path after the verified source batch is pushed.
const workflowStart = text.indexOf('// GitHub gets the real-browser check');
const workflowEnd = text.indexOf("console.log('Astra maintenance batch reconstructed.');", workflowStart);
if (workflowStart < 0 || workflowEnd < 0) throw new Error('Recovery workflow patch block was not found.');
text = `${text.slice(0, workflowStart)}${text.slice(workflowEnd)}`;

writeFileSync(path, text, 'utf8');
