/* Reading Dropbox SDK errors. Kept free of browser-only imports so it is testable under node. */
export interface DbxError {
  status?: number;
  error?: { error_summary?: string; error?: { ".tag"?: string; path?: { ".tag"?: string } } };
}
export const summary = (e: unknown) => (e as DbxError)?.error?.error_summary ?? "";
/** The stored login no longer works (revoked, or Dropbox refused the refresh), as opposed to a network blip. */
export const isAuthError = (e: unknown) => {
  const st = (e as DbxError)?.status;
  const msg = `${summary(e)} ${(e as Error)?.message ?? ""} ${JSON.stringify((e as DbxError)?.error ?? "")}`;
  return st === 401 || /invalid_grant|invalid_access_token|expired_access_token|invalid_client|\b401\b/.test(msg);
};
/** Something a person can read: the HTTP status and Dropbox's own summary when there is one. */
export const describeError = (e: unknown) => {
  const st = (e as DbxError)?.status;
  return [st ? `HTTP ${st}` : "", summary(e), (e as Error)?.message ?? String(e)].filter(Boolean).join(": ").slice(0, 200);
};
