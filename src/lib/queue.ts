import type { Decision, Feed, InboxItem } from "../types.ts";
import { ConflictError } from "./remote.ts";
import type { Remote } from "./remote.ts";

/* Outgoing taps are queued locally and flushed as write-once files under /inbox.
   A tap is never lost: it stays queued until Dropbox confirms the file exists. */

export const INBOX = "/inbox";

export interface Queued {
  key: string; // unique file stem
  item: InboxItem;
}

export const newKey = (item: InboxItem, rand = Math.random) =>
  `${item.at.replace(/[^0-9]/g, "")}-${item.type === "source" ? "source" : item.event_id}-${Math.floor(rand() * 1e6).toString(36)}`;

export function enqueue(q: Queued[], item: InboxItem, rand = Math.random): Queued[] {
  return [...q, { key: newKey(item, rand), item }];
}

/** Send what we can. Returns the still-pending queue plus how many went out. */
export async function flush(q: Queued[], remote: Remote): Promise<{ pending: Queued[]; sent: number; error?: string }> {
  const pending: Queued[] = [];
  let sent = 0;
  let error: string | undefined;
  for (const entry of q) {
    if (error) {
      pending.push(entry); // keep order after the first failure
      continue;
    }
    try {
      await remote.create(`${INBOX}/${entry.key}.json`, JSON.stringify(entry.item));
      sent++;
    } catch (e) {
      if (e instanceof ConflictError) {
        sent++; // an identical key already landed: treat as delivered
      } else {
        error = e instanceof Error ? e.message : String(e);
        pending.push(entry);
      }
    }
  }
  return { pending, sent, error };
}

export type StateMap = Record<string, { decision?: Decision; homeschool?: boolean; attended?: string | null }>;

/** What the cards should show: the laptop's last-known state, overlaid with taps not yet applied. */
export function overlay(feed: Feed | null, q: Queued[]): StateMap {
  const out: StateMap = {};
  for (const [id, d] of Object.entries(feed?.decisions ?? {})) out[id] = { ...d };
  for (const { item } of q) {
    if (item.type === "source") continue;
    const cur = (out[item.event_id] ??= {});
    if (item.type === "decision") {
      cur.decision = item.decision;
      cur.homeschool = item.homeschool;
    } else cur.attended = item.value;
  }
  return out;
}
