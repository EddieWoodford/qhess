"use strict";

// The multiplayer protocol: the messages between a browser (src/client/socket-session.js) and the server
// (server/rooms.js). Shared by both, so it is plain JavaScript with no browser or Node code.
//
// Every message is one JSON object with a "type". Only moves cross the network, never game states: both
// sides replay the same moves with the same engine (src/engine), so they arrive at the same position.
// A move is plain data in the shape of notation.js parseMoveText (without "turn"):
//   { notAKing, from, to, enPassant, promotion, castle, pcKing, pcAttackers, resign }
//
// Browser -> server
//   { type: "create", color: "w" | "b" | "random" }   start a game; the server picks a join code
//   { type: "join", code }                            take the free seat in a game
//   { type: "resume", code, token }                   come back to your seat after a disconnect
//   { type: "move", seq, move }                       play a turn. seq = the number of moves played before it,
//                                                     so a move resent after a reconnect is never played twice
//   { type: "sync" }                                  ask for the whole move list again
//   { type: "leave" }                                 leave the game (the other player is told)
//   { type: "ping" }                                  keep-alive; the server answers "pong"
//
// Server -> browser
//   { type: "welcome", code, token, color, moves, opponent }
//                     you're in the game (after create, join or resume). token is your seat's secret: keep it
//                     to resume. moves: every move so far. opponent: one of OPPONENT below.
//   { type: "move", seq, move, color, hash }
//                     move number seq was played by color. Also the answer to your own move. hash is the
//                     server's positionHash (src/engine/position-hash.js) after it, to catch copies that differ.
//   { type: "rejected", seq, error }   your move wasn't accepted (the game is unchanged)
//   { type: "sync", moves }            the whole move list: replace your copy of the game with it
//   { type: "opponent", status }       the other player's connection changed (OPPONENT)
//   { type: "ended", reason }          the game is over and closed (ENDED)
//   { type: "error", code, message }   a request failed (ERRORS)
//   { type: "pong" }

const PROTOCOL_VERSION = 1;

// Where the websocket lives on the server
const SOCKET_PATH = "/ws";

// opponent status
const OPPONENT = {
	WAITING: "waiting",           // nobody has joined yet
	CONNECTED: "connected",
	DISCONNECTED: "disconnected", // was here; their seat is kept for them
};

// ended reason
const ENDED = {
	OPPONENT_LEFT: "opponent_left",
	EXPIRED: "expired",           // nobody was connected for too long
};

// error code
const ERRORS = {
	BAD_REQUEST: "bad_request",
	NOT_FOUND: "not_found",       // no game with that code (or it has ended, or the server restarted)
	FULL: "full",                 // both seats are taken
	BAD_TOKEN: "bad_token",
	NOT_IN_GAME: "not_in_game",
	REPLACED: "replaced",         // your seat was resumed from another tab or device
};

// Join codes look like "TIGER-42": a short word and two digits, easy to read out and type.
// normalizeCode accepts what a person might type ("tiger 42", "Tiger42", " TIGER-42 ") and returns
// "TIGER-42", or null if it can't be a code.
function normalizeCode(text) {
	if (typeof text != "string") { return null; }
	const m = /^([A-Z]{3,8})(\d{2})$/.exec(text.toUpperCase().replace(/[^A-Z0-9]/g, ""));
	return m ? m[1] + "-" + m[2] : null;
}

export { PROTOCOL_VERSION, SOCKET_PATH, OPPONENT, ENDED, ERRORS, normalizeCode };
