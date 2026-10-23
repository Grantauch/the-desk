const assert = require('node:assert/strict');
const test = require('node:test');
const { classroom, PEOPLE, TEACHER, TEACHER_CONTRACT, setNoSchoolDays } = require('./lib/hall-pass-fixtures.cjs');

const setup = () => classroom({ now: new Date('2026-09-10T11:30:00Z') });
const identify = (c, person = PEOPLE.ada) => {
  c.harness.newRequest();
  c.harness.signInAs(person.email);
  return c.harness.call('identifyCheckInWithPin', c.pin(person), `pet-${Math.random()}`);
};

test('companion-only PIN visits work after hours, on weekends and without a configured period', () => {
  for (const now of ['2026-09-10T23:30:00Z', '2026-09-12T16:00:00Z']) {
    const c = classroom({now:new Date(now), memberships:[[PEOPLE.ada,'Period 8 — Synthetic demo']]});
    const visit = c.harness.call('identifyChecklingWithPin',c.pin(PEOPLE.ada),'visit-only');
    assert.equal(visit.checkedIn,false);
    assert.equal(visit.sessionEligibility.allowed,false);
    assert.equal(visit.actionProof,undefined);
    assert.equal(visit.authorizedAction,undefined);
    const saved = c.harness.call('saveCheckling',visit.pinToken,'bolt','Demo friend');
    assert.equal(saved.checkling.pet.name,'Demo friend');
    assert.equal(c.checkIns().length,0);
    assert.equal(c.passLog().length,0);
    assert.throws(()=>c.harness.call('authorizeAndActStudent','identify-checkin',c.pin(PEOPLE.ada),'','','normal-checkin'));
    assert.throws(()=>c.harness.call('submitDailyCheckIn',visit.pinToken,visit.student.key,visit.pinToken));
    assert.equal(c.checkIns().length,0);
  }
});

test('companion-only class selection is PIN-verified and confined to the same student', () => {
  const c = classroom({now:new Date('2026-09-12T16:00:00Z'),memberships:[
    [PEOPLE.ada,'Period 1'],[PEOPLE.ada,'Period 8'],[PEOPLE.alan,'Period 1']]});
  const visit = c.harness.call('identifyChecklingWithPin',c.pin(PEOPLE.ada),'choose-pet');
  assert.equal(visit.requiresClassSelection,true);
  assert.equal(visit.purpose,'checkling');
  assert.equal(visit.actionProof,undefined);
  const ownKey = c.key(PEOPLE.ada,'Period 8');
  const selected = c.harness.call('selectStudentClass',visit.pinToken,ownKey,'checkling','');
  assert.equal(selected.student.key,ownKey);
  assert.equal(selected.checkling.available,true);
  assert.throws(()=>c.harness.call('selectStudentClass',visit.pinToken,c.key(PEOPLE.alan,'Period 1'),'checkling',''));
  const google = c.harness.call('createClassSelectionState_',c.harness.call('getStudentsByEmail_',PEOPLE.ada.email),'google','checkin');
  assert.throws(()=>c.harness.call('selectStudentClass',google.pinToken,ownKey,'checkling',''),/Enter your PIN/);
  assert.equal(c.checkIns().length,0);
});

test('companion visits retain school-account and invalid-PIN checks', () => {
  const c = setup();
  assert.throws(()=>c.harness.call('identifyChecklingWithPin','not-a-pin','bad-pet'),/six-digit PIN/);
  c.harness.signInAs('outsider@example.org');
  assert.throws(()=>c.harness.call('identifyChecklingWithPin',c.pin(PEOPLE.ada),'foreign-pet'));
  assert.equal(c.checkIns().length,0);
});

test('a recognized student can adopt without recording attendance or a point', () => {
  const c = setup();
  const before = identify(c);
  assert.equal(before.checkling.pet, null);
  const state = c.harness.call('saveCheckling', before.pinToken, 'ember', '  Small   Dragon  ');
  assert.equal(state.checkling.pet.name, 'Small Dragon');
  assert.equal(state.checkling.pet.species, 'ember');
  assert.equal(state.checkedIn, false);
  assert.equal(c.checkIns().length, 0);
  assert.equal(c.passLog().length, 0);
});

test('a new verified login on another device receives the same friend', () => {
  const c = setup();
  c.harness.call('saveCheckling', identify(c).pinToken, 'bolt', 'Sprocket');
  assert.equal(identify(c).checkling.pet.name, 'Sprocket');
  assert.equal(identify(c, PEOPLE.alan).checkling.pet, null);
});

test('an unauthenticated caller cannot adopt for somebody else', () => {
  const c = setup();
  c.harness.signInAs('outsider@example.org');
  assert.throws(() => c.harness.call('saveCheckling', '', 'mochi', 'Mochi'));
  assert.throws(() => c.harness.call('saveCheckling', 'forged-token', 'mochi', 'Mochi'));
});

test('invalid material, empty name and non-string input cannot be stored', () => {
  const c = setup();
  const token = identify(c).pinToken;
  for (const [species, name] of [['../../other', 'Name'], ['mochi', '  '], ['bolt', {}]]) {
    assert.throws(() => c.harness.call('saveCheckling', token, species, name));
  }
  assert.equal(identify(c).checkling.pet, null);
});

test('a recorded daily check-in cares for the pet; repeats never duplicate points', () => {
  const c = setup();
  c.harness.call('saveCheckling', identify(c).pinToken, 'mochi', 'Mochi');
  const first = c.checkIn(PEOPLE.ada, 'Period 1').state;
  assert.equal(first.checkling.visitedToday, true);
  assert.equal(first.checkling.countedToday, true);
  assert.equal(first.checkling.bestStreak, 1);
  const again = c.checkIn(PEOPLE.ada, 'Period 1').state;
  assert.equal(again.checkling.bestStreak, 1);
  assert.equal(c.checkIns().length, 1);
  assert.equal(c.checkIns()[0].Point, 1);
});

test('stage follows the official best school-day streak and survives a missed school day', () => {
  const c = classroom({now:new Date('2026-09-08T11:30:00Z')});
  c.harness.call('saveCheckling', identify(c).pinToken, 'zee', 'Zee');
  for (const day of ['08', '09', '10']) {
    c.harness.clock.set(new Date(`2026-09-${day}T11:30:00Z`));
    c.checkIn(PEOPLE.ada, 'Period 1');
  }
  assert.equal(identify(c).checkling.stage, 'Sprout');
  c.harness.clock.set(new Date('2026-09-14T11:30:00Z'));
  const resumed = c.checkIn(PEOPLE.ada, 'Period 1').state;
  assert.equal(resumed.streak.current, 1);
  assert.equal(resumed.checkling.stage, 'Sprout');
});

test('weekends and official closures protect pet progression with the official streak', () => {
  const c = setup();
  c.checkIn(PEOPLE.ada, 'Period 1');
  setNoSchoolDays(c.harness, ['2026-09-11']);
  c.harness.clock.set(new Date('2026-09-12T11:30:00Z'));
  c.harness.newRequest();
  const weekend = c.harness.call('getCheckInState_', c.harness.call('getStudentByKey_', c.key(PEOPLE.ada, 'Period 1')), '', 'pin');
  assert.equal(weekend.checkling.protectedDay, true);
  assert.equal(weekend.checkling.bestStreak, 1);
  c.harness.clock.set(new Date('2026-09-14T11:30:00Z'));
  assert.equal(c.checkIn(PEOPLE.ada, 'Period 1').state.checkling.bestStreak, 2);
});

test('late attendance never becomes an automatic point through the pet', () => {
  const c = classroom({now:new Date('2026-09-10T11:50:00Z')});
  const token = identify(c).pinToken;
  c.harness.call('saveCheckling', token, 'bolt', 'Bolt');
  const state = c.checkIn(PEOPLE.ada, 'Period 1').state;
  assert.equal(state.checkling.visitedToday, true);
  assert.equal(state.checkling.countedToday, false);
  assert.equal(state.checkling.bestStreak, 0);
  assert.equal(state.checkIn.point, 0);
  c.harness.call('saveCheckling', state.pinToken, 'zee', 'Changed');
  assert.equal(c.checkIns()[0].Point, 0);
});

test('a corrupt preference can be replaced without breaking attendance', () => {
  const c = setup();
  const state = identify(c);
  c.harness.properties.setProperty(`checkling-v1:${state.student.key}`, '{broken');
  assert.equal(identify(c).checkling.pet, null);
  assert.equal(c.checkIn(PEOPLE.ada, 'Period 1').state.checkedIn, true);
  assert.equal(c.harness.call('saveCheckling', identify(c).pinToken, 'mochi', 'Recovered').checkling.pet.name, 'Recovered');
});

test('teacher approval of a late point updates the companion through the official summary', () => {
  const c = classroom({now:new Date('2026-09-10T11:50:00Z')});
  c.checkIn(PEOPLE.ada, 'Period 1');
  assert.equal(identify(c).checkling.countedToday, false);
  c.harness.newRequest();
  c.harness.signInAs(TEACHER);
  c.harness.call('teacherReviewLateCheckIn', String(c.checkIns()[0]['Check-in ID']), 'AWARD_POINT', TEACHER_CONTRACT);
  const next = identify(c);
  assert.equal(next.checkling.countedToday, true);
  assert.equal(next.checkling.bestStreak, 1);
  assert.equal(next.checkIn.point, 1);
  assert.equal(c.checkIns().length, 1);
});

test('a preference read failure does not hide a successful official check-in', () => {
  const c = setup();
  const original = c.harness.properties.getProperty.bind(c.harness.properties);
  c.harness.properties.getProperty = (key) => {
    if (String(key).startsWith('checkling-v1:')) throw new Error('Synthetic pet storage outage');
    return original(key);
  };
  const state = c.checkIn(PEOPLE.ada, 'Period 1').state;
  assert.equal(state.checkedIn, true);
  assert.equal(state.checkIn.point, 1);
  assert.equal(state.checkling.available, false);
});

test('student switching on one Chromebook receives only that student’s pet', () => {
  const c = setup();
  c.harness.call('saveCheckling', identify(c).pinToken, 'ember', 'AdaFriend');
  const alan = identify(c, PEOPLE.alan);
  const saved = c.harness.call('saveCheckling', alan.pinToken, 'bolt', 'AlanFriend');
  assert.equal(saved.student.name, PEOPLE.alan.name);
  assert.equal(saved.checkling.pet.name, 'AlanFriend');
  assert.equal(identify(c).checkling.pet.name, 'AdaFriend');
});

test('habitats and keepsakes unlock only from the official best streak', () => {
  const c = classroom({now:new Date('2026-09-08T11:30:00Z')});
  const initial = identify(c);
  assert.deepEqual(Array.from(initial.checkling.journey, entry => entry.min), [0,3,7,14,30]);
  assert.equal(initial.checkling.journey.filter(entry => entry.unlocked).length,1);
  assert.throws(() => c.harness.call('saveCheckling',initial.pinToken,'mochi','Mochi','cosmos'), /official school-day/);
  for (const day of ['08','09','10']) {
    c.harness.clock.set(new Date(`2026-09-${day}T11:30:00Z`));
    c.checkIn(PEOPLE.ada,'Period 1');
  }
  const saved = c.harness.call('saveCheckling',identify(c).pinToken,'mochi','Mochi','grove');
  assert.equal(saved.checkling.pet.habitat,'grove');
  const renamed=c.harness.call('saveCheckling',identify(c).pinToken,'mochi','Renamed');
  assert.equal(renamed.checkling.pet.habitat,'grove','An older three-argument client preserves an earned home');
  assert.equal(saved.checkling.journey.filter(entry => entry.unlocked).length,2);
  assert.equal(c.checkIns().length,3);
  assert.equal(c.checkIns().reduce((sum,row)=>sum+row.Point,0),3);
  c.harness.clock.set(new Date('2026-09-14T11:30:00Z'));
  c.checkIn(PEOPLE.ada,'Period 1');
  const afterMiss = identify(c);
  assert.equal(afterMiss.streak.current,1);
  assert.equal(afterMiss.checkling.pet.habitat,'grove');
  assert.equal(afterMiss.checkling.journey[1].unlocked,true);
});

test('legacy preferences and three-argument clients preserve the saved home', () => {
  const c = setup(); const state=identify(c);
  c.harness.properties.setProperty(`checkling-v1:${state.student.key}`,JSON.stringify({v:1,species:'bolt',name:'Original'}));
  assert.equal(identify(c).checkling.pet.habitat,'meadow');
  const changed=c.harness.call('saveCheckling',identify(c).pinToken,'bolt','New name');
  assert.equal(changed.checkling.pet.habitat,'meadow');
  assert.equal(changed.checkling.pet.name,'New name');
  const raw=c.harness.properties.getProperty(`checkling-v1:${state.student.key}`);
  assert.ok(raw.length<256,'Preferences remain bounded, without game history');
  assert.equal(c.checkIns().length,0);
});

test('unknown or locked home selections cannot overwrite a saved friend', () => {
  const c=setup();const token=identify(c).pinToken;
  c.harness.call('saveCheckling',token,'ember','Dragon','meadow');
  for(const home of ['../../other','cosmos',null,{},['meadow']]) {
    assert.throws(()=>c.harness.call('saveCheckling',token,'zee','Changed',home));
  }
  const saved=identify(c).checkling.pet;
  assert.equal(saved.name,'Dragon'); assert.equal(saved.species,'ember'); assert.equal(saved.habitat,'meadow');
  assert.equal(identify(c,PEOPLE.alan).checkling.pet,null);
});

test('a corrupt or prematurely selected habitat falls back without losing the pet', () => {
  const c=setup();const state=identify(c);
  for(const habitat of ['cosmos','unknown']) {
    c.harness.properties.setProperty(`checkling-v1:${state.student.key}`,JSON.stringify({v:1,species:'zee',name:'Comet',habitat}));
    const next=identify(c);
    assert.equal(next.checkling.pet.name,'Comet'); assert.equal(next.checkling.pet.habitat,'meadow');
  }
});

test('all five homes follow the server summary milestones, including Legend', () => {
  const c=setup();const state=identify(c);
  const student=c.harness.call('getStudentByKey_',state.student.key);
  for(const [best,habitat,count] of [[0,'meadow',1],[3,'grove',2],[7,'cove',3],[14,'sky',4],[30,'cosmos',5]]) {
    c.harness.properties.setProperty(`checkling-v1:${state.student.key}`,JSON.stringify({v:1,species:'ember',name:'Dragon',habitat}));
    const view=c.harness.call('getChecklingState_',student,{best,current:best,lastCountedDate:'2026-09-10'},{},'2026-09-10');
    assert.equal(view.pet.habitat,habitat);
    assert.equal(view.journey.filter(entry=>entry.unlocked).length,count);
  }
  assert.equal(c.checkIns().length,0,'Reading historical progress writes no attendance');
});
