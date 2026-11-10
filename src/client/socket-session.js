"use strict";

// A multiplayer game session: the same interface as LocalSession (session.js), but the official game is on
// the server (server/rooms.js). The messages are described in src/shared/protocol.js.
//
// It keeps its own copy of the game, built by replaying the moves the server confirms, so the page can show
// it straight away. submitMove checks the move here first, then sends it and returns { ok: true, pending: true }:
// the board waits until the server sends the move back (onChange), or rejects it (onChange with the game as it
// was, and an "error" event).
//
// The connection is looked after here: if it drops, it reconnects by itself (with a growing delay) and resumes
// the seat with the token the server gave, then catches up on any moves it missed. A move that was waiting for
// an answer is sent again; the server recognises it by its number, so it is never played twice.
// The seat is remembered in sessionStorage too, so reloading the page goes back into the game.
//
// Besides the LocalSession interface:
//   start({ create: "w" | "b" | "random" })  or  start({ join: code })  or  start({ resume: { code, token } })
//   leave()               leave the game (the opponent is told) and close the connection
//   onEvent(listener)     listener(event) for what the page should show:
//                           { type: "status" }    something in info() changed
//                           { type: "error", message, fatal }  fatal: the session is over (see info().phase)
//   info()                { phase, code, color, opponent, connection, pending }
//                           phase:      "connecting" (first connection, or creating/joining), "playing",
//                                       "ended" (the game is over or couldn't be joined), "left"
//                           connection: "connected" | "reconnecting"
//                           opponent:   "waiting" | "connected" | "disconnected" (protocol.js OPPONENT)
//                           endedReason: why phase is "ended" (protocol.js ENDED / ERRORS code)
//   pending               the move waiting for the server's answer, or null

import { createInitialState, cloneState } from "../engine/state.js";
import { applyMove } from "../engine/game.js";
import { positionHash } from "../engine/fingerprint.js";
import { SOCKET_PATH, ERRORS } from "../shared/protocol.js";

const STORAGE_KEY = "qhess.multiplayer";
const PING_MS = 10000;           // send a keep-alive this often
const SILENCE_MS = 25000;        // no message at all for this long: treat the connection as lost
const RETRY_MS = [500, 1000, 2000, 4000, 8000]; // delays between reconnect attempts (the last one repeats)

// The websocket address for the page's own server
function defaultUrl() {
	return (location.protocol == "https:" ? "wss://" : "ws://") + location.host + SOCKET_PATH;
}

// sessionStorage, or a stand-in when there isn't one (Node, or storage blocked)
function defaultStorage() {
	try {
		if (globalThis.sessionStorage) {
			return globalThis.sessionStorage;
		}
	} catch {
		// blocked
	}
	const items = new Map();
	return {
		getItem: k => items.has(k) ? items.get(k) : null,
		setItem: (k, v) => items.set(k, String(v)),
		removeItem: k => items.delete(k),
	};
}

// The seat saved by the last game in this tab ({ code, token }), or null
function savedSeat(storage = defaultStorage()) {
	try {
		const seat = JSON.parse(storage.getItem(STORAGE_KEY));
		return seat && typeof seat.code == "string" && typeof seat.token == "string" ? seat : null;
	} catch {
		return null;
	}
}

class SocketSession {
	// options: url (websocket address), storage (like sessionStorage), WebSocket (the class to use)
	constructor(options = {}) {
		this.url = options.url ?? defaultUrl();
		this.storage = options.storage ?? defaultStorage();
		this.WebSocketClass = options.WebSocket ?? globalThis.WebSocket;
		this.listeners = [];
		this.eventListeners = [];
		this.ws = null;
		this.phase = "connecting";
		this.connection = "reconnecting";
		this.opponent = "waiting";
		this.code = null;
		this.token = null;
		this.color = null;
		this.endedReason = null;
		this.pending = null;     // { seq, move }
		this.request = null;     // what to send once connected: create / join / resume
		this.retries = 0;
		this.timers = {};
		this.useMoves([]);
	}

	////////////////////////////////
	// The LocalSession interface
	////////////////////////////////

	getState() {
		return cloneState(this.state);
	}

	onChange(listener) {
		this.listeners.push(listener);
	}

	// A multiplayer game can't be restarted from one side
	reset() {}

	submitMove(move) {
		if (this.phase != "playing") {
			return { ok: false, error: "Not in a game" };
		}
		if (this.pending) {
			return { ok: false, error: "Still sending the last move" };
		}
		if (this.state.turnColor != this.color) {
			return { ok: false, error: "It's not your turn" };
		}
		if (this.opponent == "waiting") {
			return { ok: false, error: "Wait for your opponent to join" };
		}
		// Check it here first (on a copy), so an impossible move never leaves the page
		const result = applyMove(cloneState(this.state), move);
		if (!result.ok) {
			return result;
		}
		this.pending = { seq: this.moves.length, move: plainMove(move) };
		this.sendPending();
		this.emit({ type: "status" });
		return { ok: true, pending: true };
	}

	////////////////////////////////
	// Starting and leaving
	////////////////////////////////

	start(request) {
		if (request.resume) {
			this.request = { type: "resume", code: request.resume.code, token: request.resume.token };
		} else if (request.join !== undefined) {
			this.request = { type: "join", code: request.join };
		} else {
			this.request = { type: "create", color: request.create };
		}
		this.connect();
	}

	leave() {
		if (this.phase == "left") { return; }
		this.send({ type: "leave" });
		this.finish("left");
	}

	onEvent(listener) {
		this.eventListeners.push(listener);
	}

	info() {
		return {
			phase: this.phase,
			code: this.code,
			color: this.color,
			opponent: this.opponent,
			connection: this.connection,
			pending: this.pending !== null,
			endedReason: this.endedReason,
		};
	}

	////////////////////////////////
	// The connection
	////////////////////////////////

	connect() {
		this.clearTimers();
		let ws;
		try {
			ws = new this.WebSocketClass(this.url);
		} catch (err) {
			this.connectionLost();
			return;
		}
		this.ws = ws;
		ws.onopen = () => {
			if (this.ws !== ws) { return; }
			this.heard();
			this.send(this.request);
			this.timers.ping = setInterval(() => this.send({ type: "ping" }), PING_MS);
		};
		ws.onmessage = event => {
			if (this.ws !== ws) { return; }
			this.heard();
			let message;
			try {
				message = JSON.parse(event.data);
			} catch {
				return;
			}
			this.receive(message);
		};
		ws.onclose = () => {
			if (this.ws !== ws) { return; }
			this.connectionLost();
		};
		ws.onerror = () => {}; // followed by onclose
	}

	// Any message shows the connection is alive; silence for too long means it isn't
	heard() {
		clearTimeout(this.timers.silence);
		this.timers.silence = setTimeout(() => {
			if (this.ws) {
				const ws = this.ws;
				this.ws = null;
				try { ws.close(); } catch { /* already gone */ }
				this.connectionLost();
			}
		}, SILENCE_MS);
	}

	connectionLost() {
		this.ws = null;
		this.clearTimers();
		if (this.phase == "ended" || this.phase == "left") { return; }
		if (this.phase == "connecting" && this.request?.type != "resume" && this.retries >= 2) {
			// Never got into the game: give up rather than retrying a create or join for ever
			this.endedReason = "unreachable";
			this.emit({ type: "error", message: "Couldn't reach the Qhess server. Multiplayer needs the page to be opened from it (start.bat).", fatal: true });
			this.finish("ended");
			return;
		}
		this.connection = "reconnecting";
		this.emit({ type: "status" });
		const delay = RETRY_MS[Math.min(this.retries, RETRY_MS.length - 1)];
		this.retries++;
		this.timers.retry = setTimeout(() => this.connect(), delay);
	}

	send(message) {
		if (this.ws && this.ws.readyState == 1) { // OPEN
			this.ws.send(JSON.stringify(message));
		}
	}

	sendPending() {
		if (this.pending) {
			this.send({ type: "move", seq: this.pending.seq, move: this.pending.move });
		}
	}

	clearTimers() {
		clearInterval(this.timers.ping);
		clearTimeout(this.timers.silence);
		clearTimeout(this.timers.retry);
		this.timers = {};
	}

	// The session is over: no more reconnecting
	finish(phase) {
		this.phase = phase;
		this.pending = null;
		this.forgetSeat();
		this.clearTimers();
		const ws = this.ws;
		this.ws = null;
		if (ws) {
			try { ws.close(); } catch { /* already gone */ }
		}
		this.emit({ type: "status" });
	}

	////////////////////////////////
	// Messages from the server
	////////////////////////////////

	receive(message) {
		switch (message.type) {
			case "welcome": return this.welcome(message);
			case "move": return this.moveMessage(message);
			case "rejected": return this.rejected(message);
			case "sync": return this.sync(message.moves);
			case "opponent":
				this.opponent = message.status;
				return this.emit({ type: "status" });
			case "ended":
				this.endedReason = message.reason;
				this.emit({ type: "error", message: message.reason == "opponent_left" ? "Your opponent left the game." : "The game was closed.", fatal: true });
				return this.finish("ended");
			case "error": return this.serverError(message);
		}
	}

	welcome(message) {
		this.code = message.code;
		this.token = message.token;
		this.color = message.color;
		this.opponent = message.opponent;
		this.phase = "playing";
		this.connection = "connected";
		this.retries = 0;
		// From now on, a reconnect resumes this seat
		this.request = { type: "resume", code: this.code, token: this.token };
		this.saveSeat();
		this.sync(message.moves);
		// A move sent before the connection dropped: if the server didn't get it, send it again (if it did, the
		// server just confirms it)
		this.sendPending();
	}

	moveMessage({ seq, move, hash }) {
		if (seq < this.moves.length) {
			// Already have it (e.g. the confirmation of a move that arrived in a sync)
			if (this.pending && this.pending.seq == seq) { this.pending = null; this.notify(); }
			return;
		}
		if (seq > this.moves.length) {
			// Missed one: get the whole game again
			return this.send({ type: "sync" });
		}
		const next = cloneState(this.state);
		if (!applyMove(next, move).ok || (hash && positionHash(next) != hash)) {
			// This copy has drifted from the server's: start again from the server's moves
			return this.send({ type: "sync" });
		}
		this.state = next;
		this.moves.push(move);
		if (this.pending && this.pending.seq == seq) {
			this.pending = null;
		}
		this.notify();
	}

	rejected({ seq, error }) {
		if (this.pending && this.pending.seq == seq) {
			this.pending = null;
		}
		this.emit({ type: "error", message: "Move not accepted: " + error, fatal: false });
		this.notify(); // back to the game as it was
	}

	sync(moves) {
		this.useMoves(moves);
		if (this.pending && this.pending.seq < this.moves.length) {
			// It was played
			this.pending = null;
		}
		this.notify();
	}

	serverError({ code, message }) {
		if (code == ERRORS.BAD_REQUEST) {
			this.emit({ type: "error", message, fatal: false });
			return;
		}
		// The game can't be joined or resumed, or this seat was taken over by another tab
		this.endedReason = code;
		this.emit({ type: "error", message, fatal: true });
		this.finish("ended");
	}

	////////////////////////////////
	// The copy of the game
	////////////////////////////////

	useMoves(moves) {
		const state = createInitialState();
		const played = [];
		for (const move of moves) {
			if (!applyMove(state, move).ok) { break; }
			played.push(move);
		}
		this.state = state;
		this.moves = played;
	}

	notify() {
		this.emit({ type: "status" });
		for (const listener of this.listeners) {
			listener(this.getState());
		}
	}

	emit(event) {
		for (const listener of this.eventListeners) {
			listener(event);
		}
	}

	saveSeat() {
		try {
			this.storage.setItem(STORAGE_KEY, JSON.stringify({ code: this.code, token: this.token }));
		} catch {
			// storage blocked: reloading the page won't go back into the game, but nothing else is affected
		}
	}

	forgetSeat() {
		try {
			this.storage.removeItem(STORAGE_KEY);
		} catch {
			// storage blocked
		}
	}
}

// A move as plain data (the page's turn record may carry extra fields)
function plainMove(move) {
	return {
		notAKing: move.notAKing ?? null,
		from: move.from ?? null,
		to: move.to ?? null,
		enPassant: move.enPassant === true,
		promotion: move.promotion === true,
		pcKing: move.pcKing ?? null,
		pcAttackers: (move.pcAttackers ?? []).map(a => [a[0], a[1]]),
	};
}

export { SocketSession, savedSeat };
