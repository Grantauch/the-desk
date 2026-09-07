import { readFileSync, writeFileSync } from 'node:fs';

const path = 'scripts/recover-astra-batch.mjs';
let text = readFileSync(path, 'utf8');
const guard = "  if (text.indexOf(before, first + before.length) >= 0) {\n    throw new Error(`Patch target is ambiguous in ${path}: ${before.slice(0, 100)}`);\n  }\n";
if (!text.includes(guard)) throw new Error('Recovery ambiguity guard was not found.');
text = text.replace(guard, '');
const weakerToolsColor = 'color:var(--color-accent-dark); opacity:1; font-weight:700;';
if (!text.includes(weakerToolsColor)) throw new Error('Tools contrast patch target was not found.');
text = text.replace(weakerToolsColor, 'color:var(--color-ink); opacity:1; font-weight:800;');
writeFileSync(path, text, 'utf8');
