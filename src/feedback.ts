import { initFeedback } from "./lib/feedback.js";
import { dropboxRemote, isConnected } from "./lib/dropbox.ts";
import { ConflictError } from "./lib/remote.ts";

/** In-app Feedback button (shared module, see ~/Projects/_shared/feedback). Items go to Dropbox
    Apps/WeekendScout-wsias/feedback/ using the same sign-in as the app; offline or signed out, they wait on the device. */
let handle: { open: () => void } | null = null;
/** Opens the feedback panel. The button lives in Settings rather than floating on screen. */
export const openFeedback = () => handle?.open();

export function startFeedback() {
  handle = initFeedback({
    app: "weekend-scout",
    fab: false,
    upload: async (item) => {
      if (!isConnected()) throw new Error("not connected to Dropbox");
      try {
        await dropboxRemote().create(`/feedback/${item.id}.json`, JSON.stringify(item));
      } catch (e) {
        if (!(e instanceof ConflictError)) throw e; // already stored by an earlier attempt
      }
    },
  });
}
