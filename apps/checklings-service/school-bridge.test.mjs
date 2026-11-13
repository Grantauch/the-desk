import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';
import {migrate} from './database.mjs';
import {schoolFixture} from './school-test-support.mjs';

test('actual school PIN issuer and HTTP/SQL broker with synthetic Apps Script workbook',async t=>{
  const db=await PGlite.create(),database={transaction:work=>db.transaction(work)};
  await migrate(database);
  const fixture=async()=>{const f=await schoolFixture(database);t.after(()=>f.close());return f;};
  try {
    await t.test('configuration and each teacher class default closed',async()=>{
      const f=await fixture(),l=await f.begin();
      assert.deepEqual(await f.call('getChecklingsAccess'),[{period:'Period 1',enabled:false},{period:'Period 2',enabled:false}]);
      await assert.rejects(f.invoke({kind:'identify',ticket:l.ticket,as:'ada'}),/not opened/);
      await f.invoke({kind:'config',patch:{enabled:false}});
      await assert.rejects(f.invoke({kind:'identify',ticket:l.ticket,as:'ada'}),/not available/);
      assert.equal(f.requests.length,0);
    });
    await t.test('real PIN/class issuer produces a usable browser-bound session without classroom writes',async()=>{
      const f=await fixture();await f.call('syncChecklingsAccess',['Period 1',true]);
      const before=await f.invoke({kind:'facts'}),l=await f.begin(),approved=await f.approve(l),login=await f.exchange(l,approved.callbackUrl);
      assert.equal(login.response.status,200);assert.ok(login.token);
      const actor=await database.transaction(c=>f.auth.authorize(login.token,c));assert.equal(actor.tenantId,f.config.tenantId);
      assert.deepEqual(await f.invoke({kind:'facts'}),before);
      for(const r of f.requests) {
        assert.equal(r.options.followRedirects,false);assert.equal(r.options.validateHttpsCertificates,true);
        const envelope=Object.values(JSON.parse(r.options.payload))[0];
        const body=JSON.parse(Buffer.from(envelope.split('.')[0],'base64url'));
        assert.ok(!/@|Student Email|PIN Hash|pinToken|actionProof|email|studentName|spreadsheet/i.test(JSON.stringify(body)));
      }
      assert.equal((await f.exchange(l,approved.callbackUrl)).response.status,401);
    });
    await t.test('a student chooses only their own enabled class; identities remain separate across classes',async()=>{
      const f=await fixture();for(const p of ['Period 1','Period 2'])await f.call('syncChecklingsAccess',[p,true]);
      const l=await f.begin(),identity=await f.invoke({kind:'identify',ticket:l.ticket,as:'ada'});
      assert.equal(identity.classes.length,2);
      await assert.rejects(f.call('completeChecklingsGame',[identity.selection,'forged-class',l.ticket],'ada'),/own enabled classes/);
      const one=await f.exchange(l,(await f.approve(l,'Period 1')).callbackUrl);
      const next=await f.begin(),two=await f.exchange(next,(await f.approve(next,'Period 2')).callbackUrl);
      const a=await database.transaction(c=>f.auth.authorize(one.token,c)),b=await database.transaction(c=>f.auth.authorize(two.token,c));
      assert.notEqual(a.memberId,b.memberId);assert.notEqual(a.classId,b.classId);
    });
    await t.test('wrong PIN, forged tickets, cross-account selection and a foreign school account are refused',async()=>{
      const f=await fixture();await f.call('syncChecklingsAccess',['Period 1',true]);const l=await f.begin();
      await assert.rejects(f.invoke({kind:'identify',ticket:l.ticket,pin:'000000',as:'ada'}),/did not match/);
      await assert.rejects(f.invoke({kind:'identify',ticket:l.ticket+'x',as:'ada'}),/again/);
      await assert.rejects(f.invoke({kind:'identify',ticket:l.ticket,as:'foreign'}),/school Google account/);
      const i=await f.invoke({kind:'identify',ticket:l.ticket,as:'ada'});
      await assert.rejects(f.call('completeChecklingsGame',[i.selection,i.classes[0].id,l.ticket],'alan'),/PIN again/);
      await assert.rejects(f.call('syncChecklingsAccess',['Period 1',false],'ada'),/teacher account/);
    });
    await t.test('unexposed school email still uses the existing PIN identity path',async()=>{
      const f=await fixture();await f.call('syncChecklingsAccess',['Period 1',true]);const l=await f.begin();
      const i=await f.invoke({kind:'identify',ticket:l.ticket,as:'blank'});
      const r=await f.call('completeChecklingsGame',[i.selection,i.classes[0].id,l.ticket],'blank');
      assert.equal((await f.exchange(l,r.callbackUrl)).response.status,200);
    });
    await t.test('fresh class synchronization propagates roster deactivation and preserves game records',async()=>{
      const f=await fixture();await f.call('syncChecklingsAccess',['Period 1',true]);const l=await f.begin(),login=await f.exchange(l,(await f.approve(l)).callbackUrl);
      const actor=await database.transaction(c=>f.auth.authorize(login.token,c));
      const pet=await f.store.importLegacy(login.token,'import',{raw:JSON.stringify({v:1,species:'zee',name:'Preserved',habitat:'sky'}),officialBestStreak:14,importedAt:'2026-10-23T16:00:00.000Z'});
      await f.invoke({kind:'roster',column:5,value:false});await f.call('syncChecklingsAccess',['Period 1',null]);
      await assert.rejects(f.store.load(login.token,pet.creature.id),/Unauthorized/);
      assert.equal((await db.query('SELECT active FROM ck_memberships WHERE tenant_id=$1 AND member_id=$2',[actor.tenantId,actor.memberId])).rows[0].active,false);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM ck_creatures WHERE tenant_id=$1',[actor.tenantId])).rows[0].n,1);
    });
    await t.test('PIN rotation after selection prevents completing a launch',async()=>{
      const f=await fixture();await f.call('syncChecklingsAccess',['Period 1',true]);const l=await f.begin(),i=await f.invoke({kind:'identify',ticket:l.ticket,as:'ada'});
      for(const period of ['Period 1','Period 2'])await f.invoke({kind:'roster',period,column:4,value:'654321'});
      await assert.rejects(f.call('completeChecklingsGame',[i.selection,i.classes[0].id,l.ticket],'ada'),/credentials changed/);
    });
    await t.test('school pause blocks pending launch; an unconfirmed push makes no false success claim',async()=>{
      const f=await fixture();await f.call('syncChecklingsAccess',['Period 1',true]);const l=await f.begin(),i=await f.invoke({kind:'identify',ticket:l.ticket,as:'ada'});
      f.failTransport(true);const r=await f.call('syncChecklingsAccess',['Period 1',false]);
      assert.equal(r.confirmed,false);assert.equal(r.enabled,false);assert.match(r.message,/not confirmed/);
      await assert.rejects(f.call('completeChecklingsGame',[i.selection,i.classes[0].id,l.ticket],'ada'),/own enabled classes/);
    });
    await t.test('pause revokes access despite oversized or duplicate roster rows',async()=>{
      for(const malformed of [{count:34},{count:1,duplicate:true}]) {
        const f=await fixture();await f.call('syncChecklingsAccess',['Period 1',true]);
        const l=await f.begin(),login=await f.exchange(l,(await f.approve(l)).callbackUrl);
        await f.invoke({kind:'appendRoster',...malformed});
        assert.deepEqual(await f.call('syncChecklingsAccess',['Period 1',false]),{enabled:false,confirmed:true});
        assert.equal((await f.call('getChecklingsAccess')).find(r=>r.period==='Period 1').enabled,false);
        await assert.rejects(database.transaction(c=>f.auth.authorize(login.token,c)),/Unauthorized/);
        const sent=JSON.parse(f.requests.at(-1).options.payload).snapshot;
        const snapshot=JSON.parse(Buffer.from(sent.split('.')[0],'base64url'));
        assert.equal(snapshot.enabled,false);assert.deepEqual(snapshot.members,[]);
      }
    });
    await t.test('a failed game launch cannot block normal check-in or Hall Pass',async()=>{
      const f=await fixture();await f.call('syncChecklingsAccess',['Period 1',true]);
      const l=await f.begin();f.failTransport(true);await assert.rejects(f.approve(l),/could not confirm/);
      const after=await f.invoke({kind:'classroomAction'});assert.equal(after.checkedIn,true);assert.deepEqual(after.points,[1]);assert.deepEqual(after.passes,['OUT']);
    });
    await t.test('private school snapshot route rejects browser-origin or unsigned requests',async()=>{
      const f=await fixture();
      assert.equal((await f.request('/bridge/school',{snapshot:'forged'})).status,403);
      const response=await f.handler(new Request(f.config.gameOrigin+'/bridge/school',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({snapshot:'forged'})}),{clientAddress:'192.0.2.40'});
      assert.equal(response.status,401);assert.deepEqual(await response.json(),{error:'sign_in_required'});
    });
    await t.test('school launch and teacher page scripts parse after HtmlService rendering',async()=>{
      const f=await fixture(),l=await f.begin();
      for(const admin of [false,true]) {
        const html=await f.call('checklingsPage_',[admin?'':l.ticket,admin]);
        const source=html.match(/<script>([\s\S]*?)<\/script>/)[1];new vm.Script(source);
        assert.ok(!/localStorage|sessionStorage|https?:\/\//.test(source));assert.match(html,/no-referrer/);
      }
      assert.match((await f.call('doGet',[{parameter:{mode:'checklings',ticket:'forged'}}])).content,/unavailable/);
    });
  } finally {await db.close();}
});
