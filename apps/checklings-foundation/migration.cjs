'use strict';
// Offline migration planner. No network, writes, identity lookup or attendance authority.
const { createHmac } = require('node:crypto');
const FOUNDERS = Object.freeze(['ember', 'bolt', 'mochi', 'zee']);
const HOMES = Object.freeze(['meadow', 'grove', 'cove', 'sky', 'cosmos']);
const MILESTONES = Object.freeze([0, 3, 7, 14, 30]);
const INITIAL_CARE = Object.freeze({nutrition:82, happiness:85, energy:84, cleanliness:88, focus:78});
const insist = (value, message) => { if (!value) throw new Error(message); };

/** All inputs MUST come from a trusted, verified server export, never a browser. */
function planLegacyImport({raw, officialBestStreak, tenantId, membershipId, migrationKey, importedAt, existing = null}) {
  insist(typeof migrationKey === 'string' && Buffer.byteLength(migrationKey) >= 32, 'Private migration key required');
  for (const id of [tenantId, membershipId]) insist(typeof id === 'string' && id.length > 0 && id.length <= 256, 'Verified scope required');
  insist(Number.isSafeInteger(officialBestStreak) && officialBestStreak >= 0, 'Verified official streak required');
  insist(typeof importedAt === 'string' && Number.isFinite(Date.parse(importedAt)) && new Date(importedAt).toISOString() === importedAt, 'Canonical server timestamp required');
  // Structured HMAC input avoids ambiguous concatenation and public hashes of identities.
  const digest = parts => createHmac('sha256', migrationKey).update(JSON.stringify(parts)).digest('hex');
  const sourceSlot = digest(['checkling-v1', tenantId, membershipId]);
  const creatureId = 'ck_' + sourceSlot;
  if (raw === null || raw === undefined) {
    return existing ? {status:'review', reason:'source-missing-after-import', creatureId} : {status:'no-pet'};
  }
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > 9216) return {status:'review', reason:'invalid-source', creatureId};
  let source;
  try { source = JSON.parse(raw); } catch { return {status:'review', reason:'invalid-json', creatureId}; }
  if (!source || source.v !== 1 || !FOUNDERS.includes(source.species) || typeof source.name !== 'string' ||
      !source.name.trim() || source.name.length > 18 || /[\x00-\x1f\x7f]/.test(source.name)) {
    return {status:'review', reason:'invalid-preference', creatureId};
  }
  const fingerprint = digest(['source-v1', raw]);
  if (existing) {
    // Never overwrite a live, renamed, injured, evolved or deceased individual on retry.
    if (existing.id !== creatureId || existing.legacy?.sourceSlot !== sourceSlot || existing.legacy?.sourceFingerprint !== fingerprint) {
      return {status:'review', reason:'import-conflict', creatureId};
    }
    return {status:'already-imported', creatureId};
  }
  const homeIndex = HOMES.indexOf(source.habitat);
  const home = homeIndex >= 0 && officialBestStreak >= MILESTONES[homeIndex] ? source.habitat : 'meadow';
  return {
    status:'ready',
    creature:{
      schemaVersion:2, id:creatureId, speciesId:source.species, nickname:source.name,
      origin:'legacy-import', bornAt:null, importedAt, lifecycle:'alive', revision:0,
      habitatId:home, care:{...INITIAL_CARE}, friendship:0,
      health:{hp:100, maxHp:100, illness:[], injuries:[]},
      development:{level:1, xp:0, evolutionHistory:[]},
      genetics:{parents:[], generation:0, inheritedTraits:[], mutations:[]},
      danger:{state:'safe', warningId:null, activeSeconds:0, rescueActionsRemaining:3},
      legacy:{sourceSlot, sourceFingerprint:fingerprint, officialBestStreakAtImport:officialBestStreak,
        unlockedHabitatIds:HOMES.filter((_, index) => officialBestStreak >= MILESTONES[index]),
        provenance:'official-summary', originalHabitat:typeof source.habitat === 'string' ? source.habitat : null},
    },
    warnings:source.habitat !== undefined && source.habitat !== home ? ['legacy-home-fallback-preserves-source'] : [],
  };
}

/** Reference admission gate, NOT a death simulator or production command handler.
 * A service must derive every argument from persisted facts in one transaction.
 */
function mayCommitDeath({lifecycle, trigger, enabled, warningDelivered, serverEvidence, rescueExhausted, activeCareOpportunity, riskConsent}) {
  if (lifecycle !== 'critical' || enabled !== true || warningDelivered !== true || serverEvidence !== true) return false;
  if (trigger === 'active-neglect') return rescueExhausted === true && activeCareOpportunity === true;
  if (trigger === 'lethal-expedition') return riskConsent === true && activeCareOpportunity === true;
  // Offline time, absence, disconnects, ordinary PvP and client claims cannot kill.
  return false;
}
module.exports = {FOUNDERS, HOMES, MILESTONES, planLegacyImport, mayCommitDeath};
