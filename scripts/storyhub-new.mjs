import fs from 'node:fs';
import path from 'node:path';

const [, , rawCourse, rawLesson, ...titleParts] = process.argv;

if (!rawCourse || !rawLesson) {
  console.error('Usage: npm run storyhub:new -- <COURSE> <LESSON> [title]');
  process.exit(1);
}

const clean = (value) => value.trim().replace(/[^A-Za-z0-9_-]/g, '');
const course = clean(rawCourse).toUpperCase();
const lesson = clean(rawLesson).toUpperCase();
const storyId = `${course}-${lesson}`;
const title = titleParts.join(' ').trim() || 'Untitled StoryHub';
const storyDir = path.join(process.cwd(), 'storyhub', 'stories', course, lesson);

if (fs.existsSync(storyDir)) {
  console.error(`StoryHub already exists: ${path.relative(process.cwd(), storyDir)}`);
  process.exit(1);
}

fs.mkdirSync(storyDir, { recursive: true });

const dna = {
  schemaVersion: 1,
  storyId,
  title,
  referenceImplementation: false,
  identity: {
    tone: [],
    paletteIntent: '',
    typographyIntent: '',
    textureLanguage: [],
    shapeLanguage: '',
    motionGrammar: [],
    interactionSignature: [],
    densityRhythm: '',
    archivalBehavior: '',
    endingLanguage: ''
  },
  assetToInterfaceTranslation: {
    paletteSource: 'approved asset set',
    edgeTreatment: '',
    controlLanguage: '',
    spacingLanguage: '',
    transitionLanguage: ''
  }
};

const story = {
  schemaVersion: 1,
  storyId,
  course,
  lessonCode: lesson,
  title,
  audience: 'students',
  narrativeQuestion: '',
  chapters: [],
  accuracyNotes: []
};

const assets = { schemaVersion: 1, storyId, assets: [] };
const interactions = { schemaVersion: 1, storyId, interactions: [] };
const sources = `# Sources — ${storyId}\n\nRecord student-safe public source notes here. Keep private source registers, local paths, restricted files, credentials, and teacher-only material out of the public repository.\n\n## Core factual sources\n\n- Add source\n\n## Visual-source provenance\n\n- Add source and asset relationship\n\n## Accuracy / interpretation notes\n\n- Add note\n`;

const writeJson = (name, value) => {
  fs.writeFileSync(path.join(storyDir, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

writeJson('story-dna.json', dna);
writeJson('story.json', story);
writeJson('assets.json', assets);
writeJson('interactions.json', interactions);
fs.writeFileSync(path.join(storyDir, 'sources.md'), sources, 'utf8');

console.log(`Created ${storyId} at ${path.relative(process.cwd(), storyDir)}`);
console.log('Next: author Story DNA and narrative architecture before visible design work.');
