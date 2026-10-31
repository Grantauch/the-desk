// Read-only Hermes / AI Team Board preflight. Node 22+, no external packages.
// Input is a sanitized JSON snapshot, never credentials or student data.
import fs from 'node:fs';
const input=process.argv[2];
if (!input) { console.error('Usage: node tools/ai-workforce/preflight.mjs snapshot.json'); process.exit(2); }
let data;
try { data=JSON.parse(fs.readFileSync(input,'utf8')); } catch { console.error('Invalid JSON snapshot'); process.exit(2); }
const tasks=Array.isArray(data.tasks)?data.tasks:[];
const allowed=new Set(['TRIAGE','READY','IN_PROGRESS','IN_REVIEW','DONE','BLOCKED','DEFERRED']);
const seen=new Set(), findings=[];
for (const t of tasks) {
  const id=String(t.taskId??'').trim(), state=String(t.workflowState??'').trim().toUpperCase(), issues=[];
  if (!id) issues.push('MISSING_ID');
  if (seen.has(id)) issues.push('DUPLICATE_ID'); else seen.add(id);
  if (!allowed.has(state)) issues.push('UNKNOWN_STATE');
  if (state==='IN_PROGRESS' && !t.ownerRun) issues.push('MISSING_OWNER_RUN');
  if (state==='IN_REVIEW' && !t.reviewerRun) issues.push('MISSING_REVIEWER_RUN');
  if (t.ownerRun && t.reviewerRun && t.ownerRun===t.reviewerRun) issues.push('SELF_REVIEW');
  if (state==='DONE' && !t.independentReviewAccepted) issues.push('UNACCEPTED_DONE');
  if (state==='READY') issues.push('NO_DISPATCH_AUTHORITY_FROM_SNAPSHOT');
  if (t.claimUntil) {
    const c=String(t.claimUntil);
    if (!/T\d\d:\d\d(?::\d\d)?(?:Z|[+-]\d\d:\d\d)$/.test(c) || !Number.isFinite(Date.parse(c)))
      issues.push('UNVERIFIABLE_LEASE');
    else if (Date.parse(c)<=Date.now()) issues.push('EXPIRED_CLAIM_CONFIRM_OWNER');
  }
  if (issues.length) findings.push({taskId:id,issues});
}
console.log(JSON.stringify({mode:'READ_ONLY',dispatchAuthorized:false,taskCount:tasks.length,findings},null,2));
process.exitCode=findings.length?1:0;
