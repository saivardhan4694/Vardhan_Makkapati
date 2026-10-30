// Durable Object wrapper around the pure counting logic in limits.ts.
// See limits.ts for why a single SQLite-backed DO is the store.

import { DurableObject } from "cloudflare:workers";
import { consume, remaining, type Bucket, type CounterStore, type LimitResult, type Rule } from "./limits.ts";

export interface PendingContact {
  name: string;
  email: string;
  message: string;
  /** Hashed IP of the visitor who requested it; must match on confirm. */
  subject: string;
  exp: number;
}

const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

export class Limiter extends DurableObject {
  private store: CounterStore = {
    get: (key) => this.ctx.storage.get<Bucket>(key),
    put: (key, value) => this.ctx.storage.put(key, value),
  };

  async hit(rules: Rule[], cost = 1): Promise<LimitResult> {
    await this.ensureAlarm();
    return consume(this.store, rules, Date.now(), cost);
  }

  async left(rule: Rule): Promise<number> {
    return remaining(this.store, rule, Date.now());
  }

  async putPending(id: string, p: PendingContact): Promise<void> {
    await this.ensureAlarm();
    await this.ctx.storage.put(`pc:${id}`, p);
  }

  /** Returns and deletes the pending handoff (single use). */
  async takePending(id: string, subject: string): Promise<PendingContact | null> {
    const key = `pc:${id}`;
    const p = await this.ctx.storage.get<PendingContact>(key);
    if (!p) return null;
    if (p.exp <= Date.now() || p.subject !== subject) {
      if (p.exp <= Date.now()) await this.ctx.storage.delete(key);
      return null;
    }
    await this.ctx.storage.delete(key);
    return p;
  }

  private async ensureAlarm() {
    if ((await this.ctx.storage.getAlarm()) === null) {
      await this.ctx.storage.setAlarm(Date.now() + CLEANUP_INTERVAL_MS);
    }
  }

  /** Periodically drops expired windows and stale handoffs. */
  async alarm(): Promise<void> {
    const now = Date.now();
    const all = await this.ctx.storage.list<{ exp?: number }>();
    const dead: string[] = [];
    for (const [k, v] of all) if (typeof v?.exp === "number" && v.exp <= now) dead.push(k);
    for (let i = 0; i < dead.length; i += 128) await this.ctx.storage.delete(dead.slice(i, i + 128));
    if (all.size - dead.length > 0) await this.ctx.storage.setAlarm(now + CLEANUP_INTERVAL_MS);
  }
}
