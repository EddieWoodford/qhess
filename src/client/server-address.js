"use strict";

// Where the multiplayer server is.
//
// Opened from a Qhess server (start.bat on this computer, or the hosted one), the page uses that same server.
// Opened from a static host that can't run one (GitHub Pages), it uses the hosted server instead. The hosted
// server sleeps when nobody has used it for a while and takes up to a minute to start again, so such a page
// wakes it as soon as it loads (wakeServer), to have it ready by the time someone starts a game.

import { SOCKET_PATH } from "../shared/protocol.js";

const HOSTED_SERVER = "qhess.onrender.com";

// Hosts that serve the page's files but have no Qhess server of their own
const STATIC_HOST_ENDINGS = [".github.io"];

// true when the page has no server of its own and uses the hosted one
function usesHostedServer(loc = globalThis.location) {
	return !!loc && STATIC_HOST_ENDINGS.some(ending => loc.hostname.endsWith(ending));
}

// The websocket address of the multiplayer server
function socketUrl(loc = globalThis.location) {
	if (usesHostedServer(loc)) {
		return "wss://" + HOSTED_SERVER + SOCKET_PATH;
	}
	return (loc.protocol == "https:" ? "wss://" : "ws://") + loc.host + SOCKET_PATH;
}

// Start the hosted server waking up, if the page uses it. Any request wakes it; the answer isn't needed
// ("no-cors": the browser doesn't let the page read it, but it is still sent).
function wakeServer(loc = globalThis.location) {
	if (!usesHostedServer(loc)) { return; }
	fetch("https://" + HOSTED_SERVER + "/", { mode: "no-cors", cache: "no-store" }).catch(() => {});
}

export { HOSTED_SERVER, usesHostedServer, socketUrl, wakeServer };
