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
//   { type: "create", color: "w" | "b" | "random", hintLevel }
//                                                     start a game; the server picks a join code. hintLevel: one of
//                                                     HINT_LEVELS, the hints both players get (default "captures")
//   { type: "join", code }                            take the free seat in a game
//   { type: "resume", code, token }                   come back to your seat after a disconnect
//   { type: "move", seq, move }                       play a turn. seq = the number of moves played before it,
//                                                     so a move resent after a reconnect is never played twice
//   { type: "sync" }                                  ask for the whole move list again
//   { type: "rewind", keep }                          ask the opponent to take the game back to its first keep
//                                                     moves (0 <= keep < moves played). Replaces any request.
//   { type: "rewindAnswer", agree }                   answer the opponent's rewind request (true / false)
//   { type: "rewindCancel" }                          withdraw your own rewind request
//   { type: "hintLevel", level }                      ask the opponent to play on at another hint level (HINT_LEVELS).
//                                                     Replaces any request. Before anyone has joined it just applies.
//   { type: "hintLevelAnswer", agree }                answer the opponent's hint level request (true / false)
//   { type: "hintLevelCancel" }                       withdraw your own hint level request
//   { type: "leave" }                                 leave the game (the other player is told)
//   { type: "ping" }                                  keep-alive; the server answers "pong"
//
// Server -> browser
//   { type: "welcome", code, token, color, moves, opponent, hintLevel }
//                     you're in the game (after create, join or resume). token is your seat's secret: keep it
//                     to resume. moves: every move so far. opponent: one of OPPONENT below. hintLevel: the hint
//                     level the creator chose (HINT_LEVELS), which both players play at.
//   { type: "move", seq, move, color, hash }
//                     move number seq was played by color. Also the answer to your own move. hash is the
//                     server's positionHash (src/engine/position-hash.js) after it, to catch copies that differ.
//   { type: "rejected", seq, error }   your move wasn't accepted (the game is unchanged)
//   { type: "sync", moves }            the whole move list: replace your copy of the game with it
//   { type: "rewind", keep, by }       a rewind is asked for by colour `by` (to both players; sent again on resume)
//   { type: "rewindEnded", keep, by, result }   the rewind request is over (REWIND). On "agreed" a "sync"
//                                      with the shortened move list comes just before it.
//   { type: "hintLevelAsked", level, by }   colour `by` asks to change the hint level (to both; sent again on resume)
//   { type: "hintLevelEnded", level, by, result }   the hint level request is over (HINT_CHANGE). On "agreed" the
//                                      game's hint level is now `level`.
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

// rewindEnded result
const REWIND = {
	AGREED: "agreed",
	DECLINED: "declined",
	CANCELLED: "cancelled",       // the asker withdrew it
	MOVED: "moved",               // a move was played instead, so it no longer applies
};

// How much the board helps before a move is submitted (the Settings tab's Hint Level), least first:
//   none       nothing: not even the collapses the move causes are shown until it is submitted
//   collapses  the collapses, but not where a piece can move
//   moves      the collapses and where a piece can move, but captures not picked out
//   captures   everything
const HINT_LEVELS = ["none", "collapses", "moves", "captures"];

// hintLevelEnded result
const HINT_CHANGE = {
	AGREED: "agreed",
	DECLINED: "declined",
	CANCELLED: "cancelled",       // the asker withdrew it
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

export { PROTOCOL_VERSION, SOCKET_PATH, OPPONENT, ENDED, REWIND, ERRORS, HINT_LEVELS, HINT_CHANGE, normalizeCode };
