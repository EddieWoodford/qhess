// A scripted multiplayer player for the tests: a real websocket to the server, a record of every message it
// receives, and its own copy of the game (built from the moves the server sends, with the engine).

import WebSocket from "ws";
import { createInitialState } from "../../src/engine/state.js";
import { applyMove } from "../../src/engine/game.js";
import { positionHash } from "../../src/engine/position-hash.js";
import { SOCKET_PATH } from "../../src/shared/protocol.js";

const WAIT_MS = 3000;

class TestClient {
	constructor(port, name = "client") {
		this.name = name;
		this.port = port;
		this.inbox = [];   // messages received and not yet taken by next()
		this.waiters = [];
		this.closed = false;
		this.resetGame();
	}

	resetGame() {
		this.state = createInitialState();
		this.moves = [];
	}

	open() {
		this.ws = new WebSocket("ws://localhost:" + this.port + SOCKET_PATH);
		this.closed = false;
		this.ws.on("message", data => this.receive(JSON.parse(data.toString())));
		this.ws.on("close", (code) => {
			this.closed = true;
			this.closeCode = code;
			this.flushWaiters();
		});
		return new Promise((resolve, reject) => {
			this.ws.once("open", resolve);
			this.ws.once("error", reject);
		});
	}

	receive(message) {
		// Keep the copy of the game up to date, as a browser would
		if (message.type == "welcome" || message.type == "sync") {
			this.useMoves(message.moves);
			if (message.type == "welcome") {
				this.code = message.code;
				this.token = message.token;
				this.color = message.color;
			}
		} else if (message.type == "move" && message.seq == this.moves.length) {
			this.play(message.move);
			message.localHash = positionHash(this.state);
		}
		this.inbox.push(message);
		this.flushWaiters();
	}

	// Rebuild the copy of the game from these moves
	useMoves(moves) {
		this.resetGame();
		for (const move of moves) { this.play(move); }
	}

	play(move) {
		const result = applyMove(this.state, move);
		if (!result.ok) { throw new Error(this.name + " couldn't play a move from the server: " + result.error); }
		this.moves.push(move);
	}

	flushWaiters() {
		for (const waiter of this.waiters.slice()) {
			const i = this.inbox.findIndex(waiter.match);
			if (i > -1) {
				this.waiters.splice(this.waiters.indexOf(waiter), 1);
				clearTimeout(waiter.timer);
				waiter.resolve(this.inbox.splice(i, 1)[0]);
			}
		}
	}

	send(message) {
		this.ws.send(typeof message == "string" ? message : JSON.stringify(message));
	}

	// The next message of this type (and matching where(message), if given), waiting for it if need be
	next(type, where = () => true) {
		const match = m => m.type == type && where(m);
		const i = this.inbox.findIndex(match);
		if (i > -1) { return Promise.resolve(this.inbox.splice(i, 1)[0]); }
		return new Promise((resolve, reject) => {
			const waiter = { match, resolve };
			waiter.timer = setTimeout(() => {
				this.waiters.splice(this.waiters.indexOf(waiter), 1);
				reject(new Error(this.name + " waited for a '" + type + "' message; has " + JSON.stringify(this.inbox)));
			}, WAIT_MS);
			this.waiters.push(waiter);
		});
	}

	// Send a request and wait for the answer of this type
	async request(message, answerType) {
		this.send(message);
		return this.next(answerType);
	}

	// Wait until the socket has closed
	async waitClosed() {
		for (let i = 0; i < 100 && !this.closed; i++) {
			await new Promise(r => setTimeout(r, 20));
		}
		if (!this.closed) { throw new Error(this.name + " didn't close"); }
	}

	// Drop the connection without a goodbye, as a lost network would
	kill() {
		this.ws.terminate();
	}

	close() {
		this.ws?.close();
	}

	hash() {
		return positionHash(this.state);
	}
}

export { TestClient };
