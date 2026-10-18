import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Decision, EvergreenItem, Feed, InboxItem, ScoutEvent, SectionKey } from "./types.ts";
import * as dbx from "./lib/dropbox.ts";
import { enqueue, flush, overlay } from "./lib/queue.ts";
import type { Queued } from "./lib/queue.ts";
import { drive, isWeekend, when } from "./lib/format.ts";
import SourcesView from "./Sources.tsx";
import Timeline from "./Timeline.tsx";
import { resetApp } from "./Boundary.tsx";

const K = { feed: "ws-feed", queue: "ws-queue" };
const read = <T,>(k: string, d: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : d;
  } catch {
    return d;
  }
};
const save = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* private mode: the app still works for this session */
  }
};

type Kind = "family" | "date_night" | "plan_ahead" | "evergreen" | "sources";
type When = "this_weekend" | "next_2_weeks" | "weeks_3_4" | "homeschool_day_trips";
const KINDS: { key: Kind; label: string }[] = [
  { key: "family", label: "Family" },
  { key: "date_night", label: "Date night" },
  { key: "plan_ahead", label: "Plan ahead" },
  { key: "evergreen", label: "Evergreen" },
  { key: "sources", label: "Sources" },
];
const WHENS: { key: When; label: string }[] = [
  { key: "this_weekend", label: "This weekend" },
  { key: "next_2_weeks", label: "Next 2 wks" },
  { key: "weeks_3_4", label: "Weeks 3–4" },
  { key: "homeschool_day_trips", label: "Weekdays" },
];

const EMPTY: Record<SectionKey, string> = {
  did_you_go: "", this_weekend: "Nothing strong this weekend.", next_2_weeks: "Nothing in the next two weeks yet.",
  weeks_3_4: "Nothing in weeks 3–4 yet.", homeschool_day_trips: "No weekday outings this week.",
  date_night: "No date-night picks yet. They appear once newsletters are read for events.",
  plan_ahead: "Nothing to plan ahead for yet.", evergreen: "No evergreen ideas yet.", sources: "",
};

type Status = { kind: "demo" | "ok" | "offline" | "error"; at?: number; msg?: string };

export default function App() {
  const [feed, setFeed] = useState<Feed | null>(() => read<Feed | null>(K.feed, null));
  const [queue, setQueue] = useState<Queued[]>(() => read<Queued[]>(K.queue, []));
  const [kind, setKind] = useState<Kind>("family");
  const [when_, setWhen] = useState<When>("this_weekend");
  const tab: SectionKey = kind === "family" ? when_ : kind;
  const [freeOnly, setFreeOnly] = useState(false);
  const [weekendOnly, setWeekendOnly] = useState(false);
  const [sheet, setSheet] = useState<ScoutEvent | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "demo" });
  const [connected, setConnected] = useState(dbx.isConnected());
  const [undo, setUndo] = useState<ScoutEvent | null>(null);
  const [view, setView] = useState<"list" | "timeline">(() => read<"list" | "timeline">("ws-view", "list"));
  const [detail, setDetail] = useState<ScoutEvent | null>(null);
  const pickView = (v: "list" | "timeline") => { setView(v); save("ws-view", v); };

  const syncing = useRef<Promise<void> | null>(null);
  const sync = useCallback((q: Queued[]): Promise<void> => {
    // one sync at a time; a call that arrives mid-sync waits and then re-reads the stored queue
    const run = (syncing.current ?? Promise.resolve()).then(() => doSync(q.length ? q : read<Queued[]>(K.queue, [])));
    syncing.current = run.catch(() => undefined);
    return run;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed, connected]);
  const doSync = async (snapshot: Queued[]) => {
    const q = read<Queued[]>(K.queue, snapshot);
    if (!dbx.isConnected()) {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}sample-events.json`);
        if (res.ok) {
          const sample = (await res.json()) as Feed;
          if (!feed || feed.generated < sample.generated) { setFeed(sample); save(K.feed, sample); }
        }
      } catch {
        /* no sample bundled */
      }
      setStatus({ kind: "demo" });
      return;
    }
    try {
      const remote = dbx.dropboxRemote();
      const out = await flush(q, remote);
      // taps added while we were sending are in storage but not in `q`: keep them
      const sentKeys = new Set(q.map((x) => x.key));
      const stillPending = new Set(out.pending.map((x) => x.key));
      const latest = read<Queued[]>(K.queue, []).filter((x) => !sentKeys.has(x.key) || stillPending.has(x.key));
      setQueue(latest);
      save(K.queue, latest);
      const file = await remote.read("/events.json");
      if (file) {
        const f = JSON.parse(file.text) as Feed;
        setFeed(f);
        save(K.feed, f);
      } else {
        throw new Error(`events.json not found. ${await dbx.describeFolder()}`);
      }
      setStatus(out.error ? { kind: "error", msg: out.error } : { kind: "ok", at: Date.now() });
    } catch (e) {
      setStatus({ kind: navigator.onLine ? "error" : "offline", msg: e instanceof Error ? e.message : String(e) });
    }
  };

  useEffect(() => {
    dbx.finishAuthFromUrl().then((r) => r === "connected" && setConnected(true)).catch((e) => setStatus({ kind: "error", msg: String(e) }));
  }, []);
  useEffect(() => {
    void sync(queue);
    const onVis = () => document.visibilityState === "visible" && void sync(read<Queued[]>(K.queue, []));
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  const send = (item: InboxItem) => {
    if (!connected) { setShowSettings(true); return; }   // demo data: nothing to send taps to
    const q = enqueue(queue, item);
    setQueue(q);
    save(K.queue, q);
    void sync(q);
  };
  const decide = (ev: ScoutEvent, decision: Decision, homeschool = false) => {
    send({ type: "decision", event_id: ev.id, decision, homeschool, at: new Date().toISOString() });
    if (decision === "pass" && connected) {
      setUndo(ev);
      window.setTimeout(() => setUndo((u) => (u?.id === ev.id ? null : u)), 6000);
    }
  };
  const attended = (ev: ScoutEvent, value: "yes" | "no") =>
    send({ type: "attended", event_id: ev.id, value, at: new Date().toISOString() });

  const state = useMemo(() => overlay(feed, queue), [feed, queue]);
  const items = useMemo(() => {
    const list = tab === "evergreen" || tab === "sources" ? [] : feed?.sections[tab] ?? [];
    return list.filter((e) => (!freeOnly || e.cost === "Free") && (!weekendOnly || isWeekend(e.start)))
      .filter((e) => state[e.id]?.decision !== "pass");
  }, [feed, tab, freeOnly, weekendOnly, state]);
  const askWent = (feed?.sections.did_you_go ?? []).filter((e) => !state[e.id]?.attended);

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>Weekend Scout</h1>
          <p className="sub">{feed ? `Updated ${new Date(feed.generated).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}` : "Loading…"}
            {feed && Date.now() - new Date(feed.generated).getTime() > 36 * 3600e3 && <b className="stale"> · may be out of date</b>}</p>
        </div>
        <button className="pill" onClick={() => setShowSettings(true)} aria-label="Sync settings">
          <span className={`dot ${status.kind}`} />
          {status.kind === "demo" ? "Demo" : status.kind === "ok" ? "Synced" : status.kind === "offline" ? "Offline" : "Sync issue"}
          {queue.length > 0 && <b> · {queue.length} waiting</b>}
        </button>
      </header>

      {askWent.length > 0 && (
        <section className="went" aria-label="Did you go?">
          <h2>Did you go?</h2>
          {askWent.map((e) => (
            <div className="went-row" key={e.id}>
              <span>{e.title}<small> {when(e.start)}</small></span>
              <span className="went-btns">
                <button onClick={() => attended(e, "yes")} aria-label={`Went to ${e.title}`}>✅ Went</button>
                <button onClick={() => attended(e, "no")} aria-label={`Skipped ${e.title}`}>❌ Skipped</button>
              </span>
            </div>
          ))}
        </section>
      )}

      <div className="nav">
        <div className="seg kinds" role="tablist" aria-label="What">
          {KINDS.map((k) => {
            return (
              <button key={k.key} role="tab" aria-selected={kind === k.key} className={kind === k.key ? "on" : ""} onClick={() => setKind(k.key)}>
                {k.label}
              </button>
            );
          })}
        </div>
        {kind === "family" && (
          <div className="seg whens" role="tablist" aria-label="When">
            {WHENS.map((w) => (
              <button key={w.key} role="tab" aria-selected={when_ === w.key} className={when_ === w.key ? "on" : ""} onClick={() => setWhen(w.key)}>
                {w.label}<span className="n">{feed?.sections[w.key]?.length ?? 0}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="filters">
        {kind !== "evergreen" && kind !== "sources" && (<>
          <label><input type="checkbox" checked={freeOnly} onChange={(e) => setFreeOnly(e.target.checked)} /> Free</label>
          {tab !== "this_weekend" && (
            <label><input type="checkbox" checked={weekendOnly} onChange={(e) => setWeekendOnly(e.target.checked)} /> Weekend</label>
          )}
          <span className="view" role="group" aria-label="View">
            <button className={view === "list" ? "on" : ""} onClick={() => pickView("list")}>List</button>
            <button className={view === "timeline" ? "on" : ""} onClick={() => pickView("timeline")}>Timeline</button>
          </span>
        </>)}
      </div>
      {connected && (status.kind === "error" || status.kind === "offline") && (
        <div className="banner err-banner" role="alert">
          <span>{status.kind === "offline" ? "You're offline. Showing the last saved list." : `Couldn't sync: ${status.msg ?? "unknown error"}`}</span>
          <button onClick={() => void sync(queue)}>Retry</button>
        </div>
      )}
      {connected && !feed && status.kind !== "error" && <p className="empty">Loading your list…</p>}
      {!connected && (
        <div className="banner">
          <span>Demo picks only. Connect Dropbox for this week's real list.</span>
          <button className="go" onClick={() => void beginAuth(setStatus)}>Connect</button>
        </div>
      )}

      <main>
        {tab === "evergreen" && <Evergreen items={feed?.sections.evergreen ?? []} />}
        {tab === "sources" && <SourcesView feed={feed} queue={queue} connected={connected}
          onSuggest={(url, note) => send({ type: "source", url, note, at: new Date().toISOString() })} />}
        {tab !== "evergreen" && tab !== "sources" && items.length === 0 && (
          <p className="empty">
            {freeOnly || weekendOnly ? "Nothing here with those filters." : EMPTY[tab]}
          </p>
        )}
        {tab !== "evergreen" && tab !== "sources" && view === "timeline" && items.length > 0 && (
          <Timeline items={items} onOpen={setDetail} status={(id) => state[id]?.decision} />
        )}
        {tab !== "evergreen" && tab !== "sources" && view === "list" && items.map((e) => (
          <Card key={e.id} ev={e} st={state[e.id]} onDecide={(d) => (!connected ? setShowSettings(true) : d === "go" ? setSheet(e) : decide(e, d))} />
        ))}
      </main>

      {undo && (
        <div className="snack" role="status">
          <span>Passed “{undo.title}”</span>
          <button onClick={() => { decide(undo, "maybe"); setUndo(null); }}>Undo</button>
        </div>
      )}
      {detail && (
        <div className="scrim" onClick={() => setDetail(null)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Event details" onClick={(e) => e.stopPropagation()}>
            <Card ev={detail} st={state[detail.id]} onDecide={(d) => {
              if (!connected) { setDetail(null); setShowSettings(true); return; }
              setDetail(null);
              if (d === "go") setSheet(detail); else decide(detail, d);
            }} />
            <div className="sheet-actions"><button onClick={() => setDetail(null)}>Close</button></div>
          </div>
        </div>
      )}
      {sheet && (
        <GoSheet ev={sheet} onClose={() => setSheet(null)} onConfirm={(hs) => { decide(sheet, "go", hs); setSheet(null); }} />
      )}
      {showSettings && (
        <Settings status={status} connected={connected} queue={queue.length} onSync={() => void sync(queue)}
          onClose={() => setShowSettings(false)} onChange={() => setConnected(dbx.isConnected())} />
      )}
    </div>
  );
}

async function share(ev: ScoutEvent) {
  const text = `${ev.title}, ${when(ev.start)}${ev.venue ? ` at ${ev.venue}` : ""}${ev.city ? `, ${ev.city}` : ""}${ev.link ? `\n${ev.link}` : ""}`;
  try {
    if (navigator.share) await navigator.share({ title: ev.title, text });
    else await navigator.clipboard.writeText(text);
  } catch {
    /* share sheet dismissed */
  }
}

const LABEL: Record<Decision, string> = { go: "On the calendar", maybe: "Maybe", pass: "Passed", bookmarked: "Planning ahead" };

function Card({ ev, st, onDecide }: { ev: ScoutEvent; st?: { decision?: Decision; homeschool?: boolean }; onDecide: (d: Decision) => void }) {
  const d = st?.decision;
  return (
    <article className={`card ${d ?? ""}`}>
      <div className="when">{when(ev.start)}</div>
      <h3>{ev.title}</h3>
      <div className="meta">
        {[ev.venue, ev.city].filter(Boolean).join(" · ")}
      </div>
      <div className="chips">
        <span className={`chip ${ev.cost === "Free" ? "free" : ""}`}>{ev.cost}</span>
        <span className="chip">Ages {ev.age_fit}</span>
        {drive(ev.drive_min) && <span className="chip">{drive(ev.drive_min)}</span>}
        {ev.registration !== "none" && <span className="chip warn">Register: {ev.registration}</span>}
        {ev.homeschool_subjects.map((s) => <span className="chip subj" key={s}>{s}</span>)}
      </div>
      {ev.summary && <p className="sum">{ev.summary}</p>}
      {(ev.homeschool_hook || ev.why) && <p className="why">{ev.homeschool_hook || ev.why}</p>}
      <div className="linkrow">
        {ev.link && <a className="evlink" href={ev.link} target="_blank" rel="noreferrer">{ev.link_kind === "event" ? "Event page" : "Website"} ↗</a>}
        <button className="link" onClick={() => void share(ev)}>Share</button>
      </div>
      {d ? (
        <div className="state">
          <b>{LABEL[d]}{d === "go" && st?.homeschool ? " · homeschool" : ""}</b>
          <button className="link" onClick={() => onDecide(d === "go" ? "maybe" : "go")}>change</button>
        </div>
      ) : (
        <div className="actions">
          <button className="go" onClick={() => onDecide("go")}>Go</button>
          <button onClick={() => onDecide("maybe")}>Maybe</button>
          <button onClick={() => onDecide("pass")}>Pass</button>
          <button onClick={() => onDecide("bookmarked")} aria-label="Plan ahead">Plan ahead</button>
        </div>
      )}
    </article>
  );
}

function GoSheet({ ev, onClose, onConfirm }: { ev: ScoutEvent; onClose: () => void; onConfirm: (homeschool: boolean) => void }) {
  const hasSubj = ev.homeschool_subjects.length > 0;
  const [hs, setHs] = useState(hasSubj && ev.audience === "family");
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Add to calendar" onClick={(e) => e.stopPropagation()}>
        <h2>Add to calendar</h2>
        <p><b>{ev.title}</b><br />{when(ev.start)} · {ev.city}</p>
        {ev.audience === "family" && (
          <label className="toggle">
            <input type="checkbox" checked={hs} onChange={(e) => setHs(e.target.checked)} />
            <span>🏫 Counts as homeschool{hasSubj ? ` (${ev.homeschool_subjects.join(", ")})` : ""}</span>
          </label>
        )}
        <p className="note">Julie is invited automatically.</p>
        <div className="sheet-actions">
          <button onClick={onClose}>Cancel</button>
          <button className="go" onClick={() => onConfirm(hs)}>Add to calendar</button>
        </div>
      </div>
    </div>
  );
}

/** Straight to Dropbox sign-in with the built-in app key (no sheet, no typing). */
async function beginAuth(setStatus: (s: Status) => void) {
  try {
    window.location.href = await dbx.startAuth(false);
  } catch (e) {
    setStatus({ kind: "error", msg: e instanceof Error ? e.message : String(e) });
  }
}

function Evergreen({ items }: { items: EvergreenItem[] }) {
  if (items.length === 0) return <p className="empty">{EMPTY.evergreen}</p>;
  return (
    <>
      <p className="note">Always-on ideas with no date. Not added to the calendar.</p>
      {items.map((i) => (
        <article className="card ever" key={i.id}>
          <div className="when">{i.kind}{i.city ? ` · ${i.city}` : ""}</div>
          <h3>{i.name}</h3>
          <div className="chips">{i.member && <span className="chip mem">Member</span>}</div>
          <p className="sum">{i.note}</p>
          {i.url && <a className="open" href={i.url} target="_blank" rel="noreferrer">Open website</a>}
        </article>
      ))}
    </>
  );
}

function Settings({ status, connected, queue, onClose, onChange, onSync }: {
  status: Status; connected: boolean; queue: number; onClose: () => void; onChange: () => void; onSync: () => void;
}) {
  const [key, setKey] = useState(dbx.getAppKey());
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const connect = async (manual: boolean) => {
    try {
      dbx.setAppKey(key);
      const url = await dbx.startAuth(manual);
      window.location.href = url;
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Sync settings" onClick={(e) => e.stopPropagation()}>
        <h2>Sync</h2>
        <p>{connected ? "Connected to Dropbox." : "Showing demo data. Connect Dropbox to see this week's picks and send your taps."}</p>
        <p className="note">{queue} tap{queue === 1 ? "" : "s"} waiting to send. Status: {status.kind}{status.msg ? ` (${status.msg})` : ""}.</p>
        <p className="note">Build {__BUILD__} · key …{dbx.getAppKey().slice(-4)} · {connected ? "connected" : "not connected"}</p>
        {!connected && (
          <>
            <div className="sheet-actions">
              <button className="go" disabled={!key.trim()} onClick={() => connect(false)}>Connect Dropbox</button>
            </div>
            <details>
              <summary>Advanced: Dropbox app key</summary>
              <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="app key" autoCapitalize="off" />
            </details>
            <details>
              <summary>Redirect didn't come back?</summary>
              <button onClick={() => connect(true)} disabled={!key.trim()}>Get a code</button>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="paste code" />
              <button disabled={!code.trim()} onClick={async () => { try { await dbx.finishAuthWithCode(code); onChange(); } catch (e) { setErr(String(e)); } }}>Finish</button>
            </details>
          </>
        )}
        {connected && <div className="sheet-actions"><button className="go" onClick={onSync}>Sync now</button><button onClick={() => { dbx.disconnect(); onChange(); }}>Disconnect</button></div>}
        {err && <p className="err">{err}</p>}
        <div className="sheet-actions"><button onClick={() => void resetApp()}>Reset app (keeps Dropbox login)</button></div>
        <div className="sheet-actions"><button onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}
