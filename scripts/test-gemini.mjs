import assert from 'node:assert/strict';
import { createHandler, config } from '../netlify/functions/gemini.mjs';
import { generateText, GeminiError } from './lib/gemini-api.mjs';
import { requestFromEvent } from './gemini-handler.mjs';

// Netlify ignores code-based throttling without an explicit route. Use the
// per-IP/domain mode supported by standard plans, rather than enterprise-only
// shared-domain aggregation. A deployed smoke check still proves enforcement.
assert.equal(config.path, '/api/gemini');
assert.deepEqual(config.rateLimit.aggregateBy, ['ip', 'domain']);
assert.equal(config.rateLimit.windowLimit, 10);
assert.equal(config.rateLimit.windowSize, 60);
let calls = 0;
const env = key => ({ GEMINI_ACCESS_TOKEN: 'test-access-token', GEMINI_API_KEY: 'fake-key' })[key];
const handler = createHandler({ env, generate: async () => { calls++; return { text: 'Hello.', model: 'test' }; } });
const request = (body, options = {}) => new Request('https://test.invalid/api/gemini', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer test-access-token', ...options.headers }, body: JSON.stringify(body) });
assert.equal((await handler(new Request('https://test.invalid'))).status, 405);
assert.equal((await handler(request({prompt:'Hi'}, {headers:{authorization:''}}))).status, 401);
assert.equal(calls,0);
assert.equal((await handler(request({}))).status,400);
assert.equal((await handler(request({prompt:'x'.repeat(12001)}))).status,400);
assert.equal((await handler(request({prompt:'x'.repeat(21000)}))).status,413);
assert.equal((await handler(request({prompt:'Hi'}, {headers:{'content-type':'text/plain'}}))).status,415);
assert.equal((await handler(request({prompt:'Hi'}))).status,200);
assert.equal(calls,1);
assert.equal((await createHandler({env:()=>undefined})(request({prompt:'Hi'}))).status,503);
for (const [status, expected] of [[400,502],[401,502],[403,502],[429,429],[500,503]]) {
  await assert.rejects(() => generateText({apiKey:'fake',prompt:'Hi',sleep:async()=>{},fetchImpl:async()=>Response.json({error:{message:'secret must not be echoed'}},{status})}), error=>error.status===expected && !error.message.includes('secret must'));
}
await assert.rejects(()=>generateText({apiKey:'fake',prompt:'Hi',fetchImpl:async()=>Response.json({error:{status:'INVALID_ARGUMENT',message:'free text secret',details:[{reason:'API_KEY_INVALID'}]}},{status:400})}),error=>error.message.includes('HTTP 400 API_KEY_INVALID') && !error.message.includes('free text'));
await assert.rejects(()=>generateText({apiKey:'fake',prompt:'Hi',fetchImpl:async()=>Response.json({error:{status:'bad; $(x)'}},{status:403})}),error=>error.message.includes('HTTP 403)') && !error.message.includes('$('));
// Busy Google answers are retried, then reported as busy rather than as a bad key.
// A fake clock moves only when the code pauses, so these checks never depend on runner speed.
let clock=0; const now=()=>clock; const sleepFake=async ms=>{clock+=ms;};
let busyCalls=0;
clock=0;
const busyOk=await generateText({apiKey:'fake',prompt:'Hi',now,sleep:sleepFake,fetchImpl:async()=>++busyCalls<3?Response.json({error:{status:'UNAVAILABLE'}},{status:503}):Response.json({candidates:[{content:{parts:[{text:'Back'}]}}]})});
assert.equal(busyOk.text,'Back'); assert.equal(busyCalls,3);
busyCalls=0; clock=0;
await assert.rejects(()=>generateText({apiKey:'fake',prompt:'Hi',now,sleep:sleepFake,fetchImpl:async()=>{busyCalls++;return Response.json({error:{status:'UNAVAILABLE'}},{status:503});}}),error=>error.code==='GEMINI_BUSY'&&error.status===503&&error.message.includes('HTTP 503 UNAVAILABLE')&&!error.message.includes('API key'));
assert.equal(busyCalls,4);
busyCalls=0; clock=0;
await assert.rejects(()=>generateText({apiKey:'fake',prompt:'Hi',totalMs:9000,now,sleep:sleepFake,fetchImpl:async()=>{busyCalls++;return new Response('',{status:503});}}),error=>error.code==='GEMINI_BUSY');
assert.equal(busyCalls,3,'a short budget must stop retrying before the Netlify time limit');
assert(clock<9000,'pauses must fit inside the budget');
await assert.rejects(()=>generateText({apiKey:'fake',prompt:'Hi',fetchImpl:async()=>Response.json({})}),error=>error.code==='EMPTY_RESPONSE');
await assert.rejects(()=>generateText({apiKey:'fake',prompt:'Hi',sleep:async()=>{},fetchImpl:async()=>{throw new Error('network secret')}}),error=>error.status===503&&!error.message.includes('network secret'));
const answer=await generateText({apiKey:'fake',prompt:'Hi',fetchImpl:async(url,init)=>{
 assert(!url.includes('fake')); assert.equal(init.headers['x-goog-api-key'],'fake');
 return Response.json({candidates:[{content:{parts:[{text:'private thoughts',thought:true},{text:'Hello'},{text:' world'}]}}]});
}});
assert.equal(answer.text,'Hello world');
const upstreamHandler=createHandler({env,generate:async()=>{throw new GeminiError('Quota reached',429,'GEMINI_QUOTA')}});
assert.equal((await upstreamHandler(request({prompt:'Hi'}))).status,429);
const event={sender:{login:'Grantauch'},inputs:{task:'Review the brief'}};
assert.equal(requestFromEvent(event,'workflow_dispatch','Grantauch/the-desk').issue,null);
assert.throws(()=>requestFromEvent({...event,sender:{login:'stranger'}},'workflow_dispatch','Grantauch/the-desk'));
const comment={sender:{login:'Grantauch'},comment:{user:{login:'Grantauch'},body:'@gemini literal $(do-not-execute)'},issue:{number:1}};
assert.equal(requestFromEvent(comment,'issue_comment','Grantauch/the-desk').task,'literal $(do-not-execute)');
assert.throws(()=>requestFromEvent({...comment,comment:{...comment.comment,user:{login:'stranger'}}},'issue_comment','Grantauch/the-desk'));
console.log('Gemini regression suite passed: authorization, bounded input, upstream errors, response parts, trusted triggers, and literal task handling.');
