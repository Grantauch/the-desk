// The general store: a check-in pays coins once, a charm can be bought, a purchase that costs more than the
// purse is refused, and a reload does not pay the day's coins again. A visitor's purse is not saved.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { signTicket } from './accounts.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = 31000 + Math.floor(Math.random() * 1000);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'checkaverse-shop-'));
const SHOP = JSON.parse(fs.readFileSync(path.join(HERE, 'content', 'shop.json'), 'utf8'));
const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(HERE, 'server.mjs')], {
  env: { ...process.env, CHECKAVERSE_PORT: String(PORT), CHECKAVERSE_DATA: DATA, CHECKAVERSE_ORIGINS: ORIGIN,
    CHECKAVERSE_KETTLE: path.join(DATA, 'no-kettle.json'), CHECKAVERSE_WEATHER: 'off' },
  stdio: 'pipe',
});
let serverLog = '';
child.stdout.on('data', (d) => { serverLog += d; });
child.stderr.on('data', (d) => { serverLog += d; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const step = (label) => console.log('  ok', label);

function client(ticket = null) {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`, { origin: ORIGIN });
  const inbox = [];
  ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', ticket })));
  ws.on('message', (d) => inbox.push(JSON.parse(d.toString())));
  const next = async (t, test = () => true, ms = 4000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const i = inbox.findIndex((m) => m.t === t && test(m));
      if (i >= 0) return inbox.splice(i, 1)[0];
      await sleep(20);
    }
    throw new Error(`timed out waiting for ${t}`);
  };
  const send = async (m) => { ws.send(JSON.stringify(m)); await sleep(250); };
  return { ws, inbox, next, send, open: new Promise((r, j) => { ws.on('open', r); ws.on('error', j); }) };
}

let failed = false;
try {
  for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${PORT}/health`); break; } catch { await sleep(100); } }
  const places = JSON.parse(fs.readFileSync(path.join(HERE, 'content', 'places.json'), 'utf8'));
  assert.equal(places.store.includes('still stocking'), false);
  assert.equal(places.store.includes('free for now'), false);
  const key = fs.readFileSync(path.join(DATA, 'ticket-key.txt'), 'utf8').trim();
  const now = Date.now();
  const ticket = (over = {}) => signTicket(key, { v: 1, p: 'ShopTrainerPid00000001', h: '1st Hour', d: '2026-11-02', c: true, n: 1, s: 1, b: 1,
    k: { s: 'mochi', n: 'Pip' }, iat: now, exp: now + 7_200_000, j: 'shop', ...over });
  const charm = SHOP.goods.find((g) => g.id === 'charm');
  const meal = SHOP.goods.find((g) => g.id === 'meal');

  const a = client(ticket()); await a.open;
  await a.next('welcome');
  await a.send({ t: 'shop' });
  const open = await a.next('shop');
  assert.equal(open.coins, SHOP.dayCoins, 'one check-in pays the daily allowance once');
  assert.ok(open.goods.some((g) => g.id === 'charm' && g.price === charm.price));
  a.ws.close(); await sleep(150);

  const b = client(ticket({ iat: Date.now() })); await b.open;
  await b.next('welcome');
  await b.send({ t: 'shop' });
  const again = await b.next('shop');
  assert.equal(again.coins, SHOP.dayCoins, 'a reload does not pay the same check-in twice');
  await b.send({ t: 'buy', id: 'charm' });
  const bought = await b.next('shop', (m) => m.ok);
  assert.equal(bought.coins, SHOP.dayCoins - charm.price);
  assert.equal(bought.goods.find((g) => g.id === 'charm').have, 1);
  const team = await b.next('team');
  assert.equal(team.charms, SHOP.freeCharmsPerDay + 1, 'a bought charm is added to the free daily throws');
  step('a charm can be bought');

  await b.send({ t: 'buy', id: 'charm' });
  const second = await b.next('shop', (m) => m.ok === true && m.goods.find((g) => g.id === 'charm').have === 2);
  assert.equal(second.coins, SHOP.dayCoins - charm.price * 2);
  assert.ok(second.coins < charm.price, 'two charms leave less than the price of a third');
  await b.send({ t: 'buy', id: 'charm' });
  const refused = await b.next('shop', (m) => m.ok === false);
  assert.ok(refused.coins < charm.price);
  assert.match(refused.msg, /costs/);
  const held = refused.goods.find((g) => g.id === 'charm').have;
  await b.send({ t: 'buy', id: 'meal' });
  const noMeal = await b.next('shop', (m) => m.ok === false && /meal/i.test(m.msg));
  assert.equal(noMeal.goods.find((g) => g.id === 'charm').have, held, 'a refused purchase changes nothing');
  step('a purchase that costs more than the purse is refused');

  b.ws.close(); await sleep(150);
  const c = client(ticket({ iat: Date.now() })); await c.open;
  await c.next('welcome');
  await c.send({ t: 'shop' });
  const kept = await c.next('shop');
  assert.equal(kept.coins, refused.coins, 'the reload did not pay the check-in again');
  assert.equal(kept.goods.find((g) => g.id === 'charm').have, held);
  step('a reload keeps the purse and the charms and does not pay twice');

  const rich = client(ticket({ p: 'ShopTrainerPid00000002', n: 2, iat: Date.now(), j: 'shop2' }));
  await rich.open;
  const back = await rich.next('welcome');
  await rich.send({ t: 'buy', id: 'meal' });
  const gotMeal = await rich.next('shop', (m) => m.ok);
  assert.equal(gotMeal.goods.find((g) => g.id === 'meal').have, 1);
  await rich.send({ t: 'body', id: back.partner });
  const before = await rich.next('body');
  assert.equal(before.body.bag.meal, 1);
  const fullness = before.body.stats.fullness;
  await rich.send({ t: 'care', id: back.partner, a: 'feed' });
  const fed = await rich.next('cared');
  assert.equal(fed.ok, true);
  assert.ok(fed.body.stats.fullness > fullness);
  assert.equal(fed.body.bag.meal, 0, 'Feed uses a bought meal');
  await rich.send({ t: 'buy', id: 'brush' });
  await rich.next('shop', (m) => m.ok && m.goods.find((g) => g.id === 'brush').have === 1);
  await rich.send({ t: 'care', id: back.partner, a: 'groom' });
  const groomed = await rich.next('cared', (m) => m.ok);
  assert.equal(groomed.body.bag.brush, 1, 'the brush is kept');
  rich.ws.close();
  step('the care panel uses a bought meal and keeps the brush');

  const visitor = client(); await visitor.open; await visitor.next('welcome');
  await visitor.send({ t: 'shop' });
  const purse0 = await visitor.next('shop');
  assert.equal(purse0.coins, SHOP.visitPurse);
  assert.equal(purse0.visit, true);
  await visitor.send({ t: 'buy', id: 'charm' });
  const spent = await visitor.next('shop', (m) => m.ok);
  assert.equal(spent.coins, SHOP.visitPurse - charm.price);
  visitor.ws.close(); await sleep(150);
  const nextVisitor = client(); await nextVisitor.open; await nextVisitor.next('welcome');
  await nextVisitor.send({ t: 'shop' });
  const fresh = await nextVisitor.next('shop');
  assert.equal(fresh.coins, SHOP.visitPurse);
  assert.equal(fresh.goods.find((g) => g.id === 'charm').have, 0, 'a visitor keeps nothing');
  step('a visitor can spend a purse and keeps nothing');

  assert.ok(meal.price <= SHOP.dayCoins);
  console.log('PASS general store');
} catch (err) {
  failed = true;
  console.error('FAIL', err.stack || err.message);
  console.error(serverLog.split('\n').slice(-25).join('\n'));
} finally {
  child.kill();
  await sleep(300);
  fs.rmSync(DATA, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
}
