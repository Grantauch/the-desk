const assert = require('node:assert/strict');
const test = require('node:test');
const { classroom, PEOPLE, TEACHER, TEACHER_CONTRACT, setNoSchoolDays } = require('./lib/hall-pass-fixtures.cjs');

const setup = () => classroom({ now: new Date('2026-09-10T11:30:00Z') });
const identify = (c, person = PEOPLE.ada) => {
  c.harness.newRequest();
  c.harness.signInAs(person.email);
  return c.harness.call('identifyCheckInWithPin', c.pin(person), `pet-${Math.random()}`);
};

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
