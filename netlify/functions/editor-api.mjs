import { getUser, verifyRequestOrigin } from '@netlify/identity';
import { createHash } from 'node:crypto';

const REPOSITORY = process.env.EDITOR_REPOSITORY || 'Grantauch/the-desk';
const BRANCH = process.env.EDITOR_BRANCH || 'main';
const CONTENT_PATH = 'src/data/site-content.json';
const ANNOUNCEMENTS_PATH = 'src/content/announcements';
const MAX_REQUEST_BYTES = 150_000;
const ALLOWED_COURSES = new Set([
  '',
  'all classes',
  'us history',
  'hidden history',
  'beyond the scoreboard',
]);
const EDITOR_EMAIL_FINGERPRINT = '5176db8efac24887a62b56c3c3d7ebf71e376913ceb16cf18c65ad9815936b2f';

class EditorError extends Error {
  constructor(message, status = 400, code = 'EDITOR_ERROR') {
    super(message);
    this.name = 'EditorError';
    this.status = status;
    this.code = code;
  }
}

const json = (body, status = 200) => Response.json(body, {
  status,
  headers: {
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
  },
});

const githubPath = (path) => path.split('/').map(encodeURIComponent).join('/');

const fingerprintEmail = (value) => createHash('sha256')
  .update(value.trim().toLowerCase())
  .digest('hex');

const requireConfiguration = () => {
  const token = process.env.GITHUB_EDITOR_TOKEN?.trim();
  const email = process.env.EDITOR_EMAIL?.trim().toLowerCase();
  if (!token) {
    throw new EditorError(
      'Netlify has not provided GITHUB_EDITOR_TOKEN to the editor function yet.',
      503,
      'SETUP_REQUIRED',
    );
  }
  return { token, email };
};

const requireEditor = async () => {
  const user = await getUser();
  if (!user) throw new EditorError('Sign in to open the editor.', 401, 'SIGNED_OUT');

  const configuration = requireConfiguration();
  const userEmail = user.email?.trim().toLowerCase();
  const isAllowedEditor = Boolean(userEmail) && (
    configuration.email
      ? userEmail === configuration.email
      : fingerprintEmail(userEmail) === EDITOR_EMAIL_FINGERPRINT
  );
  if (!isAllowedEditor) {
    throw new EditorError('This account does not have permission to publish the site.', 403, 'NOT_EDITOR');
  }

  return { user, ...configuration };
};

const githubRequest = async (token, path, options = {}) => {
  const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/contents/${githubPath(path)}${options.query || ''}`, {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
      'User-Agent': 'GrantDesk-site-editor/1.0',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(12_000),
  });

  if (response.status === 404 && options.allowMissing) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = response.status === 401 || response.status === 403
      ? 'The private publishing connection was rejected. Its access key may need to be renewed.'
      : response.status === 409 || response.status === 422
        ? 'The site changed while this page was open. Reload the editor and try once more.'
        : 'GitHub could not save that change right now. Nothing was published.';
    throw new EditorError(message, response.status === 409 || response.status === 422 ? 409 : 502, 'PUBLISH_FAILED');
  }
  return payload;
};

const readRepositoryFile = async (token, path, allowMissing = false) => {
  const payload = await githubRequest(token, path, {
    query: `?ref=${encodeURIComponent(BRANCH)}`,
    allowMissing,
  });
  if (!payload) return null;
  if (Array.isArray(payload) || payload.type !== 'file' || payload.encoding !== 'base64') {
    throw new EditorError('The editor found an unexpected site file.', 502, 'INVALID_REPOSITORY_FILE');
  }
  return {
    sha: payload.sha,
    text: Buffer.from(String(payload.content).replace(/\s/g, ''), 'base64').toString('utf8'),
  };
};

const writeRepositoryFile = async (token, path, text, message, sha) => githubRequest(token, path, {
  method: 'PUT',
  body: {
    branch: BRANCH,
    message,
    content: Buffer.from(text, 'utf8').toString('base64'),
    ...(sha ? { sha } : {}),
  },
});

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const validateContent = (template, candidate, trail = []) => {
  if (!isPlainObject(candidate)) {
    throw new EditorError(`${trail.join(' → ') || 'Site words'} are incomplete.`);
  }

  const clean = {};
  for (const [key, templateValue] of Object.entries(template)) {
    const nextTrail = [...trail, key];
    if (typeof templateValue === 'string') {
      const value = candidate[key];
      if (typeof value !== 'string' || !value.trim()) {
        throw new EditorError(`${nextTrail.join(' → ')} cannot be blank.`);
      }
      if (value.length > 4_000) throw new EditorError(`${nextTrail.join(' → ')} is too long.`);
      clean[key] = value.trim();
      continue;
    }
    clean[key] = validateContent(templateValue, candidate[key], nextTrail);
  }

  return clean;
};

const validateLinks = (content) => {
  let classroom;
  try {
    classroom = new URL(content.links.googleClassroom);
  } catch {
    throw new EditorError('The Google Classroom link needs a complete web address.');
  }
  if (classroom.protocol !== 'https:') {
    throw new EditorError('The Google Classroom link must begin with https://.');
  }
};

const slugify = (value) => value
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '')
  .slice(0, 70) || 'announcement';

const readBody = async (request) => {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > MAX_REQUEST_BYTES) throw new EditorError('That change is too large for the editor.', 413, 'TOO_LARGE');
  const body = await request.json().catch(() => null);
  if (!isPlainObject(body)) throw new EditorError('The editor sent an incomplete change.');
  return body;
};

const loadState = async (token) => {
  const [contentFile, announcementFiles] = await Promise.all([
    readRepositoryFile(token, CONTENT_PATH),
    githubRequest(token, ANNOUNCEMENTS_PATH, { query: `?ref=${encodeURIComponent(BRANCH)}` }),
  ]);

  let content;
  try {
    content = JSON.parse(contentFile.text);
  } catch {
    throw new EditorError('The site words file is not valid JSON.', 502, 'INVALID_CONTENT_FILE');
  }

  return {
    content,
    announcementCount: Array.isArray(announcementFiles)
      ? announcementFiles.filter((file) => file.type === 'file' && file.name.endsWith('.md')).length
      : 0,
  };
};

const saveContent = async (token, candidate) => {
  const currentFile = await readRepositoryFile(token, CONTENT_PATH);
  let template;
  try {
    template = JSON.parse(currentFile.text);
  } catch {
    throw new EditorError('The site words file is not valid JSON.', 502, 'INVALID_CONTENT_FILE');
  }

  const clean = validateContent(template, candidate);
  validateLinks(clean);
  const result = await writeRepositoryFile(
    token,
    CONTENT_PATH,
    `${JSON.stringify(clean, null, 2)}\n`,
    'update site words from the desk editor',
    currentFile.sha,
  );

  return {
    content: clean,
    commitUrl: result.commit?.html_url,
    message: 'Saved to the site. The rebuild usually takes a minute or two. Reload the page to confirm the new words are showing.',
  };
};

const findAnnouncementPath = async (token, date, title) => {
  const stem = `${date}-${slugify(title)}`;
  for (let version = 1; version <= 20; version += 1) {
    const suffix = version === 1 ? '' : `-${version}`;
    const path = `${ANNOUNCEMENTS_PATH}/${stem}${suffix}.md`;
    const existing = await readRepositoryFile(token, path, true);
    if (!existing) return path;
  }
  throw new EditorError('There are too many announcements with that exact title and date. Change one of them slightly.');
};

const publishAnnouncement = async (token, candidate) => {
  const title = String(candidate.title || '').trim();
  const date = String(candidate.date || '').trim();
  const course = String(candidate.course || '').trim().toLowerCase();
  const body = String(candidate.body || '').replace(/\r\n?/g, '\n').trim();

  if (title.length < 2 || title.length > 140) throw new EditorError('Give the announcement a short, clear title.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new EditorError('Choose a date for the announcement.');
  if (!ALLOWED_COURSES.has(course)) throw new EditorError('Choose a class from the list.');
  if (body.length < 2 || body.length > 12_000) throw new EditorError('Write the announcement before publishing it.');
  if (/<\s*(?:script|iframe|object|embed)\b/i.test(body)) {
    throw new EditorError('That announcement includes web code the editor cannot publish.');
  }

  const path = await findAnnouncementPath(token, date, title);
  const markdown = [
    '---',
    `title: ${JSON.stringify(title)}`,
    `date: ${date}`,
    ...(course && course !== 'all classes' ? [`course: ${JSON.stringify(course)}`] : []),
    '---',
    '',
    body,
    '',
  ].join('\n');
  const result = await writeRepositoryFile(
    token,
    path,
    markdown,
    `post announcement: ${title.slice(0, 72)}`,
  );

  return {
    commitUrl: result.commit?.html_url,
    message: 'Announcement published. It should appear on the homepage in a minute or two.',
  };
};

export default async (request) => {
  try {
    const { token, user } = await requireEditor();

    if (request.method === 'GET') {
      return json({ ...(await loadState(token)), user: { email: user.email } });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' }, 405);
    }

    verifyRequestOrigin(request);
    const body = await readBody(request);
    if (body.action === 'content') {
      return json(await saveContent(token, body.content));
    }
    if (body.action === 'announcement') {
      return json(await publishAnnouncement(token, body));
    }
    throw new EditorError('Choose what you want to publish.');
  } catch (error) {
    if (error instanceof EditorError) {
      return json({ error: error.message, code: error.code }, error.status);
    }
    const status = Number.isInteger(error?.status) ? error.status : 500;
    return json({
      error: status === 403
        ? 'This browser could not verify that the request came from the editor.'
        : 'The editor hit an unexpected problem. Nothing was published.',
      code: status === 403 ? 'BAD_ORIGIN' : 'UNEXPECTED_ERROR',
    }, status);
  }
};
