import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {postgresDatabase} from './database.mjs';
import {storageContract} from './storage-contract.mjs';
import {authContract} from './auth-contract.mjs';
import {schoolContract} from './school-contract.mjs';

// Explicit synthetic-only opt-in. Every run uses a fresh private test schema.
const url=process.env.CHECKLINGS_TEST_DATABASE_URL;
if(!url || process.env.CHECKLINGS_TEST_DATABASE_PURPOSE!=='synthetic-only') throw new Error('Dedicated synthetic PostgreSQL test database must be explicitly configured');
if(new URL(url).pathname!=='/checklings_test') throw new Error('Refusing database without the expected test name');
const schema='ck_test_'+randomUUID().replaceAll('-','');
const admin=new pg.Pool({connectionString:url,max:1});
test('native PostgreSQL independent-client transactions and 35 simultaneous requests',async t=>{
  let pool;
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    pool=new pg.Pool({connectionString:url,max:35,options:`-c search_path=${schema}`});
    // Keep simultaneous physical connections open to prove this is not one serialized adapter.
    const clients=await Promise.all(Array.from({length:35},()=>pool.connect()));
    try {assert.equal(new Set((await Promise.all(clients.map(c=>c.query('SELECT pg_backend_pid() AS pid')))).map(r=>r.rows[0].pid)).size,35);}
    finally {clients.forEach(c=>c.release());}
    await storageContract(t,postgresDatabase(pool));
    await authContract(t,postgresDatabase(pool));
    await schoolContract(t,postgresDatabase(pool));
  } finally {
    if(pool)await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
});
