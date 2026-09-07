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
`function assertDeploymentSafety(deployment, deploymentId, expectedAccess, expectedExecuteAs) {
  if (deployment.deploymentId !== deploymentId) fail('Apps Script returned a different deployment ID than requested.');
  const webApp = webAppEntry(deployment);
  if (!webApp) fail('Target deployment is not a web app.');
  if (!String(webApp.webApp.url || '').includes(deploymentId)) fail('Target web-app URL does not contain the expected deployment ID.');
  const config = webApp.webApp.entryPointConfig || {};
  if (config.access !== expectedAccess) {
    fail(\`Target web-app access changed or is unexpected: expected ${'${expectedAccess}'}, got ${'${config.access || \'(missing)\'}'}.\`);
  }
  if (config.executeAs !== expectedExecuteAs) {
    fail(\`Target web-app execution identity changed or is unexpected: expected ${'${expectedExecuteAs}'}, got ${'${config.executeAs || \'(missing)\'}'}.\`);
  }
  return {
    url: webApp.webApp.url,
    access: config.access,
    executeAs: config.executeAs,
  };
}
`,
`function assertDeploymentSafety(deployment, deploymentId, expectedAccess, expectedExecuteAs) {
  if (deployment.deploymentId !== deploymentId) fail('Apps Script returned a different deployment ID than requested.');
  const webApp = webAppEntry(deployment);
  if (!webApp) fail('Target deployment is not a web app.');
  if (!String(webApp.webApp.url || '').includes(deploymentId)) fail('Target web-app URL does not contain the expected deployment ID.');
  const config = webApp.webApp.entryPointConfig || {};
  if (config.access !== expectedAccess) {
    fail(\`Target web-app access changed or is unexpected: expected ${'${expectedAccess}'}, got ${'${config.access || \'(missing)\'}'}.\`);
  }
  if (config.executeAs !== expectedExecuteAs) {
    fail(\`Target web-app execution identity changed or is unexpected: expected ${'${expectedExecuteAs}'}, got ${'${config.executeAs || \'(missing)\'}'}.\`);
  }
  return {
    url: webApp.webApp.url,
    access: config.access,
    executeAs: config.executeAs,
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDeploymentVersion(token, scriptId, deploymentId, expectedVersion, expectedAccess, expectedExecuteAs, expectedUrl, options = {}) {
  const timeoutMs = Number(options.timeoutMs || 30000);
  const pollMs = Number(options.pollMs || 1500);
  const deadline = Date.now() + timeoutMs;
  let lastVersion = null;
  do {
    const deployment = await google(token, \`/projects/${'${encodeURIComponent(scriptId)}'}/deployments/${'${encodeURIComponent(deploymentId)}'}\`);
    const entry = assertDeploymentSafety(deployment, deploymentId, expectedAccess, expectedExecuteAs);
    if (entry.url !== expectedUrl) {
      fail(\`Stable Hall Pass URL changed unexpectedly while waiting for deployment convergence: ${'${expectedUrl}'} -> ${'${entry.url}'}\`);
    }
    lastVersion = Number(deployment?.deploymentConfig?.versionNumber);
    if (lastVersion === expectedVersion) return { deployment, entry };
    if (Date.now() >= deadline) break;
    await delay(pollMs);
  } while (true);
  fail(\`Apps Script deployment did not converge to version ${'${expectedVersion}'} within ${'${timeoutMs}'}ms; last observed version was ${'${Number.isFinite(lastVersion) ? lastVersion : \'unknown\'}'}.\`);
}
`,
'add bounded deployment convergence polling');

replaceOnce(
`async function restoreAfterFailure(token, scriptId, deploymentId, before, evidence) {
  const rollback = { attempted: true, deployment: 'not-needed', head: 'not-needed' };
  try {
    if (before.deploymentMutated) {
      await google(token, \`/projects/${'${encodeURIComponent(scriptId)}'}/deployments/${'${encodeURIComponent(deploymentId)}'}\`, {
        method: 'PUT',
        body: JSON.stringify({ deploymentConfig: before.deployment.deploymentConfig }),
      });
      rollback.deployment = 'restored';
    }
  } catch (error) {
    rollback.deployment = \`FAILED: ${'${error.message}'}\`;
  }`,
`async function restoreAfterFailure(token, scriptId, deploymentId, before, evidence) {
  const rollback = { attempted: true, deployment: 'not-needed', head: 'not-needed' };
  try {
    if (before.deploymentMutated) {
      const priorEntry = assertDeploymentSafety(before.deployment, deploymentId, before.expectedAccess, before.expectedExecuteAs);
      const priorVersion = Number(before.deployment?.deploymentConfig?.versionNumber);
      const restoreResponse = await google(token, \`/projects/${'${encodeURIComponent(scriptId)}'}/deployments/${'${encodeURIComponent(deploymentId)}'}\`, {
        method: 'PUT',
        body: JSON.stringify({ deploymentConfig: before.deployment.deploymentConfig }),
      });
      const restoreEntry = assertDeploymentSafety(restoreResponse, deploymentId, before.expectedAccess, before.expectedExecuteAs);
      if (restoreEntry.url !== priorEntry.url || Number(restoreResponse?.deploymentConfig?.versionNumber) !== priorVersion) {
        fail('Apps Script rollback response did not confirm the original deployment identity/version.');
      }
      await waitForDeploymentVersion(token, scriptId, deploymentId, priorVersion, before.expectedAccess, before.expectedExecuteAs, priorEntry.url);
      rollback.deployment = 'restored';
    }
  } catch (error) {
    rollback.deployment = \`FAILED: ${'${error.message}'}\`;
  }`,
'verify rollback response and convergence');

replaceOnce(
`  const before = { head, deployment, headMutated: false, deploymentMutated: false };`,
`  const before = { head, deployment, expectedAccess, expectedExecuteAs, headMutated: false, deploymentMutated: false };`,
'preserve deployment safety expectations for rollback');

replaceOnce(
`    await google(token, \`/projects/${'${encodedScript}'}/deployments/${'${encodedDeployment}'}\`, {
      method: 'PUT',
      body: JSON.stringify({
        deploymentConfig: {
          scriptId,
          versionNumber,
          manifestFileName: oldConfig.manifestFileName || 'appsscript',
          description,
        },
      }),
    });
    before.deploymentMutated = true;

    const after = await google(token, \`/projects/${'${encodedScript}'}/deployments/${'${encodedDeployment}'}\`);
    const entryAfter = assertDeploymentSafety(after, deploymentId, expectedAccess, expectedExecuteAs);
    if (entryAfter.url !== entryBefore.url) fail(\`Stable Hall Pass URL changed unexpectedly: ${'${entryBefore.url}'} -> ${'${entryAfter.url}'}\`);
    if (Number(after?.deploymentConfig?.versionNumber) !== versionNumber) fail('Deployment did not advance to the newly created Apps Script version.');`,
`    const updateResponse = await google(token, \`/projects/${'${encodedScript}'}/deployments/${'${encodedDeployment}'}\`, {
      method: 'PUT',
      body: JSON.stringify({
        deploymentConfig: {
          scriptId,
          versionNumber,
          manifestFileName: oldConfig.manifestFileName || 'appsscript',
          description,
        },
      }),
    });
    before.deploymentMutated = true;

    const updateEntry = assertDeploymentSafety(updateResponse, deploymentId, expectedAccess, expectedExecuteAs);
    if (updateEntry.url !== entryBefore.url) fail(\`Stable Hall Pass URL changed unexpectedly in update response: ${'${entryBefore.url}'} -> ${'${updateEntry.url}'}\`);
    if (Number(updateResponse?.deploymentConfig?.versionNumber) !== versionNumber) {
      fail(\`Apps Script update response did not confirm version ${'${versionNumber}'}.\`);
    }

    const { deployment: after, entry: entryAfter } = await waitForDeploymentVersion(
      token,
      scriptId,
      deploymentId,
      versionNumber,
      expectedAccess,
      expectedExecuteAs,
      entryBefore.url,
    );`,
'accept authoritative update response then wait for GET convergence');

fs.writeFileSync(target, source, 'utf8');
console.log('Patched Hall Pass deploy bridge to verify Apps Script update responses and wait for bounded deployment convergence.');
