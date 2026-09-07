/** Session and policy regressions, registered in the existing runtime harness. */
const assert = require('node:assert/strict');
const { classroom, PEOPLE, TEACHER, TEACHER_CONTRACT } = require('./hall-pass-fixtures.cjs');

module.exports = function registerSessionTests(test, section) {
  const member = (c, person = PEOPLE.ada, period = 'Period 1') => c.harness.call('getStudentByKey_', c.key(person, period));
  const at = (c, value) => { c.harness.clock.set(new Date(value)); c.harness.newRequest(); };
  const teacher = (c, name, ...args) => { c.harness.newRequest(); c.harness.signInAs(TEACHER); return c.harness.call(name, ...args, TEACHER_CONTRACT); };
  const counts = (c) => [c.passLog().length, c.checkIns().length, c.queue().length];
  const schedules = [
    ['NORMAL', '2026-09-10', '-04:00', [['07:30','08:25'],['08:30','09:25'],['10:05','11:00'],['11:05','12:00'],['12:35','13:30'],['13:35','14:30']]],
    ['REDUCED', '2026-09-02', '-04:00', [['07:30','08:08'],['08:13','08:51'],['08:56','09:34'],['10:22','11:00'],['09:39','10:17'],['11:35','12:10']]],
    ['HALF', '2027-01-15', '-05:00', [['07:30','08:01'],['08:06','08:33'],['08:38','09:05'],['09:10','09:37'],['09:42','10:09'],['10:14','10:41']]],
  ];
  section('Session boundaries for all six periods and all three schedules');
  for (const [profile, day, offset, periods] of schedules) {
    periods.forEach(([start, end], index) => {
      const period = `Period ${index + 1} — Synthetic class`;
      const startMs = new Date(`${day}T${start}:00${offset}`).getTime();
      const endMs = new Date(`${day}T${end}:00${offset}`).getTime();
      const cases = [
        ['before start', startMs - 1, false, false],
        ['at start', startMs, true, false],
        ['before five minutes', startMs + 300000 - 1, true, false],
        ['at five minutes', startMs + 300000, false, false],
        ['before ten minutes', startMs + 600000 - 1, false, false],
        ['at ten minutes', startMs + 600000, false, true],
        ['before final ten', endMs - 600000 - 1, false, true],
        ['at final ten', endMs - 600000, false, false],
        ['at bell', endMs, false, false],
      ];
      for (const [label, time, checkInAllowed, passRequestAllowed] of cases) {
        test(`${profile} P${index + 1}: ${label}`, () => {
          const c = classroom({ now: new Date(time), memberships: [[PEOPLE.ada, period]] });
          const session = c.harness.call('getClassSession_', member(c, PEOPLE.ada, period));
          assert.equal(session.scheduleKey, profile);
          assert.equal(session.classStart, new Date(startMs).toISOString());
          assert.equal(session.classEnd, new Date(endMs).toISOString());
          assert.equal(session.checkInAllowed, checkInAllowed);
          assert.equal(session.passRequestAllowed, passRequestAllowed);
        });
      }
    });
  }

  section('Calendar overrides, malformed schedules and school time');
  for (const day of ['2026-09-04', '2026-09-07', '2026-09-12', '2026-12-25', '2027-06-09']) {
    test(`closed date ${day} rejects student actions without log writes`, () => {
      const c = classroom({ now: new Date(`${day}T07:30:00-04:00`) });
      const before = counts(c);
      assert.throws(() => c.checkIn(PEOPLE.ada, 'Period 1'), /no student session/);
      assert.throws(() => c.requestPass(PEOPLE.ada, 'Period 1'), /no student session/);
      assert.deepEqual(counts(c), before);
    });
  }
  test('June 8 uses HALF and reduced P5 occurs before P4', () => {
    const c = classroom({ now: new Date('2027-06-08T07:40:00-04:00') });
    assert.equal(c.harness.call('getClassSession_', member(c)).scheduleKey, 'HALF');
    at(c, '2026-09-02T09:50:00-04:00');
    assert.equal(c.harness.call('getClassSession_', member(c)).currentPeriod, 5);
    at(c, '2026-09-02T10:40:00-04:00');
    assert.equal(c.harness.call('getClassSession_', member(c)).currentPeriod, 4);
  });
  test('an explicit special profile overrides the ordinary weekday', () => {
    const c = classroom({ now: new Date('2026-09-10T09:10:00-04:00') });
    c.harness.sheet('Bell Schedule').appendRow(['ASSEMBLY', 1, '09:00', '09:40', 'Synthetic amendment', 'test']);
    c.harness.sheet('School Calendar').appendRow(['2026-09-10', true, 'Assembly day', 'test', 'test', 'ASSEMBLY']);
    c.harness.newRequest();
    assert.equal(c.requestPass(PEOPLE.ada, 'Period 1').state.actionOutcome.kind, 'STARTED');
  });
  for (const profile of ['', 'UNKNOWN']) {
    test(`unconfigured date profile ${profile || '(blank)'} fails closed`, () => {
      const c = classroom();
      c.harness.sheet('School Calendar').appendRow(['2026-09-10', true, 'Special day', '', '', profile]);
      c.harness.newRequest();
      assert.throws(() => c.requestPass(PEOPLE.ada, 'Period 1'), /schedule needs/);
      assert.deepEqual(counts(c), [0,0,0]);
      teacher(c, 'teacherStartPass', c.key(PEOPLE.ada, 'Period 1'), 'Synthetic schedule backup');
      assert.equal(c.passLog()[0].Status, 'OUT');
    });
  }
  for (const bad of [['NORMAL',1,'07:30','08:25'],['NORMAL',2,'07:35','08:30'],['NORMAL',7,'09:00','09:45'],['NORMAL',3,'25:00','26:00']]) {
    test(`duplicate or invalid timetable row ${bad.join('/')} fails closed`, () => {
      const c = classroom();
      c.harness.sheet('Bell Schedule').appendRow([...bad,'test','test']);
      c.harness.newRequest();
      assert.throws(() => c.requestPass(PEOPLE.ada, 'Period 1'), /schedule needs/);
    });
  }
  test('missing selected period and malformed membership fail closed', () => {
    const c = classroom();
    c.harness.sheet('Bell Schedule').getRange(2,1).setValue('REMOVED');
    c.harness.newRequest();
    assert.throws(() => c.requestPass(PEOPLE.ada, 'Period 1'), /schedule needs/);
    assert.equal(c.harness.call('getClassSession_', {classPeriod:'Period 10'}).passRequestAllowed, false);
  });
  for (const invalid of ['', 'bad', '-1']) {
    test(`invalid timing setting ${invalid || '(blank)'} fails closed`, () => {
      const c = classroom({ settings: {PASS_PROTECT_FIRST_MINUTES: invalid} });
      assert.throws(() => c.requestPass(PEOPLE.ada, 'Period 1'), /schedule needs/);
    });
  }
  for (const date of ['2026-10-29T07:30:00-04:00','2026-11-05T07:30:00-05:00','2027-03-11T07:30:00-05:00','2027-03-15T07:30:00-04:00']) {
    test(`school clock survives daylight saving at ${date}`, () => {
      const c = classroom({now:new Date(date)});
      assert.equal(c.checkIn(PEOPLE.ada, 'Period 1').state.checkedIn, true);
    });
  }

  section('Fresh proofs, bell races and queue expiry');
  test('wrong-time PIN identification issues no action proof', () => {
    const c = classroom();
    const before = Object.keys(c.harness.properties.getProperties()).filter(k=>k.startsWith('student-action:')).length;
    assert.throws(() => c.harness.call('identifyCheckInWithPin', c.pin(PEOPLE.ada), 'test'), /first five/);
    assert.equal(Object.keys(c.harness.properties.getProperties()).filter(k=>k.startsWith('student-action:')).length, before);
    assert.deepEqual(counts(c), [0,0,0]);
  });
  for (const [action, time, endpoint] of [['CHECKIN','07:34:59','submitDailyCheckIn'], ['PASS_REQUEST','08:14:59','requestBathroomPass']]) {
    test(`${action} is checked again under the lock after its boundary`, () => {
      const c = classroom({now:new Date(`2026-09-10T${time}-04:00`)});
      const key = c.key(PEOPLE.ada, 'Period 1');
      const proof = c.harness.call('authorizeStudentAction', c.pin(PEOPLE.ada), action, key, 'boundary');
      c.harness.clock.advanceSeconds(1); c.harness.newRequest();
      assert.throws(() => c.harness.call(endpoint, proof.actionProof, key, proof.pinToken), /first five|first and last ten/);
      assert.deepEqual(counts(c), [0,0,0]);
    });
  }
  test('multi-class PIN cannot select an upcoming or ended class', () => {
    const c = classroom({memberships:[[PEOPLE.ada,'Period 1'],[PEOPLE.ada,'Period 3']]});
    const initial = c.harness.call('identifyWithPin', c.pin(PEOPLE.ada), 'multi');
    assert.equal(initial.requiresClassSelection, true);
    assert.throws(() => c.harness.call('selectStudentClass', initial.pinToken, c.key(PEOPLE.ada,'Period 3'), 'pass', initial.actionProof), /selected class/);
    const selected = c.harness.call('selectStudentClass', initial.pinToken, c.key(PEOPLE.ada,'Period 1'), 'pass', initial.actionProof);
    assert.equal(c.harness.call('readStudentActionProof_',selected.actionProof).key, c.key(PEOPLE.ada,'Period 1'));
    assert.throws(() => c.harness.call('requestBathroomPass', initial.actionProof, c.key(PEOPLE.ada,'Period 1'), initial.pinToken), /already used/);
    assert.throws(() => c.harness.call('selectStudentClass', selected.pinToken, c.key(PEOPLE.ada,'Period 3'), 'pass', selected.actionProof), /different class/);
  });
  test('bell expires WAITING persistently but leaves OUT until a fresh-PIN return', () => {
    const c = classroom({settings:{QUEUE_MAX_WAIT_MINUTES:120}});
    c.requestPass(PEOPLE.ada,'Period 1'); c.requestPass(PEOPLE.alan,'Period 1');
    at(c,'2026-09-10T08:25:00-04:00');
    const state=c.teacherState();
    assert.equal(state.queue.length,0); assert.equal(state.active.length,1);
    assert.equal(c.queue()[0].Status,'CLASS_ENDED');
    assert.equal(c.passLog()[0].Status,'OUT');
    c.returnPass(PEOPLE.ada,'Period 1');
    assert.equal(c.passLog()[0].Status,'RETURNED'); assert.equal(c.passLog().length,1);
  });
  test('student poll also persists bell expiry under the shared lock', () => {
    const c=classroom({settings:{QUEUE_MAX_WAIT_MINUTES:120}});
    c.requestPass(PEOPLE.ada,'Period 1'); const queued=c.requestPass(PEOPLE.alan,'Period 1');
    at(c,'2026-09-10T08:25:00-04:00');
    const before=c.harness.state.lock.acquisitions;
    c.harness.call('refreshStudentState',queued.state.pinToken);
    assert.equal(c.queue()[0].Status,'CLASS_ENDED'); assert.ok(c.harness.state.lock.acquisitions>before);
  });
  test('a slot opening during the final ten minutes cannot promote a waiting request', () => {
    const c=classroom({settings:{QUEUE_MAX_WAIT_MINUTES:120}});
    c.requestPass(PEOPLE.ada,'Period 1'); c.requestPass(PEOPLE.alan,'Period 1');
    at(c,'2026-09-10T08:15:00-04:00'); c.returnPass(PEOPLE.ada,'Period 1');
    assert.equal(c.passLog().length,1); assert.equal(c.queue()[0].Status,'INELIGIBLE');
  });
  test('unknown timetable still permits return of an active pass', () => {
    const c=classroom();c.requestPass(PEOPLE.ada,'Period 1');
    c.harness.sheet('School Calendar').appendRow(['2026-09-10',true,'Special','','','UNKNOWN']);
    c.harness.newRequest(); c.returnPass(PEOPLE.ada,'Period 1');
    assert.equal(c.passLog()[0].Status,'RETURNED');
  });

  section('Membership evidence, student-wide access and audited teacher backups');
  test('class counts and evidence agree while daily usage remains student-wide', () => {
    const c=classroom({memberships:[[PEOPLE.ada,'Period 1'],[PEOPLE.ada,'Period 3']],settings:{STUDENT_PASS_LIMIT:3,PASS_COOLDOWN_MINUTES:0}});
    c.trip(PEOPLE.ada,'Period 1',60);
    at(c,'2026-09-10T10:30:00-04:00'); c.trip(PEOPLE.ada,'Period 3',60);
    const rows=c.teacherState().studentPassUsage;
    assert.equal(rows.length,2); rows.forEach(row=>{assert.equal(row.used,1);assert.equal(row.remaining,2);assert.equal(row.todayUsed,2);assert.ok(!('pinHash' in row));});
    for(const period of ['Period 1','Period 3']) {
      const evidence=teacher(c,'teacherGetMembershipPasses',c.key(PEOPLE.ada,period));
      assert.equal(evidence.passes.length,1);assert.equal(evidence.used,1);assert.equal(evidence.passes[0].classPeriod,period);
    }
    assert.equal(c.teacherState().repeatPassesToday.length,1);
  });
  test('student-wide daily limit blocks another class with a fresh class allowance', () => {
    const c=classroom({memberships:[[PEOPLE.ada,'Period 1'],[PEOPLE.ada,'Period 3']],settings:{STUDENT_PASS_LIMIT:3,DAILY_PASS_LIMIT:1,PASS_COOLDOWN_MINUTES:0}});
    c.trip(PEOPLE.ada,'Period 1',60);at(c,'2026-09-10T10:30:00-04:00');
    const result=c.requestPass(PEOPLE.ada,'Period 3').state;
    assert.equal(result.actionOutcome.kind,'BLOCKED');assert.equal(result.passAllowance.dailyLimitReached,true);assert.equal(result.passAllowance.used,0);
  });
  test('a long cooldown follows the student into another class', () => {
    const c=classroom({memberships:[[PEOPLE.ada,'Period 1'],[PEOPLE.ada,'Period 3']],settings:{PASS_COOLDOWN_MINUTES:180}});
    c.trip(PEOPLE.ada,'Period 1',60);at(c,'2026-09-10T10:30:00-04:00');
    assert.equal(c.requestPass(PEOPLE.ada,'Period 3').state.passAllowance.cooldownActive,true);
  });
  for(const mode of ['STANDARD','UNLIMITED','ESCORT_ONLY']) {
    test(`${mode} propagates across active, retained and new memberships`, () => {
      const c=classroom({memberships:[[PEOPLE.ada,'Period 1'],[PEOPLE.ada,'Period 3',{active:false}]]});
      teacher(c,'teacherSetStudentPassAccess',PEOPLE.ada.email,mode,'Synthetic policy change');
      c.rosterRows().forEach(row=>assert.equal(row['Pass Access'],mode));
      c.harness.call('teacherAddStudentClass',PEOPLE.ada.name,PEOPLE.ada.email,'Period 4');
      c.rosterRows().forEach(row=>assert.equal(row['Pass Access'],mode));
      assert.equal(c.harness.sheet('Teacher Actions').records().length,2);
    });
  }
  test('unlimited bypasses numeric limits and cooldown, but not timing', () => {
    const c=classroom({memberships:[[PEOPLE.ada,'Period 1',{passAccess:'UNLIMITED'}]],settings:{STUDENT_PASS_LIMIT:1,DAILY_PASS_LIMIT:1,PASS_COOLDOWN_MINUTES:5}});
    c.trip(PEOPLE.ada,'Period 1',60); assert.equal(c.requestPass(PEOPLE.ada,'Period 1').state.actionOutcome.kind,'STARTED');
    c.returnPass(PEOPLE.ada,'Period 1');at(c,'2026-09-10T08:15:00-04:00');
    assert.throws(()=>c.requestPass(PEOPLE.ada,'Period 1'),/first and last ten/);
  });
  test('escort-only blocks self-start and teacher backup records every restriction privately', () => {
    const c=classroom({memberships:[[PEOPLE.ada,'Period 1',{passAccess:'ESCORT_ONLY'}]]});
    assert.throws(()=>c.requestPass(PEOPLE.ada,'Period 1'),/Ask your teacher/); assert.deepEqual(counts(c),[0,0,0]);
    at(c,'2026-09-10T08:20:00-04:00');
    assert.throws(()=>teacher(c,'teacherStartPass',c.key(PEOPLE.ada,'Period 1'),''),/reason/);
    teacher(c,'teacherStartPass',c.key(PEOPLE.ada,'Period 1'),'Synthetic private explanation');
    const audit=c.harness.sheet('Teacher Actions').records()[0];
    assert.equal(audit.Actor,TEACHER); assert.ok(audit.At instanceof Date);
    assert.equal(audit['Class / Period'],'Period 1'); assert.equal(audit.Action,'ESCORTED_PASS_STARTED');
    assert.match(audit['Restrictions Bypassed'],/ESCORT_ONLY/);assert.match(audit['Restrictions Bypassed'],/PROTECTED_WINDOW/);
    assert.equal(audit.Reason,'Synthetic private explanation');assert.equal(audit['Reference ID'],c.passLog()[0]['Pass ID']);
    const state=c.harness.call('getStudentState_',member(c),'','pin'); const payload=JSON.stringify(state);
    assert.ok(!payload.includes('ESCORT_ONLY'));assert.ok(!payload.includes('Synthetic private explanation'));assert.ok(!payload.includes(TEACHER));
    c.returnPass(PEOPLE.ada,'Period 1');assert.equal(c.passLog()[0].Status,'RETURNED');
  });
  test('changing a queued student to escort-only closes their waiting request', () => {
    const c=classroom();c.requestPass(PEOPLE.ada,'Period 1');c.requestPass(PEOPLE.alan,'Period 1');
    teacher(c,'teacherSetStudentPassAccess',PEOPLE.alan.email,'ESCORT_ONLY','Synthetic change');
    assert.equal(c.queue()[0].Status,'INELIGIBLE');c.returnPass(PEOPLE.ada,'Period 1');assert.equal(c.passLog().length,1);
  });
  test('teacher late attendance requires a reason and records the selected class', () => {
    const c=classroom();assert.throws(()=>teacher(c,'teacherCheckInStudent',c.key(PEOPLE.ada,'Period 1'),''),/reason/);
    teacher(c,'teacherCheckInStudent',c.key(PEOPLE.ada,'Period 1'),'Synthetic late arrival');
    assert.equal(c.checkIns().length,1); const audit=c.harness.sheet('Teacher Actions').records()[0];
    assert.equal(audit.Action,'CHECKIN_RECORDED');assert.equal(audit['Class / Period'],'Period 1');assert.equal(audit.Reason,'Synthetic late arrival');
  });
  test('stale teacher bootstrap, polling, access, evidence and changed actions reject before writes', () => {
    const c=classroom();const key=c.key(PEOPLE.ada,'Period 1');c.harness.signInAs(TEACHER);
    for(const [name,args] of [['getBootstrap',['teacher']],['refreshTeacherState',[]],['teacherStartPass',[key,'reason']],['teacherEndPass',['unknown','reason']],['teacherCheckInStudent',[key,'reason']],['teacherGetMembershipPasses',[key]],['teacherSetStudentPassAccess',[PEOPLE.ada.email,'UNLIMITED','reason']],['teacherGetCountablePasses',[PEOPLE.ada.email]],['teacherSetStudentUnlimited',[PEOPLE.ada.email,true]]]) {
      assert.throws(()=>c.harness.call(name,...args),/Refresh/i,name);
    }
    assert.deepEqual(counts(c),[0,0,0]); assert.equal(c.harness.sheet('Teacher Actions').records().length,0);
  });
  test('teacher return validates audit text before closing a pass', () => {
    const c=classroom(); c.requestPass(PEOPLE.ada,'Period 1');
    const id=c.passLog()[0]['Pass ID'];
    assert.throws(()=>teacher(c,'teacherEndPass',id,'=1+1'),/cannot begin/i);
    assert.equal(c.passLog()[0].Status,'OUT');
    assert.equal(c.harness.sheet('Teacher Actions').records().length,0);
    teacher(c,'teacherEndPass',id,'Synthetic return');
    assert.equal(c.passLog()[0].Status,'RETURNED');
    assert.equal(c.harness.sheet('Teacher Actions').records()[0].Action,'PASS_RETURNED');
  });
  test('student accounts cannot use new teacher controls or evidence', () => {
    const c=classroom();c.harness.signInAs(PEOPLE.ada.email);
    assert.throws(()=>c.harness.call('teacherSetStudentPassAccess',PEOPLE.ada.email,'UNLIMITED','test',TEACHER_CONTRACT),/teacher account/);
    assert.throws(()=>c.harness.call('teacherGetMembershipPasses',c.key(PEOPLE.ada,'Period 1'),TEACHER_CONTRACT),/teacher account/);
  });

  section('Additive and repeatable workbook migration');
  test('native migration rehearsal and deployed smoke preserve the production workbook', () => {
    const c = classroom();
    const before = JSON.stringify(c.harness.call('releasePreservedState_', c.harness.spreadsheet));
    const rehearsal = c.harness.call('releaseRehearseSessionMigration');
    assert.equal(rehearsal.ok, true); assert.equal(rehearsal.idempotent, true);
    const smoke = teacher(c, 'releaseRunSyntheticSmoke');
    assert.equal(smoke.request, 'STARTED'); assert.equal(smoke.return, 'RETURNED_COUNTABLE');
    assert.equal(smoke.productionFactsUnchanged, true);
    assert.equal(JSON.stringify(c.harness.call('releasePreservedState_', c.harness.spreadsheet)), before);
    assert.equal(c.harness.sentMail.length, 0);
  });
  test('live migration cannot run before a rehearsal and preserves facts after one', () => {
    const c = classroom();
    assert.throws(() => c.harness.call('releaseMigrateLiveSessionWorkbook'), /rehearsal must pass/);
    c.harness.call('releaseRehearseSessionMigration');
    assert.equal(c.harness.call('releaseMigrateLiveSessionWorkbook').ok, true);
  });
  test('student callers cannot create release workbooks or migrate production', () => {
    const c = classroom(); c.harness.signInAs(PEOPLE.ada.email);
    ['releaseRehearseSessionMigration', 'releaseMigrateLiveSessionWorkbook', 'releaseRunSyntheticSmoke']
      .forEach(name => assert.throws(() => c.harness.call(name, TEACHER_CONTRACT), /teacher account/));
  });
  test('migration preserves six roster columns, credentials, history and existing settings', () => {
    const c=classroom({memberships:[[PEOPLE.ada,'Period 1',{unlimited:true}],[PEOPLE.ada,'Period 3']],settings:{MAX_ACTIVE_PASSES:2,STUDENT_PASS_LIMIT:3}});
    c.trip(PEOPLE.ada,'Period 1',60);
    const roster=c.harness.sheet('Roster'), before=JSON.stringify(roster.getRange(2,1,2,6).getValues());
    const pins=JSON.stringify(c.pinCards()), log=JSON.stringify(c.passLog());
    c.harness.newRequest();c.harness.call('migrateSessionPolicy_');c.harness.call('migrateSessionPolicy_');
    assert.equal(JSON.stringify(roster.getRange(2,1,2,6).getValues()),before);
    assert.equal(JSON.stringify(c.pinCards()),pins);assert.equal(JSON.stringify(c.passLog()),log);
    c.rosterRows().forEach(row=>assert.equal(row['Pass Access'],'UNLIMITED'));
    assert.equal(c.harness.sheet('Bell Schedule').records().length,18);
    assert.equal(c.harness.call('getSettings_').MAX_ACTIVE_PASSES,'2');assert.equal(c.harness.call('getSettings_').STUDENT_PASS_LIMIT,'3');
    assert.equal(c.harness.sheet('Pass Log').getRange(1,21).getValue(),'Void Reason');
    assert.equal(c.harness.sheet('Pass Audit').getRange(1,22).getValue(),'Archived At');
  });
  test('migration preserves edited profiles and marks amended dates unconfigured', () => {
    const c=classroom(); const bells=c.harness.sheet('Bell Schedule');bells.getRange(2,3).setValue('07:31');bells.getRange(3,1).setValue('CUSTOM');
    const cal=c.harness.sheet('School Calendar');const reduced=c.calendar().find(row=>row.Date==='2026-09-02');cal.getRange(reduced.__row,3).setValue('Unexpected assembly');cal.getRange(reduced.__row,6).setValue('');
    c.harness.newRequest();c.harness.call('migrateSessionPolicy_');
    assert.equal(bells.getRange(2,3).getValue(),'07:31');assert.equal(bells.records().filter(row=>row['Schedule Key']==='NORMAL').length,5);
    assert.equal(cal.getRange(reduced.__row,6).getValue(),'UNCONFIGURED');
  });
};
