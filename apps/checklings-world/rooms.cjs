'use strict';
// Authenticated 2-4 student raid protocol; no socket or DB adapter is installed.
// All methods expect a server-side verifier. An actual deployment must provide
// an atomic durable room store and a teacher-controlled class feature flag.
const { randomBytes, createHash } = require('node:crypto');
const MAX_MEMBERS = 4;
const TTL_MS = 30 * 60 * 1000;
const MOVES = Object.freeze(['strike', 'guard', 'encourage']);
const MAX_JOURNAL_ENTRIES = 32; // transient UI history, not an authoritative event ledger
function insist(value, msg) { if (!value) throw new Error(msg); }
function codeHash(code) { return createHash('sha256').update(code).digest('hex'); }
function memberView(room, actor) {
  return {
    status: room.status, revision: room.revision, expiresAt: room.expiresAt,
    maxMembers: MAX_MEMBERS, activeSeat: room.activeSeat,
    boss: { hp: room.boss.hp, maxHp: room.boss.maxHp, phase: room.boss.phase },
    seats: room.seats.map((seat, position) => ({
      seat: position + 1, label: 'Explorer ' + (position + 1), species: seat.species,
      ready: seat.ready, hp: seat.hp, guarding: seat.guarding,
      mine: seat.id === actor.key
    })),
    journal: room.journal.slice(-8).map(e => ({ ...e }))
  };
}
function createRaidService({ authorize, isEnabled, store, now = Date.now, random = randomBytes }) {
  insist(typeof authorize === 'function' && typeof isEnabled === 'function' && store &&
    typeof store.create === 'function' && typeof store.transact === 'function' && typeof store.load === 'function', 'Missing secure room dependencies');
  async function actor(session) {
    const a = await authorize(session);
    insist(a && typeof a.key === 'string' && typeof a.classKey === 'string', 'Unauthorized');
    insist(await isEnabled(a.classKey), 'Classroom raids are not enabled');
    return a;
  }
  function validCode(code) {
    insist(typeof code === 'string' && /^CHK-[A-F0-9]{20}$/.test(code), 'Invalid invite');
    return codeHash(code);
  }
  function inspect(room, a) {
    insist(room && room.classKey === a.classKey, 'Room not found');
    insist(now() <= room.expiresAt && room.status !== 'closed', 'Room expired');
    insist(room.seats.some(s => s.id === a.key), 'Not a participant');
  }
  async function mutate(session, invite, expectedRevision, edit) {
    const a = await actor(session), key = validCode(invite);
    insist(Number.isSafeInteger(expectedRevision) && expectedRevision >= 0, 'Invalid revision');
    return store.transact(key, room => {
      inspect(room, a);
      insist(room.revision === expectedRevision, 'Stale room action');
      const result = edit(room, a);
      room.revision++;
      return { room, result: { result, room: memberView(room, a) } };
    });
  }
  return {
    async create(session, species) {
      const a = await actor(session);
      insist(['ember', 'bolt', 'mochi', 'zee'].includes(species), 'Invalid species');
      let code;
      for (let tries = 0; tries < 4; tries++) {
        code = 'CHK-' + random(10).toString('hex').toUpperCase();
        const room = {
          v: 1, classKey: a.classKey, created: now(), expiresAt: now() + TTL_MS,
          status: 'lobby', revision: 0, activeSeat: 0,
          seats: [{ id: a.key, species, ready: false, hp: 100, guarding: false }],
          boss: { hp: 240, maxHp: 240, phase: 1 }, journal: []
        };
        if (await store.create(codeHash(code), room)) return { invite: code, room: memberView(room, a) };
      }
      throw new Error('Could not create a unique invite');
    },
    async join(session, invite, species) {
      const a = await actor(session);
      insist(['ember', 'bolt', 'mochi', 'zee'].includes(species), 'Invalid species');
      const key = validCode(invite);
      return store.transact(key, room => {
        insist(room && room.classKey === a.classKey, 'Room not found');
        insist(now() <= room.expiresAt && room.status === 'lobby', 'Lobby closed');
        const existing = room.seats.find(s => s.id === a.key);
        if (!existing) {
          insist(room.seats.length < MAX_MEMBERS, 'Raid is full');
          room.seats.push({ id: a.key, species, ready: false, hp: 100, guarding: false });
          room.revision++;
        }
        return { room, result: { joined: !existing, room: memberView(room, a) } };
      });
    },
    async view(session, invite) {
      const a = await actor(session), room = await store.load(validCode(invite));
      inspect(room, a);
      return memberView(room, a);
    },
    ready(session, invite, revision) {
      return mutate(session, invite, revision, (room, a) => {
        insist(room.status === 'lobby', 'Already started');
        room.seats.find(s => s.id === a.key).ready = true;
        if (room.seats.length >= 2 && room.seats.every(s => s.ready)) room.status = 'battle';
        return { ready: true, started: room.status === 'battle' };
      });
    },
    move(session, invite, revision, move) {
      return mutate(session, invite, revision, (room, a) => {
        insist(MOVES.includes(move), 'Invalid move');
        insist(room.status === 'battle', 'Not in battle');
        const seat = room.seats[room.activeSeat];
        insist(seat && seat.id === a.key && seat.hp > 0, 'Not your turn');
        if (move === 'strike') room.boss.hp = Math.max(0, room.boss.hp - 22);
        else if (move === 'guard') seat.guarding = true;
        else for (const friend of room.seats) if (friend.hp > 0) friend.hp = Math.min(100, friend.hp + 8);
        room.journal.push({ seat: room.activeSeat + 1, move });
        if (room.journal.length > MAX_JOURNAL_ENTRIES) room.journal.splice(0,room.journal.length - MAX_JOURNAL_ENTRIES);
        if (room.boss.hp === 0) { room.status = 'victory'; return { victory: true }; }
        room.boss.phase = room.boss.hp <= 80 ? 3 : room.boss.hp <= 160 ? 2 : 1;
        // Dead seats do not receive turns. Otherwise a KO in seat 1 can leave
        // the only surviving teammate unable to act for the rest of the raid.
        const actingSeat = room.activeSeat;
        let nextSeat = -1;
        for (let offset = 1; offset <= room.seats.length; offset++) {
          const candidate = (actingSeat + offset) % room.seats.length;
          if (room.seats[candidate].hp > 0) { nextSeat = candidate; break; }
        }
        insist(nextSeat !== -1, 'No active teammate');
        const roundComplete = nextSeat <= actingSeat;
        room.activeSeat = nextSeat;
        // Resolve one boss turn after the last living teammate, even when a
        // knockout caused the seat rotation to skip seat zero.
        if (roundComplete) {
          for (const friend of room.seats) {
            if (friend.hp > 0) friend.hp = Math.max(0, friend.hp - (friend.guarding ? 3 : 10));
            friend.guarding = false;
          }
          if (room.seats.every(s => s.hp === 0)) room.status = 'defeat';
          else room.activeSeat = room.seats.findIndex(s => s.hp > 0);
        }
        return { victory: false, phase: room.boss.phase };
      });
    }
  };
}
module.exports = { createRaidService, MAX_MEMBERS, TTL_MS, MOVES };
