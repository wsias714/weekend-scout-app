import test from "node:test";
import assert from "node:assert/strict";
import { enqueue, flush, overlay } from "./queue.ts";
import { ConflictError } from "./remote.ts";
import type { Remote } from "./remote.ts";
import type { Feed, InboxItem } from "../types.ts";

const go: InboxItem = { type: "decision", event_id: "e1", decision: "go", homeschool: true, at: "2026-10-17T10:00:00" };
const fake = (fail?: (p: string) => Error | null) => {
  const files = new Map<string, string>();
  const r: Remote = {
    async read() { return null; },
    async create(p, t) {
      const e = fail?.(p); if (e) throw e;
      if (files.has(p)) throw new ConflictError();
      files.set(p, t);
    },
  };
  return { r, files };
};

test("flush sends once and empties the queue", async () => {
  const { r, files } = fake();
  const q = enqueue([], go, () => 0.5);
  const res = await flush(q, r);
  assert.equal(res.sent, 1); assert.equal(res.pending.length, 0); assert.equal(files.size, 1);
});

test("a failed send stays queued, in order, and is retried", async () => {
  let down = true;
  const { r, files } = fake(() => (down ? new Error("offline") : null));
  let q = enqueue([], go, () => 0.1);
  q = enqueue(q, { ...go, event_id: "e2" }, () => 0.2);
  const a = await flush(q, r);
  assert.equal(a.pending.length, 2); assert.equal(a.error, "offline");
  down = false;
  const b = await flush(a.pending, r);
  assert.equal(b.sent, 2); assert.equal(files.size, 2);
});

test("a retried file that already landed counts as delivered", async () => {
  const { r } = fake();
  const q = enqueue([], go, () => 0.3);
  await flush(q, r);
  const again = await flush(q, r);
  assert.equal(again.sent, 1); assert.equal(again.pending.length, 0);
});

test("overlay shows queued taps over the laptop's state", () => {
  const feed = { decisions: { e1: { decision: "maybe", homeschool: false, attended: null } } } as unknown as Feed;
  const o = overlay(feed, enqueue([], go));
  assert.equal(o.e1.decision, "go"); assert.equal(o.e1.homeschool, true);
});
