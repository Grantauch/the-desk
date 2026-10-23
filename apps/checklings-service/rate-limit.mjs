import {createHmac} from 'node:crypto';
import {isIP} from 'node:net';

const budgets={launch:120,exchange:240,logout:240,bridge:120,command:600};
const dbClock=async c=>Number((await c.query('SELECT floor(extract(epoch FROM clock_timestamp())*1000)::text AS now_ms')).rows[0].now_ms);

/** Shared SQL counters. The host adapter supplies a trusted canonical client IP,
 * never an arbitrary X-Forwarded-For header from the browser. No raw IP is saved.
 */
export function createRateLimiter({database,key,limits=budgets,clock=dbClock}) {
  if(!database || !Buffer.isBuffer(key) || key.length<32 || Object.keys(budgets).some(k=>!Number.isInteger(limits[k]) || limits[k]<1 || limits[k]>10000))
    throw new Error('Invalid rate limit configuration');
  key=Buffer.from(key);limits={...limits};
  return {async take(scope,address) {
    if(!Object.hasOwn(budgets,scope) || !isIP(address??''))throw new Error('Missing trusted request address');
    const bucket=createHmac('sha256',key).update(scope+'\n'+address).digest('hex');
    return database.transaction(async c=>{
      const now=await clock(c);
      if(!Number.isSafeInteger(now) || now<0)throw new Error('Invalid server clock');
      const window=Math.floor(now/60000)*60000;
      const {rows}=await c.query(`INSERT INTO ck_request_limits (bucket_hash,window_ms,hits) VALUES ($1,$2,1)
        ON CONFLICT (bucket_hash,window_ms) DO UPDATE SET hits=LEAST(ck_request_limits.hits+1,$3)
        RETURNING hits`,[bucket,window,limits[scope]+1]);
      return rows[0].hits<=limits[scope];
    });
  }};
}
