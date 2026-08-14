import { initBotId } from "botid/client/core";

// Bot protection for the two unauthenticated write surfaces. Server actions
// are invoked from their page path, so we protect those paths; the matching
// checkBotId() calls run server-side in the login and public-intake actions.
initBotId({
  protect: [
    { path: "/login", method: "POST" },
    { path: "/submit", method: "POST" },
    { path: "/submit/*", method: "POST" },
  ],
});
