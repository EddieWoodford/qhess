// The multiplayer referee: games ("rooms"), their two seats, and checking every move with the same engine
// the browser uses. It knows nothing about websockets: server.js turns each websocket into a "connection"
//   conn = { send(message), close() }
// and passes its messages to handle(conn, message) and its end to disconnect(conn). The tests drive it the
// same way. The messages are described in src/shared/protocol.js.

import { randomUUID } from "node:crypto";
import { createInitialState, cloneState } from "../src/engine/state.js";
import { applyMove } from "../src/engine/game.js";
import { positionHash } from "../src/engine/fingerprint.js";
import { OPPONENT, ENDED, ERRORS, normalizeCode } from "../src/shared/protocol.js";
import { randomCode } from "./codes.js";
import { MemoryGameStore } from "./store.js";

const COLORS = ["w", "b"];
const other = color => color == "w" ? "b" : "w";

// The colour that plays move number seq: Black's move 0 first, then White, Black, ...
const colorOfMove = seq => seq % 2 == 0 ? "b" : "w";

// A move from the network, checked to be the right shape and copied into a clean object; or null if it isn't
// a move at all. (Whether it's a legal move is up to the engine.)
function cleanMove(move) {
	if (move === null || typeof move != "object" || Array.isArray(move)) { return null; }
	const isCoord = v => Array.isArray(v) && v.length == 2 && v.every(n => Number.isInteger(n) && n >= 0 && n <= 7);
	const coordOrNull = v => {
		if (v === undefined || v === null) { return null; }
		return isCoord(v) ? [v[0], v[1]] : undefined;
	};
	const clean = {
		notAKing: coordOrNull(move.notAKing),
		from: coordOrNull(move.from),
		to: coordOrNull(move.to),
		enPassant: move.enPassant === true,
		promotion: move.promotion === true,
		pcKing: coordOrNull(move.pcKing),
		pcAttackers: [],
	};
	if (Object.values(clean).includes(undefined)) { return null; }
	const attackers = move.pcAttackers ?? [];
	if (!Array.isArray(attackers) || attackers.length > 16 || !attackers.every(isCoord)) { return null; }
	clean.pcAttackers = attackers.map(a => [a[0], a[1]]);
	return clean;
}

class GameServer {
	// options:
	//   store        where games are kept (default: in memory). See store.js.
	//   emptyRoomMs  close a game once nobody has been connected to it for this long (default 1 hour)
	//   random       () => [0, 1), for join codes and random colours (tests pass their own)
	//   log          (text) => void
	constructor(options = {}) {
		this.store = options.store ?? new MemoryGameStore();
		this.emptyRoomMs = options.emptyRoomMs ?? 60 * 60 * 1000;
		this.random = options.random ?? Math.random;
		this.log = options.log ?? (() => {});
		// The games being played, by code: { record (see store.js), state (engine state), conns: { w, b },
		// emptyTimer }. The record is saved to the store after every change.
		this.rooms = new Map();
		// Which game and seat each connection is in: conn -> { room, color }
		this.seats = new Map();
		// Messages are handled one at a time, in order, so a game never changes under a half-finished request
		this.queue = Promise.resolve();
	}

	// A message from conn: an object, or the raw JSON text. Returns a promise that settles once it's handled.
	handle(conn, message) {
		return this.enqueue(() => this.process(conn, message));
	}

	// conn has closed (or been lost)
	disconnect(conn) {
		return this.enqueue(() => this.detach(conn, true));
	}

	// Stop every timer (for tests, and shutting down)
	close() {
		for (const room of this.rooms.values()) {
			clearTimeout(room.emptyTimer);
		}
	}

	enqueue(task) {
		const run = this.queue.then(task).catch(err => this.log("Error: " + (err?.stack ?? err)));
		this.queue = run;
		return run;
	}

	async process(conn, message) {
		if (typeof message == "string") {
			try {
				message = JSON.parse(message);
			} catch {
				return this.error(conn, ERRORS.BAD_REQUEST, "not JSON");
			}
		}
		if (message === null || typeof message != "object") {
			return this.error(conn, ERRORS.BAD_REQUEST, "not a message");
		}
		switch (message.type) {
			case "create": return this.create(conn, message);
			case "join": return this.join(conn, message);
			case "resume": return this.resume(conn, message);
			case "move": return this.move(conn, message);
			case "sync": return this.sync(conn);
			case "leave": return this.leave(conn);
			case "ping": return send(conn, { type: "pong" });
			default: return this.error(conn, ERRORS.BAD_REQUEST, "unknown message type");
		}
	}

	////////////////////////////////
	// Requests
	////////////////////////////////

	async create(conn, { color }) {
		if (color == "random") {
			color = this.random() < 0.5 ? "w" : "b";
		}
		if (!COLORS.includes(color)) {
			return this.error(conn, ERRORS.BAD_REQUEST, "color must be w, b or random");
		}
		await this.leave(conn); // a connection is in one game at a time
		let code;
		do {
			code = randomCode(this.random);
		} while (this.rooms.has(code) || await this.store.has(code));
		const now = Date.now();
		const record = { code, createdAt: now, updatedAt: now, seats: { w: null, b: null }, moves: [] };
		record.seats[color] = { token: randomUUID() };
		const room = this.addRoom(record, createInitialState());
		await this.store.save(record);
		this.log("Game " + code + " created (creator plays " + color + ")");
		this.attach(conn, room, color);
	}

	async join(conn, { code }) {
		const room = await this.findRoom(code);
		if (!room) {
			return this.error(conn, ERRORS.NOT_FOUND, "There's no game with that code");
		}
		if (this.seats.get(conn)?.room === room) {
			return this.error(conn, ERRORS.BAD_REQUEST, "You're already in that game");
		}
		const color = COLORS.find(c => room.record.seats[c] === null);
		if (!color) {
			return this.error(conn, ERRORS.FULL, "That game already has two players");
		}
		await this.leave(conn);
		room.record.seats[color] = { token: randomUUID() };
		await this.save(room);
		this.log("Game " + room.record.code + ": " + color + " joined");
		this.attach(conn, room, color);
	}

	async resume(conn, { code, token }) {
		const room = await this.findRoom(code);
		if (!room) {
			return this.error(conn, ERRORS.NOT_FOUND, "That game has ended");
		}
		const color = COLORS.find(c => room.record.seats[c] !== null && room.record.seats[c].token === token);
		if (!color) {
			return this.error(conn, ERRORS.BAD_TOKEN, "That seat isn't yours");
		}
		const previous = room.conns[color];
		if (previous && previous !== conn) {
			// The seat is being taken over (a reconnect before the old connection was noticed as lost, or
			// another tab): the old connection is told and dropped
			this.seats.delete(previous);
			room.conns[color] = null;
			this.error(previous, ERRORS.REPLACED, "This game was opened somewhere else");
			previous.close();
		}
		if (this.seats.get(conn)?.room !== room) {
			await this.leave(conn);
		}
		this.attach(conn, room, color);
	}

	async move(conn, { seq, move }) {
		const seat = this.seats.get(conn);
		if (!seat) {
			return this.error(conn, ERRORS.NOT_IN_GAME, "You're not in a game");
		}
		const { room, color } = seat;
		const moves = room.record.moves;
		if (!Number.isInteger(seq) || seq < 0) {
			return this.error(conn, ERRORS.BAD_REQUEST, "seq must be a move number");
		}
		if (seq < moves.length) {
			// Already played: a resend after a reconnect. If it's this player's move as it was played, just
			// confirm it again; otherwise their copy of the game is out of date.
			const clean = cleanMove(move);
			if (colorOfMove(seq) == color && clean && JSON.stringify(clean) == JSON.stringify(moves[seq])) {
				return send(conn, this.moveMessage(room, seq));
			}
			return this.sync(conn);
		}
		if (seq > moves.length) {
			return this.sync(conn);
		}
		if (room.state.turnColor != color) {
			return send(conn, { type: "rejected", seq, error: "It's not your turn" });
		}
		if (room.record.seats[other(color)] === null) {
			return send(conn, { type: "rejected", seq, error: "Wait for your opponent to join" });
		}
		const clean = cleanMove(move);
		if (!clean) {
			return send(conn, { type: "rejected", seq, error: "That isn't a move" });
		}
		// Play it on a copy, so a move that fails part-way leaves the game as it was
		const next = cloneState(room.state);
		let result;
		try {
			result = applyMove(next, clean);
		} catch (err) {
			result = { ok: false, error: String(err.message ?? err) };
		}
		if (!result.ok) {
			return send(conn, { type: "rejected", seq, error: result.error });
		}
		room.state = next;
		moves.push(clean);
		await this.save(room);
		// To both players: for the mover it's the confirmation
		this.broadcast(room, this.moveMessage(room, seq));
	}

	sync(conn) {
		const seat = this.seats.get(conn);
		if (!seat) {
			return this.error(conn, ERRORS.NOT_IN_GAME, "You're not in a game");
		}
		send(conn, { type: "sync", moves: seat.room.record.moves });
	}

	// Leave the game conn is in, if any: the game is closed, and the other player told
	async leave(conn) {
		const seat = this.seats.get(conn);
		if (!seat) { return; }
		const { room, color } = seat;
		this.log("Game " + room.record.code + ": " + color + " left; game closed");
		const opponent = room.conns[other(color)];
		if (opponent) {
			send(opponent, { type: "ended", reason: ENDED.OPPONENT_LEFT });
		}
		await this.removeRoom(room);
	}

	////////////////////////////////
	// Rooms and seats
	////////////////////////////////

	addRoom(record, state) {
		const room = { record, state, conns: { w: null, b: null }, emptyTimer: null };
		this.rooms.set(record.code, room);
		return room;
	}

	async removeRoom(room) {
		clearTimeout(room.emptyTimer);
		for (const color of COLORS) {
			if (room.conns[color]) {
				this.seats.delete(room.conns[color]);
				room.conns[color] = null;
			}
		}
		this.rooms.delete(room.record.code);
		await this.store.delete(room.record.code);
	}

	// The game with this code (as typed by a person, or exact): from those being played, or from the store
	// (e.g. one saved before the server restarted, once there is a database). null if there isn't one.
	async findRoom(code) {
		code = normalizeCode(code);
		if (code === null) { return null; }
		if (this.rooms.has(code)) {
			return this.rooms.get(code);
		}
		const record = await this.store.get(code);
		if (!record) { return null; }
		// Rebuild the position from the moves
		const state = createInitialState();
		for (const move of record.moves) {
			if (!applyMove(state, move).ok) {
				this.log("Game " + code + " couldn't be rebuilt from its moves");
				return null;
			}
		}
		const room = this.addRoom(record, state);
		this.startEmptyTimer(room);
		return room;
	}

	async save(room) {
		room.record.updatedAt = Date.now();
		await this.store.save(room.record);
	}

	// Seat conn in room as color, and tell both players
	attach(conn, room, color) {
		clearTimeout(room.emptyTimer);
		room.emptyTimer = null;
		room.conns[color] = conn;
		this.seats.set(conn, { room, color });
		const opp = other(color);
		send(conn, {
			type: "welcome",
			code: room.record.code,
			token: room.record.seats[color].token,
			color,
			moves: room.record.moves,
			opponent: this.opponentStatus(room, opp),
		});
		if (room.conns[opp]) {
			send(room.conns[opp], { type: "opponent", status: OPPONENT.CONNECTED });
		}
	}

	// conn's connection has gone: its seat is kept, and the other player told
	detach(conn) {
		const seat = this.seats.get(conn);
		if (!seat) { return; }
		this.seats.delete(conn);
		const { room, color } = seat;
		if (room.conns[color] !== conn) { return; }
		room.conns[color] = null;
		const opponent = room.conns[other(color)];
		if (opponent) {
			send(opponent, { type: "opponent", status: OPPONENT.DISCONNECTED });
		} else {
			this.startEmptyTimer(room);
		}
	}

	// Close the game if nobody comes back to it
	startEmptyTimer(room) {
		clearTimeout(room.emptyTimer);
		room.emptyTimer = setTimeout(() => this.enqueue(async () => {
			if (this.rooms.get(room.record.code) === room && !room.conns.w && !room.conns.b) {
				this.log("Game " + room.record.code + " closed: nobody connected");
				await this.removeRoom(room);
			}
		}), this.emptyRoomMs);
		room.emptyTimer.unref?.(); // don't keep Node running just for this
	}

	opponentStatus(room, color) {
		if (room.record.seats[color] === null) { return OPPONENT.WAITING; }
		return room.conns[color] ? OPPONENT.CONNECTED : OPPONENT.DISCONNECTED;
	}

	moveMessage(room, seq) {
		// The position after move seq: the current one when it's the latest move (the usual case)
		let state = room.state;
		if (seq != room.record.moves.length - 1) {
			state = createInitialState();
			room.record.moves.slice(0, seq + 1).forEach(m => applyMove(state, m));
		}
		return { type: "move", seq, move: room.record.moves[seq], color: colorOfMove(seq), hash: positionHash(state) };
	}

	broadcast(room, message) {
		for (const color of COLORS) {
			if (room.conns[color]) { send(room.conns[color], message); }
		}
	}

	error(conn, code, message) {
		send(conn, { type: "error", code, message });
	}
}

function send(conn, message) {
	try {
		conn.send(message);
	} catch {
		// The connection has gone; its close is handled separately
	}
}

export { GameServer, cleanMove, colorOfMove };
