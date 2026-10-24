import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {storageContract} from './storage-contract.mjs';
import {authContract} from './auth-contract.mjs';
import {schoolContract} from './school-contract.mjs';

test('embedded PostgreSQL storage contract (serialized, not distributed concurrency)',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'checklings-synthetic-'));
  let db=await PGlite.create(directory);
  try {
    await storageContract(t,{transaction:work=>db.transaction(work)});
    await authContract(t,{transaction:work=>db.transaction(work)});
    await schoolContract(t,{transaction:work=>db.transaction(work)});
    const before=(await db.query('SELECT count(*)::int AS n FROM ck_creatures')).rows;
    const archive=await db.dumpDataDir('none');
    await db.close();db=await PGlite.create(directory);
    assert.deepEqual((await db.query('SELECT count(*)::int AS n FROM ck_creatures')).rows,before,'persisted directory survives close/reopen');
    const restored=await PGlite.create({loadDataDir:archive});
    try {
      assert.deepEqual((await restored.query('SELECT count(*)::int AS n FROM ck_creatures')).rows,before);
      for(const table of ['ck_creatures','ck_events','ck_command_receipts','ck_launch_flows','ck_launch_assertions','ck_sessions','ck_request_limits','ck_school_classes','ck_school_access_events']) {
        assert.deepEqual((await restored.query(`SELECT * FROM ${table} ORDER BY 1,2`)).rows,(await db.query(`SELECT * FROM ${table} ORDER BY 1,2`)).rows);
      }
    } finally {await restored.close();}
  } finally {await db.close();await rm(directory,{recursive:true,force:true});}
});
