// Rate limiting + budget caps + pending contact handoffs, all in ONE
// SQLite-backed Durable Object instance.
//
// Why a Durable Object (and not KV or the Rate Limiting binding):
//  - KV is eventually consistent and the free plan allows ~1k writes/day,
//    so per-message counters would both race and exhaust the write quota.
//  - The Workers Rate Limiting binding only supports 10s/60s periods, so it
//    can't express "30/day" or a global daily budget.
//  - A single DO is strongly consistent (requests are serialized), free-plan
//    eligible when SQLite-backed, and a portfolio's traffic is far below what
//    one instance handles.
//
// The counting logic is a pure function over a tiny store interface so the
// unit tests exercise exactly the code the DO runs.

export interface Rule {
  /** Logical bucket name, e.g. "ip-short", "ip-day", "global-day". */
  name: string;
  /** Subject: hashed IP, or "*" for global buckets. Never a raw IP. */
  subject: string;
  limit: number;
  windowSec: number;
}

export interface LimitResult {
  ok: boolean;
  /** Rule that rejected the request, if any. */
  blockedBy?: string;
  /** Seconds until the blocking window resets. */
  retryAfterSec?: number;
}

export interface Bucket {
  count: number;
  /** Epoch ms at which this window ends (and the key may be deleted). */
  exp: number;
}

export interface CounterStore {
  get(key: string): Promise<Bucket | undefined>;
  put(key: string, value: Bucket): Promise<void>;
}

/** Fixed windows aligned to the epoch (daily windows = UTC days). */
export function windowKey(rule: Rule, nowMs: number): { key: string; exp: number } {
  const w = rule.windowSec * 1000;
  const idx = Math.floor(nowMs / w);
  return { key: `rl:${rule.name}:${rule.subject}:${idx}`, exp: (idx + 1) * w };
}

/**
 * All-or-nothing: if any rule is exhausted nothing is consumed, otherwise
 * every rule's counter is incremented by `cost`.
 */
export async function consume(
  store: CounterStore,
  rules: Rule[],
  nowMs: number,
  cost = 1
): Promise<LimitResult> {
  const slots = rules.map((r) => ({ rule: r, ...windowKey(r, nowMs) }));
  const current: Bucket[] = [];
  for (const s of slots) {
    const b = await store.get(s.key);
    const bucket = b && b.exp > nowMs ? b : { count: 0, exp: s.exp };
    if (bucket.count + cost > s.rule.limit) {
      return {
        ok: false,
        blockedBy: s.rule.name,
        retryAfterSec: Math.max(1, Math.ceil((bucket.exp - nowMs) / 1000)),
      };
    }
    current.push(bucket);
  }
  for (let i = 0; i < slots.length; i++) {
    await store.put(slots[i].key, { count: current[i].count + cost, exp: slots[i].exp });
  }
  return { ok: true };
}

/** Read-only view of a bucket's remaining capacity (for health/status). */
export async function remaining(store: CounterStore, rule: Rule, nowMs: number): Promise<number> {
  const { key } = windowKey(rule, nowMs);
  const b = await store.get(key);
  const used = b && b.exp > nowMs ? b.count : 0;
  return Math.max(0, rule.limit - used);
}
