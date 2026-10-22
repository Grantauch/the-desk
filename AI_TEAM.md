# Shared project brief for Grant's assistants

Grant is the owner. This is the public project handoff for the desk. Private daily work belongs in Grant's local AI Village outside this repository.

## Start every task

1. Read AGENTS.md, CLAUDE.md, and the relevant project instructions.
2. Read current source, open pull requests, and the task handoff. Chat history is not shared automatically among Gemini, Claude, Muse/Meta, or personal and work GPT accounts.
3. Name one task owner. Use an isolated branch and list files being edited. Do not edit another assistant's active files without coordinating with Grant.
4. Preserve originals and unrelated work. Keep student work, grades, roster data, credentials, private local paths, and teacher keys out of GitHub and prompts to this helper.

## Finish every task with a handoff

- Task and owner
- Result and exact deliverable path or URL
- Branch, commit, and pull request
- Checks actually run and results
- Deployment evidence, if separately verified
- Next action, owner, and blocker

Draft, tested, merged, deployed, and classroom-verified are separate states. Do not claim other assistants received a handoff unless delivery was confirmed.

## Gemini entry points

- For Grant's individual Pro account, use Google's Antigravity coding client and sign in with Google. Google ended individual Pro access through the older Gemini CLI on June 18, 2026; it remains a separate API/enterprise path. Work in an isolated checkout.
- GitHub: the owner comments `@gemini ` followed by a task on an issue or PR, or runs Gemini Assistant manually in Actions. It reads a small explicit set of public files, returns a draft, and cannot execute commands or edit the repository.
- Netlify: `/api/gemini` accepts bounded POST JSON with a private bearer token and a per-IP/domain request limit. It has no GitHub or Netlify management tools. Never put the token in a webpage.
- API requests use their own quota. `GEMINI_MODEL` is configurable; default `gemini-flash-latest`. Errors are reported as errors.
