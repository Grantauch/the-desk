const test = require('node:test');
const assert = require('node:assert/strict');
const {classroom,PEOPLE} = require('./lib/hall-pass-fixtures.cjs');
require('../public/hubs/checkling/camp/engine.js');
const E = globalThis.FirstTrail;
const plain = x => JSON.parse(JSON.stringify(x));
function setup(options) {
  const c = classroom({now:new Date('2026-09-10T11:30:00Z'),...options});
  c.harness.signInAs(PEOPLE.ada.email);
  c.login = (person=PEOPLE.ada) => {
    c.harness.newRequest(); c.harness.signInAs(person.email);
    return c.harness.call('identifyChecklingWithPin',c.pin(person),'camp-'+Math.random());
  };
  const login=c.login();
  c.token = login.requiresClassSelection ? c.harness.call('selectStudentClass',login.pinToken,c.key(PEOPLE.ada,'Period 1'),'checkling','').pinToken : login.pinToken;
  c.harness.call('saveCheckling',c.token,'bolt','Sprocket');
  c.load = (token=c.token) => c.harness.call('getPixelCamp',token);
  c.save = (camp,rev=0,id='a'.repeat(32),token=c.token) => c.harness.call('savePixelCamp',token,rev,id,camp);
  return c;
}
test('existing companion, exact name and official school progress enter the game without attendance', () => {
  const c=setup(); const saved=c.load();
  assert.equal(saved.founder,'bolt'); assert.equal(saved.camp.selected,'bolt');
  assert.equal(saved.camp.pets.bolt.nickname,'Sprocket');
  assert.equal(saved.school.checkedIn,false); assert.equal(saved.school.streak.best,0);
  c.save(E.dispatch(saved.camp,{type:'discover'}).state);
  assert.equal(c.checkIns().length,0);assert.equal(c.passLog().length,0);
  assert.equal(c.login().checkling.pet.name,'Sprocket');
});
test('camp persists across fresh PIN sessions and other students remain isolated', () => {
  const c=setup();const camp=E.dispatch(c.load().camp,{type:'discover'}).state;
  c.save(camp);assert.deepEqual(plain(c.load(c.login().pinToken).camp),plain(camp));
  const other=c.login(PEOPLE.alan).pinToken;
  c.harness.call('saveCheckling',other,'zee','Other');
  assert.equal(c.load(other).camp.pets.bolt.discoveries.length,0);
  assert.equal(c.load(other).founder,'zee');
});
test('one shared PIN keeps different classes and their original pets separate', () => {
  const c=setup({memberships:[[PEOPLE.ada,'Period 1'],[PEOPLE.ada,'Period 2']]});
  c.save(E.dispatch(c.load().camp,{type:'discover'}).state);
  const login=c.login();
  const other=c.harness.call('selectStudentClass',login.pinToken,c.key(PEOPLE.ada,'Period 2'),'checkling','').pinToken;
  c.harness.call('saveCheckling',other,'ember','Class two');
  assert.equal(c.load(other).camp.pets.bolt.discoveries.length,0);
  assert.equal(c.load(other).founder,'ember');
  assert.equal(c.load().camp.pets.bolt.discoveries.length,1);
});
test('stale writes fail and a lost response can be retried idempotently', () => {
  const c=setup();const camp=E.dispatch(c.load().camp,{type:'discover'}).state;
  assert.equal(c.save(camp).revision,1);
  assert.equal(c.save(camp).revision,1,'same mutation does not double-commit');
  assert.throws(()=>c.save(E.initial(),0,'b'.repeat(32)),/another screen/);
  assert.equal(c.load().camp.pets.bolt.discoveries.length,1);
  c.save(E.dispatch(camp,{type:'play'}).state,1,'c'.repeat(32));
  const rows=c.harness.sheet('Checkling Camps').records();
  assert.equal(JSON.parse(rows[0]['Previous Camp JSON']).pets.bolt.discoveries.length,1);
});
test('imports cannot replace the original companion, earned sky home or official progress', () => {
  const c=setup();const login=c.login();
  c.harness.properties.setProperty('checkling-v1:'+login.student.key,JSON.stringify({v:1,species:'bolt',name:'Sprocket',habitat:'sky'}));
  // Supply historical official summary through the existing read-only helper.
  const camp=c.load().camp;camp.pets.bolt.nickname='Forged';camp.bestStreak=999;camp.points=999;camp.studentKey='other';
  const saved=c.save(camp);
  assert.equal(saved.camp.pets.bolt.nickname,'Sprocket');
  assert.equal(saved.school.companion.bestStreak,0);
  assert.equal(saved.camp.studentKey,undefined);assert.equal(saved.camp.points,undefined);
  assert.equal(JSON.parse(c.harness.properties.getProperty('checkling-v1:'+login.student.key)).habitat,'sky','stored original home is never rewritten by camp');
  assert.throws(()=>c.harness.call('saveCheckling',c.token,'ember','Replacement'),/original camp companion/);
  c.harness.call('saveCheckling',c.token,'bolt','Renamed');
  assert.equal(c.load().camp.pets.bolt.nickname,'Renamed');
});
test('official check-in and late teacher review remain the only source of points', () => {
  const c=setup({now:new Date('2026-09-10T11:50:00Z')});
  c.checkIn(PEOPLE.ada,'Period 1');c.harness.newRequest();
  const camp=c.load();assert.equal(camp.school.checkedIn,true);assert.equal(camp.school.companion.countedToday,false);
  c.save(camp.camp);assert.equal(c.checkIns()[0].Point,0);assert.equal(c.checkIns().length,1);
});
test('unverified, forged, expired and inactive identities cannot read or save camps', () => {
  const c=setup();const camp=c.load().camp;
  for(const token of ['', 'forged']) {assert.throws(()=>c.load(token));assert.throws(()=>c.save(camp,0,'a'.repeat(32),token));}
  c.harness.clock.set(new Date('2026-09-10T13:31:00Z'));c.harness.newRequest();
  assert.throws(()=>c.load());assert.throws(()=>c.save(camp));
  const active=setup();const student=active.login().student;
  const roster=active.harness.sheet('Roster');
  const record=active.harness.call('getStudentByKey_',student.key);
  roster.getRange(record.row,5).setValue(false);active.harness.newRequest();
  assert.throws(()=>active.load());assert.throws(()=>active.save(camp));
});
test('invalid payloads and damaged storage cannot overwrite a valid camp', () => {
  const c=setup();const camp=c.load().camp;c.save(camp);
  for(const invalid of [null,{}, {...camp,version:3}, {...camp,pets:{}}, {...camp,extra:'x'.repeat(40001)}]) assert.throws(()=>c.save(invalid,1,'b'.repeat(32)));
  assert.equal(c.load().revision,1);
  c.harness.sheet('Checkling Camps').getRange(1,2).setValue('Wrong header');
  assert.throws(()=>c.load(),/teacher review/);assert.throws(()=>c.save(camp,1,'b'.repeat(32)),/teacher review/);
});
test('the server sanitizer matches the portable engine for bounded save fields', () => {
  const c=setup();const raw=E.initial();
  raw.selected='bad';raw.stop=99;raw.weather='snow';raw.pets.mochi.food=-8;raw.pets.zee.memories=[{id:'x',text:'hello'},{id:5,text:'bad'}];raw.pets.ember.discoveries=[0,0,2,4];raw.decor=['planter','__proto__','constructor'];
  assert.deepEqual(plain(c.harness.call('sanitizePixelCamp_',raw)),E.hydrate(raw));
});

/* Pixel Camp 5: version 2 camps and the version 1 bridge. */
function fiveCamp(base) {
  let s = E.hydrate(base);
  for (const stop of [0, 1, 2]) { s = E.dispatch(s, {type:'stop', value:stop}).state; s = E.dispatch(s, {type:'forage', day:'2026-09-10'}).state; s = E.dispatch(s, {type:'rest'}).state; }
  s.pets.bolt.battles = 0;
  s = E.dispatch(s, {type:'battle-win', tier:1}).state; s = E.dispatch(s, {type:'battle-win', tier:2}).state;
  return s;
}
test('the school advertises version 2 and stores ladder badges, curios and the forage day', () => {
  const c=setup(); const first=c.load();
  assert.deepEqual(plain(first.formats),[1,2]);
  const camp=fiveCamp(first.camp); assert.equal(camp.version,2);
  assert.equal(camp.pets.bolt.battles,2); assert.equal(camp.curios.length>0,true); assert.deepEqual(camp.forage,{day:'2026-09-10',taken:[0,1,2]});
  const saved=c.save(camp);
  assert.deepEqual(plain(saved.camp),plain(E.hydrate(camp)));
  const again=c.load(c.login().pinToken);
  assert.equal(again.camp.version,2); assert.equal(again.camp.pets.bolt.battles,2);
  assert.deepEqual(plain(again.camp.curios),camp.curios); assert.deepEqual(plain(again.camp.forage.taken),[0,1,2]);
  assert.equal(c.checkIns().length,0,'playing still records no attendance');
});
test('a version 1 camp stays version 1 so a 4.x page can still open it', () => {
  const c=setup(); const v1=E.toV1(E.dispatch(c.load().camp,{type:'discover'}).state);
  assert.equal(v1.version,1); assert.equal('curios' in v1,false);
  c.save(v1);
  const loaded=c.load().camp; assert.equal(loaded.version,1); assert.equal('curios' in loaded,false); assert.equal('forage' in loaded,false);
  const forged=plain(v1); forged.pets.bolt.battles=3; forged.decor=['shelf']; forged.curios=['key'];
  const saved=c.save(forged,1,'d'.repeat(32)).camp;
  assert.equal(saved.pets.bolt.battles,1); assert.deepEqual(plain(saved.decor),[]); assert.equal('curios' in saved,false);
});
test('version 2 fields are bounded on the server exactly like the portable engine', () => {
  const c=setup(); const raw=E.initial();
  raw.pets.mochi.battles=9; raw.pets.zee.battles=-2; raw.pets.bolt.battles=2.4;
  raw.curios=['key','key','dragon','__proto__','starbottle',7]; raw.forage={day:'2026-9-1',taken:[0,1]};
  raw.decor=['shelf','planter','chimes']; raw.equipped='chimes';
  const server=plain(c.harness.call('sanitizePixelCamp_',raw)), engine=E.hydrate(raw);
  assert.deepEqual(server,engine);
  assert.equal(server.pets.mochi.battles,3); assert.equal(server.pets.zee.battles,0);
  assert.deepEqual(server.curios,['key','starbottle']); assert.deepEqual(server.forage,{day:'',taken:[]});
  assert.deepEqual(server.decor,['planter'],'decor still needs the stamps'); assert.equal(server.equipped,'');
  raw.forage={day:'2026-09-10',taken:[2,2,5,-1,'1']};
  assert.deepEqual(plain(c.harness.call('sanitizePixelCamp_',raw)).forage,{day:'2026-09-10',taken:[2]});
});
test('every curio the engine can hand out is one the school will keep', () => {
  const c=setup();
  const server=c.harness.call('sanitizePixelCamp_',{...E.initial(),curios:E.CURIOS.map(x=>x.id)});
  assert.deepEqual(plain(server).curios,E.CURIOS.map(x=>x.id));
});
