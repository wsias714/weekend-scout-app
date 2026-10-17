import type { ScoutEvent } from "./types.ts";
import { clock, dayLabel, minutesOf } from "./lib/format.ts";

const PX = 52; // pixels per hour

interface Block { ev: ScoutEvent; s: number; e: number; col: number; cols: number }

/** Greedy column layout so overlapping events sit side by side. */
function layout(evs: ScoutEvent[]): Block[] {
  const bs = evs
    .map((ev) => {
      const s = minutesOf(ev.start) as number;
      const e = Math.max(minutesOf(ev.end) ?? s + 60, s + 30);
      return { ev, s, e, col: 0, cols: 1 };
    })
    .sort((a, b) => a.s - b.s || a.e - b.e);
  let cluster: Block[] = [];
  let clusterEnd = -1;
  const close = () => {
    const cols = Math.max(0, ...cluster.map((b) => b.col)) + 1;
    cluster.forEach((b) => (b.cols = cols));
    cluster = [];
  };
  for (const b of bs) {
    if (cluster.length && b.s >= clusterEnd) close();
    const used = new Set(cluster.filter((o) => o.e > b.s).map((o) => o.col));
    while (used.has(b.col)) b.col++;
    cluster.push(b);
    clusterEnd = Math.max(clusterEnd, b.e);
  }
  close();
  return bs;
}

export default function Timeline({ items, onOpen, status }: {
  items: ScoutEvent[]; onOpen: (e: ScoutEvent) => void; status: (id: string) => string | undefined;
}) {
  const days = new Map<string, ScoutEvent[]>();
  for (const e of [...items].sort((a, b) => a.start.localeCompare(b.start))) {
    const k = e.start.slice(0, 10);
    days.set(k, [...(days.get(k) ?? []), e]);
  }
  return (
    <div className="tl">
      {[...days].map(([day, evs]) => {
        const timed = evs.filter((e) => minutesOf(e.start) !== null);
        const allDay = evs.filter((e) => minutesOf(e.start) === null);
        const blocks = layout(timed);
        const first = blocks.length ? Math.floor(Math.min(...blocks.map((b) => b.s)) / 60) : 9;
        const last = blocks.length ? Math.ceil(Math.max(...blocks.map((b) => b.e)) / 60) : 10;
        const from = Math.max(0, first - 1), to = Math.min(24, Math.max(last + 1, from + 3));
        const hours = Array.from({ length: to - from + 1 }, (_, i) => from + i);
        return (
          <section className="tl-day" key={day}>
            <h3>{dayLabel(day)}</h3>
            {allDay.map((e) => (
              <button className="tl-allday" key={e.id} onClick={() => onOpen(e)}>All day · {e.title}</button>
            ))}
            {blocks.length > 0 && (
              <div className="tl-grid" style={{ height: (to - from) * PX }}>
                {hours.map((h) => (
                  <div className="tl-hour" key={h} style={{ top: (h - from) * PX }}>
                    <span>{clock(h * 60)}</span>
                  </div>
                ))}
                {blocks.map((b) => (
                  <button
                    key={b.ev.id}
                    className={`tl-ev ${status(b.ev.id) ?? ""}`}
                    style={{
                      top: (b.s / 60 - from) * PX, height: Math.max(((b.e - b.s) / 60) * PX - 2, 30),
                      left: `calc(46px + (100% - 46px) * ${b.col / b.cols})`,
                      width: `calc((100% - 46px) / ${b.cols} - 3px)`,
                    }}
                    onClick={() => onOpen(b.ev)}
                    aria-label={`${b.ev.title}, ${clock(b.s)} to ${clock(b.e)}`}
                  >
                    <b>{clock(b.s)}</b> {b.ev.title}
                    {b.cols === 1 && b.e - b.s >= 60 && <small>{b.ev.venue || b.ev.city}</small>}
                  </button>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
