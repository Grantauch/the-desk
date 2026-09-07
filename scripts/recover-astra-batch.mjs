import { readFileSync, writeFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const write = (path, text) => writeFileSync(path, text, 'utf8');
const replaceOnce = (path, before, after) => {
  const text = read(path);
  const first = text.indexOf(before);
  if (first < 0) throw new Error(`Patch target not found in ${path}: ${before.slice(0, 100)}`);
  if (text.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Patch target is ambiguous in ${path}: ${before.slice(0, 100)}`);
  }
  write(path, `${text.slice(0, first)}${after}${text.slice(first + before.length)}`);
};

// Course pages no longer own the current-unit flag.
for (const [path, marker] of [
  ['src/pages/us-history.astro', "    name: 'Reconstruction',\n    hubSlug: 'reconstruction',\n    blurb: 'The war is over. Now comes the fight over what it meant.',\n    current: true,\n"],
  ['src/pages/hidden-history.astro', "    name: 'The Official Story vs. The Rumor',\n    hubSlug: 'official-story-vs-rumor',\n    blurb: 'Roswell, Area 51, and the foundations of evidence. Habit of mind: QUESTION.',\n    current: true,\n"],
  ['src/pages/beyond-the-scoreboard.astro', "    name: 'Inventing American Sport, 1860s–1900',\n    hubSlug: 'inventing-american-sport',\n    blurb: 'Industrial cities build the modern game; the color line is drawn.',\n    current: true,\n"],
]) {
  replaceOnce(path, marker, marker.replace('    current: true,\n', ''));
}

// Shared course renderer applies the single classroom-state record and fails the build
// if a configured current unit no longer exists.
replaceOnce(
  'src/components/CoursePage.astro',
  "import Base from '../layouts/Base.astro';\nimport { learningCourses } from '../data/learningHubs';\n",
  "import Base from '../layouts/Base.astro';\nimport { currentUnitFor } from '../data/classroom-state';\nimport { learningCourses } from '../data/learningHubs';\n",
);
replaceOnce(
  'src/components/CoursePage.astro',
  'const resolvedUnits = units.map((unit, index) => {\n',
  'const resolvedUnitsBase = units.map((unit, index) => {\n',
);
replaceOnce(
  'src/components/CoursePage.astro',
  'const currentIndex = resolvedUnits.findIndex((unit) => unit.current);\nconst currentUnit = currentIndex >= 0 ? resolvedUnits[currentIndex] : undefined;\n',
  "const currentUnitName = currentUnitFor(libraryCourse, resolvedUnitsBase.map((unit) => unit.name));\nconst resolvedUnits = resolvedUnitsBase.map((unit) => ({\n  ...unit,\n  current: unit.name === currentUnitName,\n}));\nconst currentIndex = resolvedUnits.findIndex((unit) => unit.current);\nconst currentUnit = currentIndex >= 0 ? resolvedUnits[currentIndex] : undefined;\n",
);

// Calendar's current September entries come from that same record.
replaceOnce(
  'src/pages/calendar.astro',
  "import Base from '../layouts/Base.astro';\n",
  "import Base from '../layouts/Base.astro';\nimport { classroomCalendarHighlights } from '../data/classroom-state';\n",
);
replaceOnce(
  'src/pages/calendar.astro',
  "const milestones: Milestone[] = [\n  { month: 'september', when: 'first week', course: 'hidden', title: 'the roswell headline reveal', detail: 'Your first verdict of the year—and an exit ticket worth hanging onto until June.' },\n  { month: 'september', when: 'first week', course: 'scoreboard', title: 'inventing american sport', detail: 'Factories, leagues, the color line, and the system behind the score.' },\n",
  'const milestones: Milestone[] = [\n  ...classroomCalendarHighlights,\n',
);

// Two real contrast issues found by Astra's browser QA.
replaceOnce(
  'src/components/FeaturedMedia.astro',
  'class="mt-2 text-xs lowercase text-white/45">credit: {credit}</p>',
  'class="mt-2 text-xs lowercase text-white/70">credit: {credit}</p>',
);
replaceOnce(
  'src/styles/desk-polish.css',
  '.tools-jump a span { opacity:.55; }\n',
  '.tools-jump a span { color:var(--color-accent-dark); opacity:1; font-weight:700; }\n.tools-jump a:hover span { color:white; }\n',
);

// Remote web editor: every write goes to a fresh review branch, not main.
replaceOnce(
  'netlify/functions/editor-api.mjs',
  "import { createHash } from 'node:crypto';\n",
  "import { createHash, randomBytes } from 'node:crypto';\n",
);
replaceOnce(
  'netlify/functions/editor-api.mjs',
  "const readRepositoryFile = async (token, path, allowMissing = false) => {\n  const payload = await githubRequest(token, path, {\n    query: `?ref=${encodeURIComponent(BRANCH)}`,\n    allowMissing,\n  });\n",
  "const readRepositoryFile = async (token, path, allowMissing = false, ref = BRANCH) => {\n  const payload = await githubRequest(token, path, {\n    query: `?ref=${encodeURIComponent(ref)}`,\n    allowMissing,\n  });\n",
);
replaceOnce(
  'netlify/functions/editor-api.mjs',
  "const writeRepositoryFile = async (token, path, text, message, sha) => githubRequest(token, path, {\n  method: 'PUT',\n  body: {\n    branch: BRANCH,\n    message,\n    content: Buffer.from(text, 'utf8').toString('base64'),\n    ...(sha ? { sha } : {}),\n  },\n});\n",
  "const writeRepositoryFile = async (token, path, text, message, sha, branch = BRANCH) => githubRequest(token, path, {\n  method: 'PUT',\n  body: {\n    branch,\n    message,\n    content: Buffer.from(text, 'utf8').toString('base64'),\n    ...(sha ? { sha } : {}),\n  },\n});\n\nconst githubRepositoryRequest = async (token, path, options = {}) => {\n  const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/${path}`, {\n    method: options.method || 'GET',\n    headers: {\n      Accept: 'application/vnd.github+json',\n      Authorization: `Bearer ${token}`,\n      'Content-Type': 'application/json; charset=utf-8',\n      'User-Agent': 'GrantDesk-site-editor/1.0',\n      'X-GitHub-Api-Version': '2022-11-28',\n    },\n    body: options.body ? JSON.stringify(options.body) : undefined,\n    signal: AbortSignal.timeout(12_000),\n  });\n  const payload = await response.json().catch(() => ({}));\n  if (!response.ok) {\n    const message = response.status === 401 || response.status === 403\n      ? 'The private publishing connection cannot create a review branch. Its access key may need to be renewed.'\n      : 'GitHub could not prepare that review right now. Nothing was published.';\n    throw new EditorError(message, response.status === 409 || response.status === 422 ? 409 : 502, 'REVIEW_FAILED');\n  }\n  return payload;\n};\n\nconst createReviewBranch = async (token, purpose) => {\n  const base = await githubRepositoryRequest(token, `git/ref/heads/${encodeURIComponent(BRANCH)}`);\n  const baseSha = base?.object?.sha;\n  if (!/^[0-9a-f]{40}$/.test(baseSha || '')) {\n    throw new EditorError('GitHub could not identify the current live revision.', 502, 'REVIEW_FAILED');\n  }\n  const branch = `editor/review-${purpose}-${Date.now()}-${randomBytes(3).toString('hex')}`;\n  await githubRepositoryRequest(token, 'git/refs', {\n    method: 'POST',\n    body: { ref: `refs/heads/${branch}`, sha: baseSha },\n  });\n  return branch;\n};\n\nconst reviewUrlFor = (branch) =>\n  `https://github.com/${REPOSITORY}/compare/${encodeURIComponent(BRANCH)}...${encodeURIComponent(branch)}?expand=1`;\n",
);
replaceOnce(
  'netlify/functions/editor-api.mjs',
  "  const clean = validateContent(template, candidate);\n  validateLinks(clean);\n  const result = await writeRepositoryFile(\n    token,\n    CONTENT_PATH,\n    `${JSON.stringify(clean, null, 2)}\\n`,\n    'update site words from the desk editor',\n    currentFile.sha,\n  );\n\n  return {\n    content: clean,\n    commitUrl: result.commit?.html_url,\n    message: 'Saved to the site. The rebuild usually takes a minute or two. Reload the page to confirm the new words are showing.',\n  };\n",
  "  const clean = validateContent(template, candidate);\n  validateLinks(clean);\n  const reviewBranch = await createReviewBranch(token, 'site-words');\n  const result = await writeRepositoryFile(\n    token,\n    CONTENT_PATH,\n    `${JSON.stringify(clean, null, 2)}\\n`,\n    'review site words from the desk editor',\n    currentFile.sha,\n    reviewBranch,\n  );\n\n  return {\n    content: clean,\n    commitUrl: result.commit?.html_url,\n    branch: reviewBranch,\n    reviewUrl: reviewUrlFor(reviewBranch),\n    message: 'Saved for review. This is not live yet; open the review link and merge it after the checks pass.',\n  };\n",
);
replaceOnce(
  'netlify/functions/editor-api.mjs',
  'const findAnnouncementPath = async (token, date, title) => {\n',
  'const findAnnouncementPath = async (token, date, title, ref = BRANCH) => {\n',
);
replaceOnce(
  'netlify/functions/editor-api.mjs',
  '    const existing = await readRepositoryFile(token, path, true);\n',
  '    const existing = await readRepositoryFile(token, path, true, ref);\n',
);
replaceOnce(
  'netlify/functions/editor-api.mjs',
  "  const path = await findAnnouncementPath(token, date, title);\n  const markdown = [\n",
  "  const reviewBranch = await createReviewBranch(token, 'announcement');\n  const path = await findAnnouncementPath(token, date, title, reviewBranch);\n  const markdown = [\n",
);
replaceOnce(
  'netlify/functions/editor-api.mjs',
  "  const result = await writeRepositoryFile(\n    token,\n    path,\n    markdown,\n    `post announcement: ${title.slice(0, 72)}`,\n  );\n\n  return {\n    commitUrl: result.commit?.html_url,\n    message: 'Announcement published. It should appear on the homepage in a minute or two.',\n  };\n",
  "  const result = await writeRepositoryFile(\n    token,\n    path,\n    markdown,\n    `review announcement: ${title.slice(0, 72)}`,\n    undefined,\n    reviewBranch,\n  );\n\n  return {\n    commitUrl: result.commit?.html_url,\n    branch: reviewBranch,\n    reviewUrl: reviewUrlFor(reviewBranch),\n    message: 'Announcement saved for review. It is not live until the review is merged and the site deploy finishes.',\n  };\n",
);

// Private web editor copy and a persistent link to the review it just created.
replaceOnce(
  'src/pages/editor.astro',
  'Change the words students see, post an announcement, and press publish. That is the whole job.',
  'Change the words students see, post an announcement, and save the change for review. It goes live only after the checks pass and the review is merged.',
);
replaceOnce(
  'src/pages/editor.astro',
  '<p><strong>Ready to send.</strong> This button saves the announcement and starts a site rebuild. There is no separate coding step. Give it a minute, then load the page to confirm it is there.</p>\n              <button id="announcement-publish" class="button button--coral" type="submit">publish announcement →</button>',
  '<p><strong>Ready to review.</strong> This saves the announcement on a review branch. It is not live until the review is merged after the checks pass.</p>\n              <button id="announcement-publish" class="button button--coral" type="submit">save announcement for review →</button>',
);
replaceOnce(
  'src/pages/editor.astro',
  '<span id="save-state">everything saved</span>\n        <small>saved changes start a rebuild, usually a minute before the site shows them</small>\n      </div>\n      <button id="publish-words" class="button button--coral" type="button" disabled>publish site words →</button>',
  '<span id="save-state">everything saved</span>\n        <small>saved changes are not live until their review passes and is merged</small>\n        <a id="review-link" href="#" target="_blank" rel="noopener" hidden>open latest review ↗</a>\n      </div>\n      <button id="publish-words" class="button button--coral" type="button" disabled>save site words for review →</button>',
);
replaceOnce(
  'src/pages/editor.astro',
  "      const announcementForm = document.querySelector<HTMLFormElement>('#announcement-form')!;\n",
  "      const announcementForm = document.querySelector<HTMLFormElement>('#announcement-form')!;\n      const reviewLink = document.querySelector<HTMLAnchorElement>('#review-link')!;\n",
);
replaceOnce(
  'src/pages/editor.astro',
  "      const showToast = (message: string, error = false) => {\n        window.clearTimeout(toastTimer);\n        toast.textContent = message;\n        toast.dataset.error = String(error);\n        toast.hidden = false;\n        toastTimer = window.setTimeout(() => { toast.hidden = true; }, error ? 7000 : 5000);\n      };\n",
  "      const showToast = (message: string, error = false) => {\n        window.clearTimeout(toastTimer);\n        toast.textContent = message;\n        toast.dataset.error = String(error);\n        toast.hidden = false;\n        toastTimer = window.setTimeout(() => { toast.hidden = true; }, error ? 7000 : 5000);\n      };\n\n      const showReviewLink = (result: { reviewUrl?: string }) => {\n        if (!result.reviewUrl) return;\n        reviewLink.href = result.reviewUrl;\n        reviewLink.hidden = false;\n      };\n",
);
replaceOnce('src/pages/editor.astro', "        setBusy(publishWordsButton, true, 'publishing…');\n", "        setBusy(publishWordsButton, true, 'saving for review…');\n");
replaceOnce(
  'src/pages/editor.astro',
  "          updateDirtyState();\n          showToast(result.message);\n        } catch (error) {\n          showToast(error instanceof Error ? error.message : 'Those words could not be published.', true);\n",
  "          updateDirtyState();\n          showReviewLink(result);\n          showToast(result.message);\n        } catch (error) {\n          showToast(error instanceof Error ? error.message : 'Those words could not be saved for review.', true);\n",
);
replaceOnce('src/pages/editor.astro', "        setBusy(button, true, 'publishing…');\n", "        setBusy(button, true, 'saving for review…');\n");
replaceOnce(
  'src/pages/editor.astro',
  "          const count = document.querySelector('#announcement-count')!;\n          const currentCount = Number(count.textContent?.replace(/\\D/g, '') || 0) + 1;\n          count.textContent = `(${currentCount})`;\n          showToast(result.message);\n",
  "          showReviewLink(result);\n          showToast(result.message);\n",
);
replaceOnce(
  'src/pages/editor.astro',
  "          showToast(error instanceof Error ? error.message : 'That announcement could not be published.', true);\n",
  "          showToast(error instanceof Error ? error.message : 'That announcement could not be saved for review.', true);\n",
);
replaceOnce(
  'src/pages/editor.astro',
  '  .publish-bar small {',
  '  #review-link { display:inline-block; margin-top:.25rem; color:#c9cdff; font-size:.72rem; font-weight:750; text-underline-offset:.2rem; }\n  .publish-bar small {',
);

// Local editor publish flow: verify, commit, push a review branch, then restore local main.
replaceOnce('scripts/publish-site.mjs', "import { createHash } from 'node:crypto';\n", "import { createHash, randomBytes } from 'node:crypto';\n");
replaceOnce(
  'scripts/publish-site.mjs',
  'export async function publishSite(projectRoot = root, { editor = false, confirm = async () => true, log = () => {} } = {}) {\n',
  'export async function publishSite(projectRoot = root, { editor = false, reviewBranch = false, confirm = async () => true, log = () => {} } = {}) {\n',
);
replaceOnce(
  'scripts/publish-site.mjs',
  "    const remoteHead = async () => {\n      const output = (await git('ls-remote', '--exit-code', 'origin', 'refs/heads/main')).trim();\n      const sha = output.split(/\\s+/)[0];\n      if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('Could not confirm the remote main commit. Nothing was published.');\n      return sha;\n    };\n    const beforeRemote = await remoteHead();\n",
  "    const remoteRef = async (name) => {\n      const output = (await git('ls-remote', '--exit-code', 'origin', `refs/heads/${name}`)).trim();\n      const sha = output.split(/\\s+/)[0];\n      if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`Could not confirm remote branch ${name}. Nothing was published.`);\n      return sha;\n    };\n    const remoteHead = () => remoteRef('main');\n    const beforeRemote = await remoteHead();\n",
);
replaceOnce(
  'scripts/publish-site.mjs',
  "    let pushError;\n    try { await git('push', 'origin', 'HEAD:refs/heads/main'); } catch (error) { pushError = error; }\n    let uploaded;\n    try { uploaded = await remoteHead(); }\n    catch { throw new Error('Upload status could not be confirmed. Your commit is safe locally. Check remote main before retrying.'); }\n    if (uploaded !== commit) {\n      throw new Error(`Upload was not confirmed. Your commit is safe locally. ${pushError?.message || 'Remote main does not match the tested commit.'}`);\n    }\n    return { status: 'pushed', commit, message: 'Saved to GitHub and remote commit confirmed. Netlify will check and rebuild the site; confirm the deployment before calling it live.' };\n",
  "    const reviewName = reviewBranch\n      ? `editor/review-local-${Date.now()}-${randomBytes(3).toString('hex')}`\n      : null;\n    const targetRef = reviewName ? `refs/heads/${reviewName}` : 'refs/heads/main';\n    let pushError;\n    try { await git('push', 'origin', `HEAD:${targetRef}`); } catch (error) { pushError = error; }\n    let uploaded;\n    try { uploaded = reviewName ? await remoteRef(reviewName) : await remoteHead(); }\n    catch { throw new Error('Upload status could not be confirmed. Your commit is safe locally. Check GitHub before retrying.'); }\n    if (uploaded !== commit) {\n      throw new Error(`Upload was not confirmed. Your commit is safe locally. ${pushError?.message || 'The remote branch does not match the tested commit.'}`);\n    }\n    if (reviewName) {\n      await git('reset', '--hard', beforeRemote);\n      return {\n        status: 'review',\n        commit,\n        branch: reviewName,\n        reviewUrl: `https://github.com/Grantauch/the-desk/compare/main...${encodeURIComponent(reviewName)}?expand=1`,\n        message: 'Saved for review. This is not live yet; open the review link and merge it after the checks pass.',\n      };\n    }\n    return { status: 'pushed', commit, message: 'Saved to GitHub and remote commit confirmed. Netlify will check and rebuild the site; confirm the deployment before calling it live.' };\n",
);
replaceOnce(
  'editor/server.mjs',
  '        const result = await publishSite(root, { editor: true });\n',
  '        const result = await publishSite(root, { editor: true, reviewBranch: true });\n',
);

// Local editor copy and review link.
replaceOnce(
  'editor/index.html',
  'Changes stay on this computer until you press <strong>publish changes</strong>. Students cannot see this editor.',
  'Changes stay on this computer until you press <strong>save for review</strong>. Students cannot see this editor, and nothing goes live until the review is merged.',
);
replaceOnce(
  'editor/index.html',
  'Write it once. It will appear on the home page, the announcements page, and the RSS feed after you publish.',
  'Write it once. After its review passes and is merged, it will appear on the home page, the announcements page, and the RSS feed.',
);
replaceOnce(
  'editor/index.html',
  '<p><strong>Ready for students?</strong><small>Saved edits reach the site only after this step, and only once the rebuild finishes.</small></p>\n      <button id="publish" type="button" class="publish">publish changes →</button>',
  '<p><strong>Ready for review?</strong><small>This creates a review branch. Nothing is live until its checks pass and it is merged.</small><a id="local-review-link" href="#" target="_blank" rel="noopener" hidden>open latest review ↗</a></p>\n      <button id="publish" type="button" class="publish">save for review →</button>',
);
replaceOnce(
  'editor/index.html',
  '      .publish-bar small { display: block; margin-top: 2px; color: rgba(255,255,255,.6); }\n',
  '      .publish-bar small { display: block; margin-top: 2px; color: rgba(255,255,255,.6); }\n      #local-review-link { display: inline-block; margin-top: 4px; color: #c9cdff; font-size: 12px; font-weight: 800; text-underline-offset: 3px; }\n',
);
replaceOnce(
  'editor/index.html',
  "      const toast = document.querySelector('#toast');\n      let state;\n",
  "      const toast = document.querySelector('#toast');\n      const localReviewLink = document.querySelector('#local-review-link');\n      let state;\n",
);
replaceOnce(
  'editor/index.html',
  "      document.querySelector('#publish').addEventListener('click', (event) => busy(event.currentTarget, async () => {\n        const result = await api('/api/publish', { method: 'POST', body: '{}' });\n        notice(result.message);\n      }));\n",
  "      document.querySelector('#publish').addEventListener('click', (event) => busy(event.currentTarget, async () => {\n        const result = await api('/api/publish', { method: 'POST', body: '{}' });\n        if (result.reviewUrl) {\n          localReviewLink.href = result.reviewUrl;\n          localReviewLink.hidden = false;\n        }\n        notice(result.message);\n      }));\n",
);

// Publishing integration expectations for the protected editor path.
replaceOnce(
  'scripts/test-publishing.mjs',
  "    await commit(f.base, 'editor/server.mjs', 'editor/materials.mjs', 'editor/index.html', 'scripts/publish-site.mjs', 'src/lib/public-resources.js', 'src/data/resources.json', 'src/data/unit-materials.json', 'gate.cjs');\n    await git(f.base, 'push', 'origin', 'main');\n    const child = spawn(process.execPath, ['editor/server.mjs'],",
  "    await commit(f.base, 'editor/server.mjs', 'editor/materials.mjs', 'editor/index.html', 'scripts/publish-site.mjs', 'src/lib/public-resources.js', 'src/data/resources.json', 'src/data/unit-materials.json', 'gate.cjs');\n    await git(f.base, 'push', 'origin', 'main');\n    const editorBaseHead = (await git(f.base, 'rev-parse', 'HEAD')).trim();\n    const child = spawn(process.execPath, ['editor/server.mjs'],",
);
replaceOnce(
  'scripts/test-publishing.mjs',
  "      assert.equal(release.status, 'pushed');\n      assert.equal((await git(f.remote, 'rev-parse', 'main')).trim(), release.commit);\n",
  "      assert.equal(release.status, 'review');\n      assert.match(release.branch, /^editor\\/review-local-/);\n      assert.equal((await git(f.remote, 'rev-parse', 'main')).trim(), editorBaseHead);\n      assert.equal((await git(f.remote, 'rev-parse', `refs/heads/${release.branch}`)).trim(), release.commit);\n",
);
replaceOnce(
  'scripts/test-publishing.mjs',
  "    assert.match(read(root, 'editor/server.mjs'), /publishSite\\(root, \\{ editor: true \\}\\)/);\n",
  "    assert.match(read(root, 'editor/server.mjs'), /publishSite\\(root, \\{ editor: true, reviewBranch: true \\}\\)/);\n    assert.match(read(root, 'netlify/functions/editor-api.mjs'), /createReviewBranch/);\n    assert.match(read(root, 'netlify/functions/editor-api.mjs'), /Saved for review/);\n",
);

// GitHub gets the real-browser check after the canonical release gate. Netlify keeps
// its existing npm run verify command in this batch.
replaceOnce(
  '.github/workflows/site-check.yml',
  '      - name: Verify the release once, including the production build\n        run: npm run verify\n',
  '      - name: Verify the release once, including the production build\n        run: npm run verify\n\n      - name: Install Chromium for browser checks\n        run: npx playwright install --with-deps chromium\n\n      - name: Check key pages in a real browser\n        run: npm run browser:test\n',
);

console.log('Astra maintenance batch reconstructed.');
