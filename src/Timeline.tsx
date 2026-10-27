import type { ScoutEvent } from "./types.ts";
import { clock, dayLabel, minutesOf } from "./lib/format.ts";
import { brief, hint } from "./lib/weather.ts";
import type { Forecast } from "./lib/weather.ts";

const PX = 52; // pixels per hour
const GAP = 26; // pixels for a collapsed stretch of empty hours

interface Block { ev: ScoutEvent; s: number; e: number; col: number; cols: number }

/** Greedy column layout so overlapping events sit side by side. */
function layout(evs: ScoutEvent[]): Block[] {
  const bs = evs
    .map((ev) => {
      const s = minutesOf(ev.start) as number;
      const end = minutesOf(ev.end);
      // an end before the start ran past midnight; an end 8+ hours out is a feed slip (a storytime "until 11:30 pm")
      const e = Math.max(end === null || end - s > 8 * 60 ? s + 90 : end <= s ? 24 * 60 : end, s + 30);
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

/** Hour ranges worth drawing: each event's span, merged when closer than 2 empty hours. Quiet stretches collapse to a gap. */
function segments(blocks: Block[]): { from: number; to: number; top: number }[] {
  const spans = blocks.map((b) => [Math.max(0, Math.floor(b.s / 60) - 1), Math.min(24, Math.ceil(b.e / 60) + 1)]).sort((a, b) => a[0] - b[0]);
  const out: { from: number; to: number; top: number }[] = [];
  for (const [f, t] of spans) {
    const last = out[out.length - 1];
    if (last && f <= last.to) last.to = Math.max(last.to, t);
    else out.push({ from: f, to: t, top: 0 });
  }
  let y = 0;
  for (const g of out) { g.top = y; y += (g.to - g.from) * PX + GAP; }
  return out;
}

export default function Timeline({ items, onOpen, status, fc }: {
  fc: Forecast; items: ScoutEvent[]; onOpen: (e: ScoutEvent) => void; status: (id: string) => string | undefined;
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
        const crowded = blocks.some((b) => b.cols > 2);   // 3+ side by side leaves no room to read a title
        const segs = segments(blocks);
        const yOf = (min: number) => {
          const g = segs.find((x) => min / 60 >= x.from && min / 60 <= x.to) ?? segs[segs.length - 1];
          return g.top + (min / 60 - g.from) * PX;
        };
        const height = segs.length ? segs[segs.length - 1].top + (segs[segs.length - 1].to - segs[segs.length - 1].from) * PX : 0;
        return (
          <section className="tl-day" key={day}>
            <h3>{dayLabel(day)}{fc[day] && <span className={`wx ${fc[day].rain >= 50 ? "wet" : ""}`}>{brief(fc[day])}</span>}</h3>
            {fc[day] && hint(fc[day]) && <p className="wxhint">{hint(fc[day])}</p>}
            {allDay.map((e) => (
              <button className="tl-allday" key={e.id} onClick={() => onOpen(e)}>{e.title}<small>Time not listed</small></button>
            ))}
            {blocks.length > 0 && crowded && (
              <div className="tl-agenda">
                {[...blocks].sort((a, b) => a.s - b.s || a.e - b.e).map((b) => (
                  <button key={b.ev.id} className={`tl-row ${status(b.ev.id) ?? ""}`} onClick={() => onOpen(b.ev)}>
                    <b>{clock(b.s)}</b><span>{b.ev.title}<small>{b.ev.venue || b.ev.city}</small></span>
                  </button>
                ))}
              </div>
            )}
            {blocks.length > 0 && !crowded && (
              <div className="tl-grid" style={{ height }}>
                {segs.flatMap((g) => Array.from({ length: g.to - g.from + 1 }, (_, i) => g.from + i).map((h) => (
                  <div className="tl-hour" key={h} style={{ top: g.top + (h - g.from) * PX }}>
                    <span>{clock(h * 60)}</span>
                  </div>
                )))}
                {blocks.map((b) => (
                  <button
                    key={b.ev.id}
                    className={`tl-ev ${status(b.ev.id) ?? ""}`}
                    style={{
                      top: yOf(b.s), height: Math.max(((b.e - b.s) / 60) * PX - 2, 30),
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
