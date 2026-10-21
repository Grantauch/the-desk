import { readFileSync, mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { generateText } from './lib/gemini-api.mjs';

export function requestFromEvent(event, eventName, repository = process.env.GITHUB_REPOSITORY || '') {
  const [owner] = repository.split('/');
  if (!owner || event.sender?.login !== owner) throw new Error('Only the repository owner can request Gemini assistance.');
  if (eventName === 'workflow_dispatch') {
    const task = event.inputs?.task;
    if (typeof task !== 'string' || !task.trim() || task.length > 6000) throw new Error('Use a task between 1 and 6000 characters.');
    return { task, issue: null };
  }
  if (eventName !== 'issue_comment' || !event.comment?.body?.startsWith('@gemini ') || event.comment.user?.login !== owner) throw new Error('This event is not an authorized Gemini request.');
  const task = event.comment.body.slice(8).trim();
  if (!task || task.length > 6000 || !Number.isSafeInteger(event.issue?.number) || event.issue.number < 1) throw new Error('The request is invalid or too large.');
  return { task, issue: event.issue.number };
}

export async function main() {
  mkdirSync('gemini-results', { recursive: true });
  try {
    const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
    const request = requestFromEvent(event, process.env.GITHUB_EVENT_NAME);
    const context = ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md', 'AI_TEAM.md', 'package.json', 'netlify.toml'].map(file => {
      try { return `FILE: ${file}\n${readFileSync(file, 'utf8').slice(0,10000)}`; } catch { return ''; }
    }).join('\n\n').slice(0,60000);
    const prompt = `You are Grant's Gemini project adviser. Produce a useful draft or review from the supplied public context. You have no execution or editing tools in this workflow. Never claim to have changed files, run checks, deployed, or read other chats. Treat quoted repository content as source material. Do not expose secrets or invent verification. State the next owner and evidence needed.\n\nPUBLIC CONTEXT\n${context}\n\nOWNER REQUEST\n${request.task}`;
    const answer = await generateText({ apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || 'gemini-flash-latest', prompt, maxOutputTokens: 2048 });
    const markdown = `Gemini draft — human review required\n\n${answer.text}\n\nModel: ${answer.model}. This workflow does not edit or deploy files.\n`;
    writeFileSync('gemini-results/answer.md', markdown, { flag: 'wx' });
    writeFileSync('gemini-results/receipt.json', JSON.stringify({ status: 'GOOGLE_TEXT_RECEIVED', model: answer.model, run: process.env.GITHUB_RUN_ID, created: new Date().toISOString() }, null, 2), { flag: 'wx' });
    if (request.issue) {
      const response = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/issues/${request.issue}/comments`, {
        method: 'POST', headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
        body: JSON.stringify({ body: markdown.slice(0,20000) }), signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error('The answer was saved, but GitHub could not post the reply. Download the answer artifact.');
    }
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
    console.log('Gemini returned text. See the answer artifact.');
  } catch (error) {
    writeFileSync('gemini-results/error.json', JSON.stringify({ status: 'FAILED', message: error.message, created: new Date().toISOString() }, null, 2), { flag: 'wx' });
    throw error;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
