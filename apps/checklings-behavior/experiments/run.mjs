#!/usr/bin/env node
/** Reproducible, isolated synthetic experiment. node run.mjs > report.json */
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {replay, chooseIntent, LIMITS} from './engine.mjs';

const entries=[
  { id:'mochi-careful', speciesId:'mochi', seed:5549, speciesDefaults:{curiosity:55,caution:55,activity:40} },
  { id:'mochi-curious', speciesId:'mochi', seed:149, speciesDefaults:{curiosity:55,caution:55,activity:40} },
  { id:'mochi-friendly', speciesId:'mochi', seed:1, speciesDefaults:{curiosity:55,caution:55,activity:40} }
];
const history=[
  {id:'synth-1',seq:1,kind:'FEED',tag:'berries'},
  {id:'synth-2',seq:2,kind:'EXPLORE',tag:'pond'},
  {id:'synth-3',seq:3,kind:'PLAY',tag:'ball'},
  {id:'synth-4',seq:4,kind:'SCARE',tag:'thunder'},
  {id:'synth-5',seq:5,kind:'RECOVER',tag:'quiet-den'},
  {id:'synth-6',seq:6,kind:'FRIENDLY',tag:'neighbor'}
];
const t0=performance.now(),cpu0=process.cpuUsage(),heap0=process.memoryUsage().heapUsed;
const samples=entries.map(spec=>{
  const snapshot=replay(spec,history);
  return { id:spec.id, traits:snapshot.traits, vitals:snapshot.state,
    memoryCount:snapshot.memories.length, preferences:snapshot.preferences,
    chosenIntent:chooseIntent(snapshot,{scene:'home',tag:'pond'}), snapshot };
});
// Replay consistency across a bounded workload, not a performance guarantee.
for(let i=0;i<1000;i++)replay(entries[i%entries.length],history);
const wallMs=performance.now()-t0,cpu=process.cpuUsage(cpu0),heap1=process.memoryUsage().heapUsed;
const intents={};
for(let seed=1;seed<=300;seed++){
  const snap=replay({id:'mochi-sample-'+seed,speciesId:'mochi',seed,speciesDefaults:{curiosity:55,caution:55,activity:40}},history);
  const intent=chooseIntent(snap,{scene:'home',tag:'pond'}).intent;
  intents[intent]=(intents[intent]||0)+1;
}
const snapshots=samples.map(x=>x.snapshot);
const digest=createHash('sha256').update(JSON.stringify(snapshots)).digest('hex');
const report={label:'SYNTHETIC EXPERIMENT — NOT DEPLOYED, NOT PLAYABLE',engine:'synthetic-individuality-v1',
  scenario:'three individuals of one species, same recorded events, different immutable seeded traits',
  events:history,limits:LIMITS,digestSha256:digest,
  exploratoryBiasCheck:{syntheticIndividuals:300,intents,warning:'Sample is a diagnostic, not a balance or engagement claim'},
  examples:samples.map(({snapshot,...rest})=>rest),
  measurements:{iterations:1000,wallMs:Math.round(wallMs*100)/100,cpuUserMs:cpu.user/1000,cpuSystemMs:cpu.system/1000,
    heapDeltaBytes:heap1-heap0,peakMemoryNotMeasured:true,platform:process.platform,node:process.version},
  noServerIntegration:true,noStudentData:true};
console.log(JSON.stringify(report,null,2));
