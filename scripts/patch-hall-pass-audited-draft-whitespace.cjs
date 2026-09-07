const fs = require('node:fs');
const path = require('node:path');

const target = path.join(process.cwd(), 'scripts', 'deploy-hall-pass-apps-script.mjs');
let source = fs.readFileSync(target, 'utf8');

function replaceOnce(from, to, label) {
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  source = source.replace(from, to);
}

replaceOnce(
`const AUDITED_OLD_OVERDUE_COPY = "\`${'${late}'} ${'${late === 1 ? \'pass needs\' : \'passes need\'}'} a check\`";
const AUDITED_NEW_OVERDUE_COPY = "\`${'${late}'} overdue ${'${late === 1 ? \'pass\' : \'passes\'}'}\`";`,
`const AUDITED_OLD_OVERDUE_COPY = "\`${'${late}'} ${'${late === 1 ? \'pass needs\' : \'passes need\'}'} a check\`";
const AUDITED_NEW_OVERDUE_COPY = "\`${'${late}'} overdue ${'${late === 1 ? \'pass\' : \'passes\'}'}\`";
const AUDITED_REPOSITORY_FILTER_SEPARATOR = "      };\\n\\n      const filterPassCounts = (term) => {";
const AUDITED_HEAD_FILTER_SEPARATOR = "      };\\n      const filterPassCounts = (term) => {";`,
'add exact audited whitespace constants');

replaceOnce(
`  const reconciled = remoteIndex.replace(AUDITED_OLD_OVERDUE_COPY, AUDITED_NEW_OVERDUE_COPY);
  if (reconciled !== repositoryIndex) {
    return { safe: false, kind: 'UNKNOWN' };
  }

  return {
    safe: true,
    kind: 'AUDITED_OVERDUE_COPY_RECONCILIATION',
    detail: 'Apps Script HEAD matches the tested repository source except for the previously audited overdue-pass wording regression.',
  };`,
`  let reconciled = remoteIndex.replace(AUDITED_OLD_OVERDUE_COPY, AUDITED_NEW_OVERDUE_COPY);
  if (reconciled !== repositoryIndex) {
    const headSeparatorCount = reconciled.split(AUDITED_HEAD_FILTER_SEPARATOR).length - 1;
    const repositorySeparatorCount = repositoryIndex.split(AUDITED_REPOSITORY_FILTER_SEPARATOR).length - 1;
    if (headSeparatorCount !== 1 || repositorySeparatorCount !== 1) {
      return { safe: false, kind: 'UNKNOWN' };
    }
    reconciled = reconciled.replace(AUDITED_HEAD_FILTER_SEPARATOR, AUDITED_REPOSITORY_FILTER_SEPARATOR);
  }
  if (reconciled !== repositoryIndex) {
    return { safe: false, kind: 'UNKNOWN' };
  }

  return {
    safe: true,
    kind: 'AUDITED_EDITOR_DRAFT_RECONCILIATION',
    detail: 'Apps Script HEAD matches the tested repository source after only the previously audited overdue-pass wording correction and, when present, the exact known formatting-only blank-line restoration.',
  };`,
'permit only the exact audited wording plus blank-line reconciliation');

replaceOnce(
`  const auditedClassification = classifyAuditedHead(stagedOldCopy, local);
  if (!auditedClassification.safe || auditedClassification.kind !== 'AUDITED_OVERDUE_COPY_RECONCILIATION') {
    fail('Audited overdue-copy editor draft classification self-test failed.');
  }

  const unknownDraft = local.map((file) => file.name === 'Index'`,
`  const auditedClassification = classifyAuditedHead(stagedOldCopy, local);
  if (!auditedClassification.safe || auditedClassification.kind !== 'AUDITED_EDITOR_DRAFT_RECONCILIATION') {
    fail('Audited overdue-copy editor draft classification self-test failed.');
  }

  const stagedOldCopyAndWhitespace = local.map((file) => file.name === 'Index'
    ? {
        ...file,
        source: file.source
          .replace(AUDITED_NEW_OVERDUE_COPY, AUDITED_OLD_OVERDUE_COPY)
          .replace(AUDITED_REPOSITORY_FILTER_SEPARATOR, AUDITED_HEAD_FILTER_SEPARATOR),
      }
    : { ...file });
  const auditedWhitespaceClassification = classifyAuditedHead(stagedOldCopyAndWhitespace, local);
  if (!auditedWhitespaceClassification.safe || auditedWhitespaceClassification.kind !== 'AUDITED_EDITOR_DRAFT_RECONCILIATION') {
    fail('Audited overdue-copy plus exact whitespace editor draft classification self-test failed.');
  }

  const unknownDraft = local.map((file) => file.name === 'Index'`,
'add exact two-difference self-test');

replaceOnce(
`      fail('Apps Script HEAD contains an unpublished editor change that is neither the exact tested repository source nor the specifically audited overdue-copy draft. Refusing to overwrite it.');`,
`      fail('Apps Script HEAD contains an unpublished editor change that is neither the exact tested repository source nor the specifically audited UI draft. Refusing to overwrite it.');`,
'update refusal description');

replaceOnce(
`        : 'the only editor/repository difference is the specifically audited overdue-pass wording regression, which deploy will replace with tested repository source';`,
`        : 'the editor/repository differences are limited to the specifically audited overdue-pass wording regression and known formatting-only blank line, which deploy will replace with tested repository source';`,
'update successful preflight description');

fs.writeFileSync(target, source, 'utf8');
console.log('Patched Hall Pass deploy bridge to tolerate only the exact audited wording + formatting draft differences.');
