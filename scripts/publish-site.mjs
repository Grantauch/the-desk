import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readlinkSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline/promises';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const editorPath = (name) => ['src/data/unit-materials.json', 'src/data/site-content.json'].includes(name)
  || /^src\/content\/announcements\/[^/]+\.md$/.test(name);
const names = (output) => output.split('\0').filter(Boolean);

export function run(command, args, cwd, log = () => {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; log(String(chunk)); });
    child.stderr.on('data', (chunk) => { stderr += chunk; log(String(chunk)); });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolveRun(stdout) : reject(new Error(
      `${command} failed (${code}). ${(stderr || stdout).trim()}`,
    )));
  });
}

export async function publishSite(projectRoot = root, { editor = false, confirm = async () => true, log = () => {} } = {}) {
  const git = (...args) => run('git', args, projectRoot);
  const gitPath = async (name) => resolve(projectRoot, (await git('rev-parse', '--git-path', name)).trim());
  const checkIndexLock = async () => {
    if (existsSync(await gitPath('index.lock'))) throw new Error('Git is locked. Finish the other Git operation and try again. The lock was not removed.');
  };
  await checkIndexLock();
  const publishLock = await gitPath('grantdesk-publish.lock');
  let lock;
  try { lock = openSync(publishLock, 'wx'); }
  catch { throw new Error('Another publish is running, or a previous publish needs review. No lock was removed.'); }
  try {
    const branch = (await git('branch', '--show-current')).trim();
    if (branch !== 'main') throw new Error(`Publishing is only allowed from main. Current branch: ${branch || 'detached HEAD'}.`);
    const beforeHead = (await git('rev-parse', 'HEAD')).trim();
    const remoteHead = async () => {
      const output = (await git('ls-remote', '--exit-code', 'origin', 'refs/heads/main')).trim();
      const sha = output.split(/\s+/)[0];
      if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('Could not confirm the remote main commit. Nothing was published.');
      return sha;
    };
    const beforeRemote = await remoteHead();
    // No automatic pull/merge and no force push. A pending local commit can be
    // retried after a failed upload, but remote divergence must be resolved first.
    try { await git('merge-base', '--is-ancestor', beforeRemote, beforeHead); }
    catch { throw new Error('Remote main has changes this checkout does not contain. Update and review the checkout before publishing.'); }
    const staged = names(await git('diff', '--cached', '--name-only', '-z'));
    const unstaged = names(await git('diff', '--name-only', '-z'));
    const untracked = names(await git('ls-files', '--others', '--exclude-standard', '-z'));
    if (editor) {
      if (staged.length) throw new Error('There are already staged changes. Review and publish that batch separately before using the editor.');
      const pending = names(await git('diff', '--name-only', '-z', `${beforeRemote}..HEAD`));
      if ([...unstaged, ...untracked, ...pending].some((name) => !editorPath(name))) {
        throw new Error('Other project changes are present. Publish or separate that batch before publishing editor changes.');
      }
    } else if (unstaged.length || untracked.length) {
      throw new Error('Stage only the intended files and review the batch first. Unstaged or untracked files remain; nothing was staged automatically.');
    }
    const editorChanges = [...new Set([...unstaged, ...untracked])];
    if (!staged.length && !editorChanges.length && beforeHead === beforeRemote) {
      return { status: 'unchanged', commit: beforeHead, message: 'No new changes to upload. Local and remote commits match; live deployment was not checked.' };
    }
    const snapshot = async () => {
      const hash = createHash('sha256');
      hash.update(await git('status', '--porcelain=v1', '-z', '--untracked-files=all'));
      hash.update(await git('diff', '--cached', '--binary'));
      const files = [...new Set(names(await git('ls-files', '--cached', '--others', '--exclude-standard', '-z')))];
      // Also prove that publishing leaves the ignored authoring sources alone.
      files.push('src/data/resources.private.json', 'src/data/unit-materials.private.json');
      for (const name of [...new Set(files)].sort()) {
        hash.update(`${name}\0`);
        const file = resolve(projectRoot, name);
        if (!existsSync(file)) { hash.update('missing\0'); continue; }
        const stat = lstatSync(file);
        hash.update(stat.isSymbolicLink() ? readlinkSync(file) : readFileSync(file));
        hash.update('\0');
      }
      return hash.digest('hex');
    };
    const beforeFiles = await snapshot();
    log('Running the complete release verification...\n');
    // Only this fixed npm command uses cmd.exe; filenames and user text are
    // always separate Git arguments, never shell interpolation.
    if (process.platform === 'win32') await run('cmd.exe', ['/d', '/s', '/c', 'npm.cmd run verify'], projectRoot, log);
    else await run('npm', ['run', 'verify'], projectRoot, log);
    const assertUnchanged = async () => {
      await checkIndexLock();
      if ((await git('rev-parse', 'HEAD')).trim() !== beforeHead || await snapshot() !== beforeFiles) {
        throw new Error('Project files or the selected batch changed during verification. Review the changes and verify again; nothing was uploaded.');
      }
      if (await remoteHead() !== beforeRemote) throw new Error('Remote main changed during verification. Update and review before publishing.');
    };
    await assertUnchanged();
    const review = editor ? editorChanges.join('\n') : await git('diff', '--cached', '--stat');
    const pendingReview = beforeHead !== beforeRemote ? await git('log', '--oneline', `${beforeRemote}..HEAD`) : '';
    if (!await confirm([review, pendingReview].filter(Boolean).join('\n'))) {
      return { status: 'cancelled', message: 'Cancelled. Your files and selected batch are still saved locally.' };
    }
    await assertUnchanged();
    if (editorChanges.length) await git('add', '--', ...editorChanges);
    const expectedTree = (await git('write-tree')).trim();
    if (staged.length || editorChanges.length) {
      await git('diff', '--cached', '--check');
      await git('commit', '-m', editor ? 'update the desk from site editor' : 'update the desk');
    }
    const commit = (await git('rev-parse', 'HEAD')).trim();
    if ((await git('rev-parse', 'HEAD^{tree}')).trim() !== expectedTree
      || (await git('status', '--porcelain=v1', '--untracked-files=all')).trim()) {
      throw new Error('The commit or working files changed after verification. The local commit was preserved; review it before uploading.');
    }
    let pushError;
    try { await git('push', 'origin', 'HEAD:refs/heads/main'); } catch (error) { pushError = error; }
    let uploaded;
    try { uploaded = await remoteHead(); }
    catch { throw new Error('Upload status could not be confirmed. Your commit is safe locally. Check remote main before retrying.'); }
    if (uploaded !== commit) {
      throw new Error(`Upload was not confirmed. Your commit is safe locally. ${pushError?.message || 'Remote main does not match the tested commit.'}`);
    }
    return { status: 'pushed', commit, message: 'Saved to GitHub and remote commit confirmed. Netlify will check and rebuild the site; confirm the deployment before calling it live.' };
  } finally {
    closeSync(lock);
    // This function owns this separate lock. It never deletes Git's index.lock.
    unlinkSync(publishLock);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await publishSite(root, {
      log: (message) => process.stdout.write(message),
      confirm: async (review) => {
        console.log(`\nVerified batch:\n${review}\n`);
        const prompt = createInterface({ input: process.stdin, output: process.stdout });
        try { return /^y(es)?$/i.test((await prompt.question('Upload this batch to GitHub? [y/N] ')).trim()); }
        finally { prompt.close(); }
      },
    });
    console.log(result.message);
  } catch (error) {
    console.error(`STOP: ${error.message}`);
    process.exitCode = 1;
  }
}
