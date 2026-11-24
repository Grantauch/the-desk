import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {createMatch,STEP} from '../../packages/icebreak-core/match.mjs';

const [sourcePath,fixturePath]=process.argv.slice(2);
if(!sourcePath||!fixturePath)throw Error('Usage: node pinned-source-smoke.mjs <pinned icebreak.html> <tests/icebreak/fixture.cjs>');
const html=readFileSync(sourcePath);
const sha=createHash('sha1').update('blob '+html.length+'\0').update(html).digest('hex');
assert.equal(sha,'b83e673bad60ee22f58703355077ef8ea53696f1','expected exact #528 fixture blob');
const {fixture}=createRequire(import.meta.url)(resolve(fixturePath));
const {f,api}=fixture(html.toString('utf8'));
api.start();
const server=createMatch(),level={x:0,z:0,pass:false,shoot:false,check:false,burst:false};
const input=new Map([[0,{epoch:0,level,edges:[]}]]);
for(let tick=0;tick<122;tick++){f.step(STEP);server.step(input)}
api.input('w',true);level.x=1;
for(let tick=0;tick<45;tick++){
 f.step(STEP);server.step(input);
 const browserSkater=f.players.find(p=>p.device==='kb1'),serverSkater=server.snapshot().players[0];
 for(const field of ['x','z','vx','vz','facing','energy']){
  assert.ok(Math.abs(browserSkater[field]-serverSkater[field])<.00006,field+' differed after tick '+tick);
 }
}
console.log('Pinned #528 browser source vs authoritative server: 45 fixed ticks × 6 matching skater fields within snapshot precision');
