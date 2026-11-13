// Design contracts only. No deployable adapter, runtime validation or database is implied.
export type Id = string;
export type Lifecycle = 'alive' | 'critical' | 'dead';
export type Affinity = 'growth' | 'tide' | 'stone' | 'spark' | 'flame' | 'frost' | 'gale' | 'shade' | 'alloy' | 'cosmic' | 'venom' | 'spirit';
export interface Species {
  id: Id; catalogVersion: number; baseSpeciesId: Id; formId: Id | null;
  ecosystemId: Id; affinity: Affinity[]; name: string;
  silhouette: string; personality: string; ecologicalRole: string;
  signatureAbilityId: Id; moveIds: Id[]; carePreferences: Id[];
  baseStats: {hp:number; offense:number; defense:number; speed:number; focus:number; stamina:number};
  encounterRuleId: Id; evolutionRuleIds: Id[]; breedingRuleId: Id;
  art: {manifestId:Id; status:'planned'|'review'|'approved'};
}
export interface Creature {
  schemaVersion: 2; id: Id; ownerMembershipId: Id; speciesId: Id; nickname: string;
  origin:'legacy-import'|'hatched'|'encounter'; bornAt:string|null; importedAt:string|null;
  lifecycle:Lifecycle; revision:number; habitatId:Id;
  // All care numbers are 0-100: higher is healthier. UI labels explain hunger/exhaustion.
  care:{nutrition:number; happiness:number; energy:number; cleanliness:number; focus:number};
  friendship:number;
  health:{hp:number; maxHp:number; illness:Condition[]; injuries:Condition[]};
  development:{level:number; xp:number; evolutionHistory:{speciesId:Id; eventId:Id; at:string}[]};
  genetics:{parents:Id[]; generation:number; inheritedTraits:Id[]; mutations:Id[]};
  danger:{state:'safe'|'warning'|'rescue'|'critical'; warningId:Id|null; activeSeconds:number; rescueActionsRemaining:number};
  legacy?:{sourceSlot:Id; sourceFingerprint:string; officialBestStreakAtImport:number; unlockedHabitatIds:Id[]; provenance:'official-summary'; originalHabitat:string|null};
}
export interface Condition {id:Id; severity:1|2|3; appliedEventId:Id; treatmentRuleId:Id}
export interface Command {
  commandId:Id; expectedRevision:number; kind:string; targetId:Id;
  payload:Record<string,unknown>; // Strict per-command runtime allowlists required.
}
export interface Session {
  idHash:string; membershipId:Id; classroomId:Id; tenantId:Id;
  authEpoch:number; createdAt:string; idleExpiresAt:string; absoluteExpiresAt:string;
  revokedAt:string|null; // No PIN, Google token or Hall Pass token in the game store.
}
export interface Battle {
  id:Id; rulesVersion:string; status:'invited'|'active'|'settled'|'aborted'; revision:number;
  mode:'pve'|'class-pvp'|'cooperative'; lethal:boolean;
  participants:{membershipId:Id; creatureIds:Id[]; consentEventId:Id|null}[];
  turn:number; activeSeat:number; rngStateRef:Id; terrainId:Id; weatherId:Id;
  units:{creatureId:Id; hp:number; stamina:number; conditionIds:Id[]; cooldowns:Record<Id,number>}[];
  commandEventIds:Id[]; settledEventId:Id|null; pausedAt:string|null;
}
export interface Progression {
  membershipId:Id; revision:number; dust:number; level:number;
  keeperXp:number; battlerXp:number; unlockedHabitatIds:Id[];
  questProgress:Record<Id,number>; achievementIds:Id[];
  officialAttendanceSnapshot:{bestStreak:number; signedEventId:Id; observedAt:string}|null;
}
export interface DeathRecord {
  id:Id; creatureId:Id; eventId:Id; at:string; causeRuleId:Id; rulesVersion:string;
  warningEventIds:Id[]; consentEventId:Id|null; rescueEventIds:Id[];
  snapshot:{nickname:string; speciesId:Id; achievements:Id[]; ancestors:Id[]};
  epitaphTemplateId:Id|null; correctionEventId:Id|null;
}
export interface EncyclopediaEntry {
  membershipId:Id; speciesId:Id; discoveredAt:string|null;
  ownedCreatureIds:Id[]; deceasedCreatureIds:Id[]; evolutionEventIds:Id[]; achievementIds:Id[];
}
export interface LedgerEvent {
  id:Id; tenantId:Id; actorMembershipId:Id; commandId:Id; aggregateId:Id;
  previousRevision:number; nextRevision:number; rulesVersion:string; at:string;
  kind:string; payload:Record<string,unknown>; // Private append-only ledger; project safe views.
}
