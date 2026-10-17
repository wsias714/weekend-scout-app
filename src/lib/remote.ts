/* Tiny remote interface so the queue logic is testable without Dropbox. */
export class ConflictError extends Error {
  constructor() {
    super("remote file already exists");
  }
}
export interface RemoteFile {
  text: string;
  rev: string;
}
export interface Remote {
  read(path: string): Promise<RemoteFile | null>;
  /** Create-only: throws ConflictError when the path already exists. */
  create(path: string, text: string): Promise<void>;
}
