import fs from 'node:fs';
import path from 'node:path';

const root = path.join(process.cwd(), 'storyhub', 'stories');
const requiredFiles = ['story-dna.json', 'story.json', 'assets.json', 'interactions.json', 'sources.md'];
const errors = [];
const warnings = [];
let storyCount = 0;

const text = (value) => typeof value === 'string' && value.trim().length > 0;
const array = (value) => Array.isArray(value);
const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    errors.push(`${file}: invalid JSON (${error.message})`);
    return null;
  }
};

const storyDirs = [];
if (fs.existsSync(root)) {
  for (const course of fs.readdirSync(root)) {
    const courseDir = path.join(root, course);
    if (!fs.statSync(courseDir).isDirectory()) continue;
    for (const lesson of fs.readdirSync(courseDir)) {
      const storyDir = path.join(courseDir, lesson);
      if (fs.statSync(storyDir).isDirectory()) storyDirs.push(storyDir);
    }
  }
}

for (const dir of storyDirs) {
  storyCount += 1;
  const rel = path.relative(process.cwd(), dir);
  for (const file of requiredFiles) {
    if (!fs.existsSync(path.join(dir, file))) errors.push(`${rel}: missing ${file}`);
  }
  if (requiredFiles.some((file) => !fs.existsSync(path.join(dir, file)))) continue;

  const dna = readJson(path.join(dir, 'story-dna.json'));
  const story = readJson(path.join(dir, 'story.json'));
  const assetsDoc = readJson(path.join(dir, 'assets.json'));
  const interactionsDoc = readJson(path.join(dir, 'interactions.json'));
  if (!dna || !story || !assetsDoc || !interactionsDoc) continue;

  const ids = [dna.storyId, story.storyId, assetsDoc.storyId, interactionsDoc.storyId];
  if (!ids.every((id) => id === ids[0])) errors.push(`${rel}: storyId must match across all JSON manifests`);
  if (!text(story.title) || !text(story.course) || !text(story.lessonCode)) errors.push(`${rel}: story.json requires title, course, and lessonCode`);
  if (!text(story.narrativeQuestion)) warnings.push(`${rel}: narrativeQuestion is empty`);
  if (!array(story.chapters) || story.chapters.length === 0) errors.push(`${rel}: story.json requires at least one chapter`);

  const identity = dna.identity || {};
  const requiredIdentity = ['tone', 'paletteIntent', 'typographyIntent', 'textureLanguage', 'shapeLanguage', 'motionGrammar', 'interactionSignature', 'densityRhythm', 'archivalBehavior', 'endingLanguage'];
  for (const key of requiredIdentity) {
    const value = identity[key];
    if ((Array.isArray(value) && value.length === 0) || (!Array.isArray(value) && !text(value))) errors.push(`${rel}: Story DNA identity.${key} is unfinished`);
  }

  const translation = dna.assetToInterfaceTranslation || {};
  for (const key of ['paletteSource', 'edgeTreatment', 'controlLanguage', 'spacingLanguage', 'transitionLanguage']) {
    if (!text(translation[key])) errors.push(`${rel}: assetToInterfaceTranslation.${key} is unfinished`);
  }

  const assets = array(assetsDoc.assets) ? assetsDoc.assets : [];
  const assetIds = new Set();
  for (const asset of assets) {
    if (!text(asset.id)) { errors.push(`${rel}: asset without id`); continue; }
    if (assetIds.has(asset.id)) errors.push(`${rel}: duplicate asset id ${asset.id}`);
    assetIds.add(asset.id);
    for (const key of ['status', 'type', 'role', 'sourceMode', 'subject', 'rightsStatus', 'provenance', 'htmlSafeZone', 'responsiveCrop']) {
      if (!text(asset[key])) errors.push(`${rel}: asset ${asset.id} missing ${key}`);
    }
    if (typeof asset.deployPath === 'string' && /^[A-Za-z]:\\/.test(asset.deployPath)) errors.push(`${rel}: asset ${asset.id} contains a local Windows path`);
  }

  const chapterIds = new Set();
  for (const chapter of story.chapters || []) {
    if (!text(chapter.id) || !text(chapter.title) || !text(chapter.claim)) errors.push(`${rel}: every chapter requires id, title, and claim`);
    if (chapterIds.has(chapter.id)) errors.push(`${rel}: duplicate chapter id ${chapter.id}`);
    chapterIds.add(chapter.id);
    for (const anchorId of chapter.visualAnchorIds || []) {
      if (!assetIds.has(anchorId)) errors.push(`${rel}: chapter ${chapter.id} references missing visual anchor ${anchorId}`);
    }
    for (const person of chapter.namedPeople || []) {
      if (!text(person.name)) errors.push(`${rel}: chapter ${chapter.id} has named person without name`);
      const status = person.anchorStatus;
      if (!['anchored', 'planned', 'not-available', 'not-needed'].includes(status)) errors.push(`${rel}: ${person.name || 'named person'} needs anchorStatus`);
      if (status === 'anchored' && (!text(person.visualAnchorId) || !assetIds.has(person.visualAnchorId))) errors.push(`${rel}: ${person.name} is marked anchored without a valid visualAnchorId`);
    }
  }

  const interactions = array(interactionsDoc.interactions) ? interactionsDoc.interactions : [];
  const interactionIds = new Set();
  for (const interaction of interactions) {
    if (!text(interaction.id)) { errors.push(`${rel}: interaction without id`); continue; }
    if (interactionIds.has(interaction.id)) errors.push(`${rel}: duplicate interaction id ${interaction.id}`);
    interactionIds.add(interaction.id);
    for (const key of ['chapterId', 'type', 'teaches', 'studentAction', 'feedback', 'staticFallback', 'identityFit', 'status']) {
      if (!text(interaction[key])) errors.push(`${rel}: interaction ${interaction.id} missing ${key}`);
    }
    if (text(interaction.chapterId) && !chapterIds.has(interaction.chapterId)) errors.push(`${rel}: interaction ${interaction.id} references missing chapter ${interaction.chapterId}`);
  }

  for (const chapter of story.chapters || []) {
    for (const interactionId of chapter.interactionIds || []) {
      if (!interactionIds.has(interactionId)) errors.push(`${rel}: chapter ${chapter.id} references missing interaction ${interactionId}`);
    }
  }

  const combined = requiredFiles.map((file) => fs.readFileSync(path.join(dir, file), 'utf8')).join('\n');
  if (/[A-Za-z]:\\Users\\/i.test(combined)) errors.push(`${rel}: local user filesystem path detected`);
  if (/resources\.private\.json|unit-materials\.private\.json/i.test(combined)) errors.push(`${rel}: private curriculum inventory reference detected`);
}

if (storyCount === 0) warnings.push('No StoryHub stories found');

for (const warning of warnings) console.warn(`StoryHub warning: ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`StoryHub error: ${error}`);
  console.error(`StoryHub validation failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log(`StoryHub validation passed: ${storyCount} story/stories, ${warnings.length} warning(s).`);
