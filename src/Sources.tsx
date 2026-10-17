import { useState } from "react";
import type { Feed, SourceInfo } from "./types.ts";
import type { Queued } from "./lib/queue.ts";

const KIND: Record<SourceInfo["kind"], string> = { feed: "Calendar feed", page: "Web page", mail: "Email" };
const STATUS: Record<string, string> = {
  pending: "Waiting for the laptop", added: "Added", no_events: "No events found", saved: "Saved note",
  rejected: "Not a web address", error: "Couldn't read it",
};

export default function SourcesView({ feed, queue, connected, onSuggest }: {
  feed: Feed | null; queue: Queued[]; connected: boolean; onSuggest: (url: string, note: string) => void;
}) {
  const [text, setText] = useState("");
  const [sent, setSent] = useState("");
  const all = feed?.sources ?? [];
  const active = all.filter((s) => s.enabled);
  const later = all.filter((s) => !s.enabled);
  const waiting = queue.flatMap((q) => (q.item.type === "source" ? [q.item] : []));
  const submit = () => {
    const t = text.trim();
    if (!t) return;
    const isUrl = /^https?:\/\//i.test(t) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(t);
    onSuggest(isUrl ? (/^https?:\/\//i.test(t) ? t : `https://${t}`) : "", isUrl ? "" : t);
    setText("");
    setSent(connected ? "Sent. The laptop checks every 10 minutes." : "");
  };
  return (
    <>
      <section className="card">
        <h3>Suggest a source</h3>
        <p className="note">Paste a web address or type a name. A link is read right away and added if it has dated family events.</p>
        <input className="src-in" value={text} onChange={(e) => setText(e.target.value)} placeholder="https://… or a name" autoCapitalize="off" aria-label="Source link or name" />
        <div className="sheet-actions"><button className="go" disabled={!text.trim()} onClick={submit}>{connected ? "Suggest" : "Connect to suggest"}</button></div>
        {sent && <p className="note" role="status">{sent}</p>}
        {waiting.map((w, i) => w.type === "source" && <p className="note" key={i}>Waiting to send: {w.url || w.note}</p>)}
        {(feed?.suggestions ?? []).map((s) => (
          <p className="note" key={s.id}><b>{s.url || s.note}</b><br />{STATUS[s.status] ?? s.status}{s.result ? `: ${s.result}` : ""}</p>
        ))}
      </section>
      <h2 className="src-h">Active ({active.length})</h2>
      {active.map((s) => <Row key={s.key} s={s} />)}
      {later.length > 0 && <details className="src-later"><summary>Not on yet ({later.length})</summary>{later.map((s) => <Row key={s.key} s={s} />)}</details>}
      {all.length === 0 && <p className="empty">The source list appears after the next sync.</p>}
    </>
  );
}

function Row({ s }: { s: SourceInfo }) {
  return (
    <article className="card src">
      <div className="src-top"><h3>{s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.label}</a> : s.label}</h3>
        <span className="chip">{s.enabled ? `${s.events} upcoming` : "off"}</span></div>
      <div className="chips"><span className="chip">{KIND[s.kind]}</span>{s.user && <span className="chip mem">You added</span>}{s.note && <span className="chip">{s.note}</span>}</div>
    </article>
  );
}
