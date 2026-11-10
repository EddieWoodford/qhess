"use strict";

// A compact fingerprint of a game position, for checking that two copies of a game agree.
// Used by the tests (tests/node, and the same scheme as tests/test.html's snapshots) and by multiplayer
// clients and the server to detect a copy of the game that has drifted from the official one.

// Everything about the game position that matters, as plain data (see state.js)
function positionSummary(s) {
	const pieceState = p => [
		String.fromCharCode(97 + p.c) + (8 - p.r),
		"cap" + p.captured,
		"moved" + p.hasmoved,
		p.options.join(""),
		p.promoted ? "promoted " + p.promotedOptions.join("") : "",
	].join(" ").trim();
	return {
		turn: s.turnNumber + s.turnColor,
		enPassant: { coords: s.epCoords.slice(), color: s.epColor },
		potentialCheck: { king: s.pcKing, color: s.pcColor },
		autoCheck: s.autoCheck,
		potCheck: s.potCheck,
		white: s.pieces.w.map(pieceState),
		black: s.pieces.b.map(pieceState),
	};
}

// FNV-1a hash of a string, as 8 hex digits
function hash(str) {
	let h = 0x811c9dc5;
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return (h >>> 0).toString(16).padStart(8, "0");
}

// The fingerprint of a position: the same value tests/snapshots.json records as a "plyHash"
function positionHash(state) {
	return hash(JSON.stringify(positionSummary(state)));
}

export { positionSummary, hash, positionHash };
