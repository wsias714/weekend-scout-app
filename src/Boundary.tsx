import { Component } from "react";
import type { ReactNode } from "react";

/** Reset without losing the Dropbox connection: clears the cached list, the offline cache and the service worker. */
export async function resetApp() {
  try {
    ["ws-feed", "ws-view"].forEach((k) => localStorage.removeItem(k));
    for (const r of await navigator.serviceWorker?.getRegistrations?.() ?? []) await r.unregister();
    for (const k of await caches?.keys?.() ?? []) await caches.delete(k);
  } catch {
    /* best effort */
  }
  window.location.reload();
}

export default class Boundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="app">
        <h1>Weekend Scout</h1>
        <p>Something broke while showing the list.</p>
        <p className="err">{String(this.state.err.message).slice(0, 300)}</p>
        <p className="note">build {__BUILD__}</p>
        <div className="sheet-actions"><button className="go" onClick={() => void resetApp()}>Reset app and reload</button></div>
      </div>
    );
  }
}
