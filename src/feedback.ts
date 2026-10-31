import { initFeedback } from "./lib/feedback.js";
import { dropboxRemote, isConnected } from "./lib/dropbox.ts";
import { ConflictError } from "./lib/remote.ts";

/** In-app Feedback button (shared module, see ~/Projects/_shared/feedback). Items go to Dropbox
    Apps/WeekendScout-wsias/feedback/ using the same sign-in as the app; offline or signed out, they wait on the device. */
export function startFeedback() {
  initFeedback({
    app: "weekend-scout",
    bottom: 84,
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
