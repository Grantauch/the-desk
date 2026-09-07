import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { editorResources, validateMaterials } from './materials.mjs';
import { publishSite } from '../scripts/publish-site.mjs';

const editorDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(editorDir, '..');
const token = randomBytes(24).toString('hex');
let publishing = false;
let editing = false;
const paths = {
  html: path.join(editorDir, 'index.html'),
  resources: path.join(root, 'src', 'data', 'resources.json'),
  materials: path.join(root, 'src', 'data', 'unit-materials.json'),
  privateMaterials: path.join(root, 'src', 'data', 'unit-materials.private.json'),
  content: path.join(root, 'src', 'data', 'site-content.json'),
  announcements: path.join(root, 'src', 'content', 'announcements'),
};

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
const sendJson = (response, status, payload) => {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(payload));
};

const readBody = (request) => new Promise((resolve, reject) => {
  let body = '';
  request.setEncoding('utf8');
  request.on('data', (chunk) => {
    body += chunk;
    if (body.length > 2_000_000) reject(new Error('That edit is too large to save.'));
  });
  request.on('end', () => {
    try {
      resolve(JSON.parse(body || '{}'));
    } catch {
      reject(new Error('The editor could not read that change.'));
    }
  });
  request.on('error', reject);
});

const updatePrivateMaterials = async (publicMaterials) => {
  const [privateMaterials, publicLibrary] = await Promise.all([
    readJson(paths.privateMaterials),
    readJson(paths.resources),
  ]);
  const publicIds = new Set(publicLibrary.resources.map((item) => item.id));

  for (const [course, units] of Object.entries(publicMaterials.courses)) {
    privateMaterials.courses[course] ||= {};
    for (const [unit, selectedIds] of Object.entries(units)) {
      const existingIds = privateMaterials.courses[course][unit];
      const privateOnlyIds = Array.isArray(existingIds) ? existingIds.filter((id) => !publicIds.has(id)) : [];
      privateMaterials.courses[course][unit] = [...selectedIds, ...privateOnlyIds];
    }
  }

  return privateMaterials;
};

const validateContent = (template, candidate, trail = []) => {
  const clean = {};
  for (const [key, value] of Object.entries(template)) {
    const nextTrail = [...trail, key];
    if (typeof value === 'string') {
      const nextValue = candidate?.[key];
      if (typeof nextValue !== 'string' || nextValue.trim() === '') {
        throw new Error(`${nextTrail.join(' → ')} cannot be blank.`);
      }
      if (nextValue.length > 4_000) throw new Error(`${nextTrail.join(' → ')} is too long.`);
      clean[key] = nextValue.trim();
    } else {
      clean[key] = validateContent(value, candidate?.[key], nextTrail);
    }
  }
  return clean;
};

const slugify = (value) => value
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '')
  .slice(0, 70) || 'announcement';

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');

  if (url.pathname === '/' && request.method === 'GET') {
    const html = await readFile(paths.html, 'utf8');
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(html);
    return;
  }

  if (!url.pathname.startsWith('/api/') || request.headers['x-editor-token'] !== token) {
    sendJson(response, 404, { error: 'Not found.' });
    return;
  }

  const mutation = request.method === 'POST';
  if (mutation && (publishing || editing)) {
    sendJson(response, 409, { error: 'Another save or publish is in progress. Wait for it to finish, then try again.' });
    return;
  }
  if (mutation) editing = true;
  try {
    if (url.pathname === '/api/state' && request.method === 'GET') {
      const [library, materials, content, announcementFiles] = await Promise.all([
        readJson(paths.resources),
        readJson(paths.materials),
        readJson(paths.content),
        readdir(paths.announcements),
      ]);
      const resources = editorResources(library.resources, materials);
      sendJson(response, 200, { resources, materials, content, announcementCount: announcementFiles.filter((file) => file.endsWith('.md')).length });
      return;
    }

    if (url.pathname === '/api/materials' && request.method === 'POST') {
      const clean = validateMaterials(await readJson(paths.materials), (await readJson(paths.resources)).resources, await readBody(request));
      const privateMaterials = await updatePrivateMaterials(clean);
      await writeFile(paths.privateMaterials, `${JSON.stringify(privateMaterials, null, 2)}\n`, 'utf8');
      await writeFile(paths.materials, `${JSON.stringify(clean, null, 2)}\n`, 'utf8');
      sendJson(response, 200, { message: 'Material choices saved.' });
      return;
    }

    if (url.pathname === '/api/content' && request.method === 'POST') {
      const template = await readJson(paths.content);
      const clean = validateContent(template, await readBody(request));
      await writeFile(paths.content, `${JSON.stringify(clean, null, 2)}\n`, 'utf8');
      sendJson(response, 200, { message: 'Site words saved.' });
      return;
    }

    if (url.pathname === '/api/announcements' && request.method === 'POST') {
      const body = await readBody(request);
      const title = String(body.title ?? '').trim();
      const date = String(body.date ?? '').trim();
      const course = String(body.course ?? '').trim();
      const message = String(body.body ?? '').trim();
      const allowedCourses = ['', 'us history', 'hidden history', 'beyond the scoreboard', 'all classes'];
      if (title.length < 2 || title.length > 140) throw new Error('Give the announcement a short, clear title.');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Choose a date for the announcement.');
      if (!allowedCourses.includes(course)) throw new Error('Choose a class from the list.');
      if (message.length < 2 || message.length > 12_000) throw new Error('Write the announcement before saving it.');

      const frontmatter = [
        '---',
        `title: ${JSON.stringify(title)}`,
        `date: ${date}`,
        ...(course && course !== 'all classes' ? [`course: ${JSON.stringify(course)}`] : []),
        '---',
        '',
        message,
        '',
      ].join('\n');
      const file = path.join(paths.announcements, `${date}-${slugify(title)}.md`);
      await writeFile(file, frontmatter, 'utf8');
      sendJson(response, 200, { message: 'Announcement saved. Publish when you are ready.' });
      return;
    }

    if (url.pathname === '/api/publish' && request.method === 'POST') {
      publishing = true;
      try {
        const result = await publishSite(root, { editor: true });
        sendJson(response, 200, result);
      } finally { publishing = false; }
      return;
    }

    sendJson(response, 404, { error: 'Not found.' });
  } catch (error) {
    sendJson(response, 400, { error: error.friendlyMessage || error.message || 'That change could not be saved.' });
  } finally {
    if (mutation) editing = false;
  }
});

server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 4179;
  const editorUrl = `http://127.0.0.1:${port}/?token=${token}`;
  console.log('');
  console.log('  The Desk editor is open in your browser.');
  console.log('  Keep this window open while you make changes.');
  console.log('  Close it when you are finished.');
  console.log('');
  if (process.env.DESK_EDITOR_NO_OPEN === '1') {
    console.log(editorUrl);
    return;
  }
  const child = spawn('powershell.exe', ['-NoProfile', '-Command', `Start-Process '${editorUrl}'`], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
});
