import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

const sourceRoot = resolve(process.cwd(), '..', 'work', 'cold_openers');
const outputPath = resolve(process.cwd(), 'src', 'data', 'cold-openers.json');
const sourceFiles = [
  'batch_01_30.md',
  'batch_31_60.md',
  'batch_61_90.md',
  'batch_81_90.md',
];

const readColdOpen = (body) => body
  .match(/\*\*(?:Cold open|Cold-open line):\*\*\s*(.+)/i)?.[1]
  ?.trim() ?? '';

const readWhyItWorks = (body) => body
  .match(/\*\*Why it works:\*\*\s*(.+)/i)?.[1]
  ?.trim() ?? '';

const readRabbitHoles = (body) => {
  const section = body.match(/\*\*(?:Optional )?rabbit holes:\*\*([\s\S]*)$/i)?.[1] ?? '';
  return [...section.matchAll(/^\s*-\s+(.+)$/gm)].map((match) => match[1].trim());
};

const parseSource = async (filename) => {
  const source = (await readFile(resolve(sourceRoot, filename), 'utf8')).replace(/\r\n/g, '\n');
  const headings = [...source.matchAll(/^## Day (\d+)\s+[—-]\s+(.+)$/gm)];

  return headings.map((heading, index) => {
    const start = heading.index + heading[0].length;
    const end = headings[index + 1]?.index ?? source.length;
    const body = source.slice(start, end);

    return {
      day: Number(heading[1]),
      title: heading[2].trim(),
      coldOpen: readColdOpen(body),
      whyItWorks: readWhyItWorks(body),
      slideCount: [...body.matchAll(/^\d+\.\s+\*\*On[ -]slide\b/gmi)].length,
      rabbitHoles: readRabbitHoles(body),
      sourceFile: basename(filename),
    };
  });
};

const entries = (await Promise.all(sourceFiles.map(parseSource)))
  .flat()
  .sort((a, b) => a.day - b.day);
const days = entries.map((entry) => entry.day);
const duplicates = days.filter((day, index) => days.indexOf(day) !== index);
const missing = Array.from({ length: 90 }, (_, index) => index + 1).filter((day) => !days.includes(day));
const incomplete = entries.filter((entry) => (
  !entry.title
  || !entry.coldOpen
  || !entry.whyItWorks
  || entry.slideCount < 1
  || entry.rabbitHoles.length < 1
));

if (entries.length !== 90 || duplicates.length || missing.length || incomplete.length) {
  throw new Error([
    `Cold-opener catalog is incomplete: ${entries.length}/90 entries.`,
    `Duplicate days: ${duplicates.join(', ') || 'none'}.`,
    `Missing days: ${missing.join(', ') || 'none'}.`,
    `Incomplete days: ${incomplete.map((entry) => entry.day).join(', ') || 'none'}.`,
  ].join(' '));
}

await writeFile(outputPath, `${JSON.stringify(entries, null, 2)}\n`, 'utf8');
console.log(`Cold-openers catalog: PASS — ${entries.length}/90 days written to ${outputPath}`);
