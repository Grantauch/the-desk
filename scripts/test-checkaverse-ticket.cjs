// Check-In prints a bus ticket for the Checkaverse. The game server's own checker must accept it, and the
// ticket must carry no name, email or PIN.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {classroom, PEOPLE} = require('./lib/hall-pass-fixtures.cjs');

const KEY = 'Zk3vQ9mT2xR7pL4wN8bC6dF1gH5jK0sYaEuIoP-_xyz';
let accounts;
test.before(async () => { accounts = await import(path.join(__dirname, '..', 'apps', 'checkaverse', 'accounts.mjs')); });

function setup(options) {
  const c = classroom(options);
  c.loginAs = (person) => {
    c.harness.newRequest(); c.harness.signInAs(person.email);
    const login = c.harness.call('identifyChecklingWithPin', c.pin(person), 'bus-' + Math.random());
    return login.requiresClassSelection ? c.harness.call('selectStudentClass', login.pinToken, c.key(person, 'Period 1'), 'checkling', '').pinToken : login.pinToken;
  };
  c.token = c.loginAs(PEOPLE.ada);
  c.ride = (token = c.token) => { c.harness.newRequest(); c.harness.signInAs(PEOPLE.ada.email); return c.harness.call('getCheckaverseTicket', token); };
  c.props = () => c.harness.sandbox.PropertiesService.getScriptProperties();
  return c;
}
const ticketOf = (ride) => ride.url.split('#t=')[1];
// The harness runs on a fixed school-day clock, so the ticket is checked a minute after it was printed.
const printedAt = (ride) => JSON.parse(Buffer.from(ticketOf(ride).split('.')[0], 'base64url').toString('utf8')).iat;
const check = (ride, key = KEY) => accounts.verifyTicket(key, ticketOf(ride), {species: ['mochi', 'bolt', 'zee', 'ember'], now: printedAt(ride) + 60000});

test('the bus waits for a hatched Checkling and for the teacher to connect the town', () => {
  const c = setup();
  assert.throws(() => c.ride(), /Hatch your Checkling first/);
  c.harness.call('saveCheckling', c.token, 'bolt', 'Sprocket');
  assert.throws(() => c.ride(), /not running yet/);
  for (const token of ['', 'forged']) assert.throws(() => c.ride(token));
});

test('the key moves from the Settings tab into private storage on the first ride', () => {
  const c = setup();
  c.harness.call('saveCheckling', c.token, 'bolt', 'Sprocket');
  c.settings({CHECKAVERSE_TICKET_KEY: KEY});
  const ride = c.ride();
  assert.equal(ride.ok, true);
  assert.match(ride.url, /^https:\/\/game\.grant-desk\.com\/#t=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.equal(c.props().getProperty('CHECKAVERSE_TICKET_KEY'), KEY);
  const row = c.harness.sheet('Settings').records().find((r) => r.Key === 'CHECKAVERSE_TICKET_KEY');
  assert.equal(row.Value, 'Stored privately', 'the key leaves the sheet');
  assert.equal(c.ride().ok, true, 'later rides use the stored key');
});

test('the game server accepts the ticket, and it names no student', () => {
  const c = setup();
  c.harness.call('saveCheckling', c.token, 'bolt', 'Sprocket');
  c.settings({CHECKAVERSE_TICKET_KEY: KEY});
  const before = c.checkIns().length;
  const ride = c.ride();
  const first = check(ride);
  assert.equal(first.ok, true, first.why);
  assert.equal(accounts.verifyTicket(KEY, ticketOf(ride), {species: ['bolt'], now: printedAt(ride) + 2 * 3600000 + 1}).why, 'expired', 'a ticket lasts two hours');
  assert.deepEqual([first.t.partner.species, first.t.partner.nick, first.t.hour, first.t.days, first.t.checkedIn], ['bolt', 'Sprocket', 'Period 1', 0, false]);
  assert.equal(c.checkIns().length, before, 'riding the bus records no attendance');
  const raw = Buffer.from(ticketOf(c.ride()).split('.')[0], 'base64url').toString('utf8');
  for (const secret of ['Ada', 'Byron', 'ada.byron', c.pin(PEOPLE.ada), c.key(PEOPLE.ada, 'Period 1')]) assert.ok(!raw.includes(secret), `${secret} stays in Check-In`);
  assert.equal(check(c.ride(), 'some-other-key-some-other-key-0000').ok, false, 'another key cannot read it as genuine');
});

test('check-ins are counted and the player ID stays the same', () => {
  const c = setup();
  c.harness.call('saveCheckling', c.token, 'zee', 'Quill');
  c.settings({CHECKAVERSE_TICKET_KEY: KEY});
  const first = check(c.ride());
  c.checkIn(PEOPLE.ada, 'Period 1');
  c.token = c.loginAs(PEOPLE.ada);
  const second = check(c.ride());
  assert.equal(second.ok, true, second.why);
  assert.equal(second.t.days, 1);
  assert.equal(second.t.checkedIn, true);
  assert.equal(second.t.pid, first.t.pid, 'the same student in the same class keeps one player');
  const other = setup();
  other.token = other.loginAs(PEOPLE.alan);
  other.harness.call('saveCheckling', other.token, 'mochi', 'Pip');
  other.settings({CHECKAVERSE_TICKET_KEY: KEY});
  other.harness.newRequest(); other.harness.signInAs(PEOPLE.alan.email);
  const alan = check(other.harness.call('getCheckaverseTicket', other.token));
  assert.notEqual(alan.t.pid, first.t.pid, 'different students get different players');
});
