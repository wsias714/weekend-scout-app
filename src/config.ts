/** Dropbox app key (public by design under PKCE: no secret). Register a Dropbox app with "App folder"
    access named WeekendScout-wsias, then set VITE_DROPBOX_APP_KEY at build time or paste it in Settings. */
export const DEFAULT_DROPBOX_APP_KEY: string = import.meta.env.VITE_DROPBOX_APP_KEY ?? "ouxqt5sqbspvseu";
