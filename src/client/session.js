"use strict";

// A game session: the one place that holds the official game state and decides whether a move is accepted.
// The page (controller.js) never changes that state itself. It works on copies while a player is making a
// move, then hands the finished move to the session.
//
// Every session has this interface:
//   getState()          a copy of the current game state (safe to change; the session's own is untouched)
//   reset()             start a new game
//   submitMove(move)    play a whole turn. move is plain data, the same shape as notation.js parseMoveText:
//                         { notAKing, from, to, enPassant, promotion, castle, pcKing, pcAttackers }
//                       Returns { ok: true } or { ok: false, error }.
//   onChange(listener)  call listener(stateCopy) whenever the game state changes (after reset or an accepted move)
//
// LocalSession plays both sides in this browser. SocketSession (socket-session.js) has the same interface for a
// multiplayer game: submitMove sends the move to the server, which checks it with the same engine (applyMove)
// and sends accepted moves to both players. Its answer arrives later, so it returns { ok: true, pending: true },
// and the page waits for onChange rather than relying on the return value.

import { createInitialState, cloneState } from "../engine/state.js";
import { applyMove } from "../engine/game.js";

class LocalSession {
	constructor() {
		this.state = createInitialState();
		this.listeners = [];
	}

	getState() {
		return cloneState(this.state);
	}

	onChange(listener) {
		this.listeners.push(listener);
	}

	reset() {
		this.state = createInitialState();
		this.notify();
	}

	submitMove(move) {
		// Check the move on a copy, so a move that fails part-way leaves the game as it was
		const next = cloneState(this.state);
		const result = applyMove(next, move);
		if (!result.ok) {
			return result;
		}
		this.state = next;
		this.notify();
		return { ok: true };
	}

	notify() {
		for (const listener of this.listeners) {
			listener(this.getState());
		}
	}
}

export { LocalSession };
