"use strict";

// Join links: an address that opens the page and joins a multiplayer game straight away, such as
//   https://example.github.io/qhess/?join=TIGER-42
// The Multiplayer tab shows it to copy and as a QR code (multiplayer-view.js); main.js joins the game when the
// page is opened from one.
//
// A page opened as localhost (start.bat on this computer) can't send that address to anyone else, so the link
// uses this computer's address on the network instead, which the server tells the page (networkHost).

import { normalizeCode } from "../shared/protocol.js";
import qrcode from "./vendor/qrcode.js";

const JOIN_PARAM = "join";
const LOCAL_HOSTNAMES = ["localhost", "127.0.0.1", "[::1]"];

// The game code in the page's address, or null when there isn't one
function codeFromUrl(loc = globalThis.location) {
	return normalizeCode(new URL(loc.href).searchParams.get(JOIN_PARAM));
}

// The page's address without the join code, so a reload resumes the game rather than trying to join it again
function urlWithoutJoin(loc = globalThis.location) {
	const url = new URL(loc.href);
	url.searchParams.delete(JOIN_PARAM);
	return url.href;
}

function isLocalHost(loc = globalThis.location) {
	return LOCAL_HOSTNAMES.includes(loc.hostname);
}

// The link a friend opens to join the game with this code. networkHost ("192.168.1.20") replaces a localhost
// address; without one, a localhost link is still made (it works for another tab on this computer).
function joinLink(code, loc = globalThis.location, networkHost = null) {
	const url = new URL(loc.href);
	url.search = "";
	url.hash = "";
	url.searchParams.set(JOIN_PARAM, code);
	if (networkHost && isLocalHost(loc)) {
		url.hostname = networkHost;
	}
	return url.href;
}

// This computer's address on the network, from the server, when the page is opened as localhost. null otherwise,
// or when the server doesn't know one.
async function networkHost(loc = globalThis.location) {
	if (!isLocalHost(loc)) { return null; }
	try {
		const res = await fetch(new URL("network-address", loc.href), { cache: "no-store" });
		const { addresses } = await res.json();
		return addresses?.[0] ?? null;
	} catch {
		return null;
	}
}

function makeQr(text) {
	const qr = qrcode(0, "M"); // 0: the smallest size that fits. M: survives about 15% of it being unreadable
	qr.addData(text);
	qr.make();
	return qr;
}

// A QR code of text, as an SVG element string (black on white, with the quiet border scanners need)
function qrSvg(text) {
	return makeQr(text).createSvgTag({ cellSize: 4, margin: 16, scalable: true, alt: "QR code of the join link" });
}

// The QR code's squares: rows of booleans, true for dark. For the tests.
function qrMatrix(text) {
	const qr = makeQr(text);
	const n = qr.getModuleCount();
	return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

export { JOIN_PARAM, codeFromUrl, urlWithoutJoin, joinLink, networkHost, qrSvg, qrMatrix };
