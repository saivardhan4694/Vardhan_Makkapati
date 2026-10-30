import { test } from "node:test";
import assert from "node:assert/strict";
import { consume, remaining, windowKey, type Bucket, type CounterStore, type Rule } from "../src/limits.ts";

function memStore(): CounterStore {
  const map = new Map<string, Bucket>();
  return {
    get: async (k) => map.get(k),
    put: async (k, v) => {
      map.set(k, v);
    },
  };
}

const T0 = Date.UTC(2026, 9, 30, 12, 0, 0);
const rules = (subject: string): Rule[] => [
  { name: "ip-short", subject, limit: 8, windowSec: 600 },
  { name: "ip-day", subject, limit: 30, windowSec: 86400 },
  { name: "global-day", subject: "*", limit: 100, windowSec: 86400 },
];

test("allows up to the short limit then blocks with retry-after", async () => {
  const s = memStore();
  for (let i = 0; i < 8; i++) assert.ok((await consume(s, rules("a"), T0 + i * 1000)).ok);
  const r = await consume(s, rules("a"), T0 + 9000);
  assert.equal(r.ok, false);
  assert.equal(r.blockedBy, "ip-short");
  assert.ok(r.retryAfterSec! > 0 && r.retryAfterSec! <= 600);
});

test("short window resets; daily limit still applies", async () => {
  const s = memStore();
  let now = T0;
  let allowed = 0;
  for (let i = 0; i < 100; i++) {
    if ((await consume(s, rules("a"), now)).ok) allowed++;
    now += 61_000; // ~1/min never trips 8 per 10 min
  }
  // 100 minutes from 12:00 UTC crosses no midnight: exactly the daily cap passes.
  assert.equal(allowed, 30);
  assert.equal((await consume(s, rules("a"), now)).blockedBy, "ip-day");
});

test("subjects are isolated; the global cap is shared", async () => {
  const s = memStore();
  const forIp = (ip: string): Rule[] => [
    { name: "ip", subject: ip, limit: 2, windowSec: 600 },
    { name: "global-day", subject: "*", limit: 3, windowSec: 86400 },
  ];
  assert.ok((await consume(s, forIp("a"), T0)).ok);
  assert.ok((await consume(s, forIp("a"), T0)).ok);
  assert.equal((await consume(s, forIp("a"), T0)).blockedBy, "ip");
  assert.ok((await consume(s, forIp("b"), T0)).ok);
  assert.equal((await consume(s, forIp("c"), T0)).blockedBy, "global-day");
});

test("all-or-nothing: a blocked request consumes nothing", async () => {
  const s = memStore();
  const r: Rule[] = [
    { name: "big", subject: "a", limit: 10, windowSec: 600 },
    { name: "small", subject: "a", limit: 1, windowSec: 600 },
  ];
  assert.ok((await consume(s, r, T0)).ok);
  assert.equal((await consume(s, r, T0)).ok, false);
  assert.equal(await remaining(s, r[0], T0), 9);
});

test("daily windows align to UTC midnight", async () => {
  const rule: Rule = { name: "d", subject: "*", limit: 1, windowSec: 86400 };
  const before = windowKey(rule, Date.UTC(2026, 9, 30, 23, 59, 59));
  const after = windowKey(rule, Date.UTC(2026, 9, 31, 0, 0, 1));
  assert.notEqual(before.key, after.key);
  assert.equal(before.exp, Date.UTC(2026, 9, 31));
  const s = memStore();
  assert.ok((await consume(s, [rule], Date.UTC(2026, 9, 30, 23, 59, 59))).ok);
  assert.ok((await consume(s, [rule], Date.UTC(2026, 9, 31, 0, 0, 1))).ok);
});

test("a zero cap blocks immediately", async () => {
  const r = await consume(memStore(), [{ name: "global-day", subject: "*", limit: 0, windowSec: 86400 }], T0);
  assert.equal(r.blockedBy, "global-day");
});

test("keys contain only the hashed subject", () => {
  const { key } = windowKey({ name: "ip-day", subject: "abc123", limit: 1, windowSec: 86400 }, T0);
  assert.match(key, /^rl:ip-day:abc123:\d+$/);
});
