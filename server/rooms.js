// The multiplayer referee: games ("rooms"), their two seats, and checking every move with the same engine
// the browser uses. It knows nothing about websockets: server.js turns each websocket into a "connection"
//   conn = { send(message), close() }
// and passes its messages to handle(conn, message) and its end to disconnect(conn). The tests drive it the
// same way. The messages are described in src/shared/protocol.js.

import { randomUUID } from "node:crypto";
import { createInitialState, cloneState } from "../src/engine/state.js";
import { applyMove } from "../src/engine/game.js";
import { isSquare } from "../src/engine/utils.js";
import { positionHash } from "../src/engine/position-hash.js";
import { OPPONENT, ENDED, REWIND, ERRORS, HINT_LEVELS, HINT_CHANGE, normalizeCode } from "../src/shared/protocol.js";
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
	const coordOrNull = v => {
		if (v === undefined || v === null) { return null; }
		return isSquare(v) ? [v[0], v[1]] : undefined;
	};
	const clean = {
		notAKing: coordOrNull(move.notAKing),
		from: coordOrNull(move.from),
		to: coordOrNull(move.to),
		enPassant: move.enPassant === true,
		promotion: move.promotion === true,
		castle: move.castle === true,
		pcKing: coordOrNull(move.pcKing),
		pcAttackers: /** @type {number[][]} */ ([]),
		resign: move.resign === true,
	};
	if (Object.values(clean).includes(undefined)) { return null; }
	const attackers = move.pcAttackers ?? [];
	if (!Array.isArray(attackers) || attackers.length > 16 || !attackers.every(isSquare)) { return null; }
	clean.pcAttackers = attackers.map((/** @type {number[]} */ a) => [a[0], a[1]]);
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
		// emptyTimer, rewind, hintRequest }. The record is saved to the store after every change. rewind: the open
		// rewind request, { keep, by }, or null; hintRequest: the open hint level request, { level, by }, or null
		// (neither is saved: a server restart forgets them).
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
		return this.enqueue(() => this.detach(conn));
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
			case "rewind": return this.askRewind(conn, message);
			case "rewindAnswer": return this.answerRewind(conn, message);
			case "rewindCancel": return this.cancelRewind(conn);
			case "hintLevel": return this.askHintLevel(conn, message);
			case "hintLevelAnswer": return this.answerHintLevel(conn, message);
			case "hintLevelCancel": return this.cancelHintLevel(conn);
			case "leave": return this.leave(conn);
			case "ping": return send(conn, { type: "pong" });
			default: return this.error(conn, ERRORS.BAD_REQUEST, "unknown message type");
		}
	}

	////////////////////////////////
	// Requests
	////////////////////////////////

	async create(conn, { color, hintLevel = "captures" }) {
		if (!HINT_LEVELS.includes(hintLevel)) {
			return this.error(conn, ERRORS.BAD_REQUEST, "hintLevel must be one of " + HINT_LEVELS.join(", "));
		}
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
		const record = { code, createdAt: now, updatedAt: now, seats: { w: null, b: null }, joinedColor: null, hintLevel,
			moves: [] };
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
		const free = COLORS.find(c => room.record.seats[c] === null);
		const retaking = !free;
		const color = free ?? this.retakableSeat(room);
		if (!color) {
			return this.error(conn, ERRORS.FULL, "That game already has two players");
		}
		await this.leave(conn);
		if (retaking) {
			this.replaceConn(room, color);
		}
		// A new token: whoever had the seat before can't resume it
		room.record.seats[color] = { token: randomUUID() };
		room.record.joinedColor = color;
		await this.save(room);
		this.log("Game " + room.record.code + ": " + color + (retaking ? " joined again, taking the seat over" : " joined"));
		this.attach(conn, room, color);
	}

	// The seat a join may take over in a full game, or null. Joining from a link often happens twice: a phone
	// opens the link in the messaging app's own browser first, then in its real browser. So until the joiner
	// has made a move, joining again takes their seat over. The creator's seat is never taken.
	retakableSeat(room) {
		const color = room.record.joinedColor;
		if (!color) { return null; }
		const hasMoved = room.record.moves.some((_, seq) => colorOfMove(seq) == color);
		return hasMoved ? null : color;
	}

	// The connection in room's color seat (if any) is told it has been replaced, and dropped
	replaceConn(room, color) {
		const previous = room.conns[color];
		if (!previous) { return; }
		this.seats.delete(previous);
		room.conns[color] = null;
		this.error(previous, ERRORS.REPLACED, "This game was opened somewhere else");
		previous.close();
	}

	async resume(conn, { code, token }) {
		const room = await this.findRoom(code);
		if (!room) {
			return this.error(conn, ERRORS.NOT_FOUND, "That game no longer exists (it ended, or the server was restarted)");
		}
		const color = COLORS.find(c => room.record.seats[c] !== null && room.record.seats[c].token === token);
		if (!color) {
			return this.error(conn, ERRORS.BAD_TOKEN, "That seat isn't yours");
		}
		if (room.conns[color] !== conn) {
			// The seat is being taken over (a reconnect before the old connection was noticed as lost, or
			// another tab): the old connection is told and dropped
			this.replaceConn(room, color);
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
		const result = applyMove(next, clean);
		if (!result.ok) {
			return send(conn, { type: "rejected", seq, error: result.error ?? "That move can't be played" });
		}
		room.state = next;
		moves.push(clean);
		await this.save(room);
		this.endRewind(room, REWIND.MOVED);
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

	////////////////////////////////
	// Rewinding: one player asks to take the game back to an earlier position, the other agrees or not
	////////////////////////////////

	async askRewind(conn, { keep }) {
		const seat = this.seats.get(conn);
		if (!seat) {
			return this.error(conn, ERRORS.NOT_IN_GAME, "You're not in a game");
		}
		const { room, color } = seat;
		if (!Number.isInteger(keep) || keep < 0 || keep >= room.record.moves.length) {
			return this.error(conn, ERRORS.BAD_REQUEST, "keep must be a number of moves before the latest");
		}
		if (room.record.seats[other(color)] === null) {
			return this.error(conn, ERRORS.BAD_REQUEST, "Wait for your opponent to join");
		}
		room.rewind = { keep, by: color };
		this.broadcast(room, { type: "rewind", ...room.rewind });
	}

	async answerRewind(conn, { agree }) {
		const seat = this.seats.get(conn);
		if (!seat) {
			return this.error(conn, ERRORS.NOT_IN_GAME, "You're not in a game");
		}
		const { room, color } = seat;
		if (!room.rewind || room.rewind.by == color) { return; } // nothing to answer (it may just have ended)
		if (agree !== true) {
			return this.endRewind(room, REWIND.DECLINED);
		}
		const keep = room.rewind.keep;
		const state = createInitialState();
		room.record.moves.slice(0, keep).forEach(m => applyMove(state, m));
		room.state = state;
		room.record.moves.length = keep;
		await this.save(room);
		this.log("Game " + room.record.code + ": rewound to " + keep + " moves");
		this.broadcast(room, { type: "sync", moves: room.record.moves });
		this.endRewind(room, REWIND.AGREED);
	}

	cancelRewind(conn) {
		const seat = this.seats.get(conn);
		if (seat?.room.rewind?.by == seat?.color) {
			this.endRewind(seat.room, REWIND.CANCELLED);
		}
	}

	// Close the room's rewind request, if it has one, telling both players why
	endRewind(room, result) {
		if (!room.rewind) { return; }
		const message = { type: "rewindEnded", ...room.rewind, result };
		room.rewind = null;
		this.broadcast(room, message);
	}

	////////////////////////////////
	// Changing the hint level: one player asks, the other agrees or not (like rewinding, but moves don't end it)
	////////////////////////////////

	async askHintLevel(conn, { level }) {
		const seat = this.seats.get(conn);
		if (!seat) {
			return this.error(conn, ERRORS.NOT_IN_GAME, "You're not in a game");
		}
		const { room, color } = seat;
		if (!HINT_LEVELS.includes(level)) {
			return this.error(conn, ERRORS.BAD_REQUEST, "level must be one of " + HINT_LEVELS.join(", "));
		}
		if (level == (room.record.hintLevel ?? "captures")) {
			return this.error(conn, ERRORS.BAD_REQUEST, "The game is already at that hint level");
		}
		room.hintRequest = { level, by: color };
		if (room.record.seats[other(color)] === null) {
			return this.endHintLevel(room, HINT_CHANGE.AGREED); // nobody to ask yet
		}
		this.broadcast(room, { type: "hintLevelAsked", ...room.hintRequest });
	}

	async answerHintLevel(conn, { agree }) {
		const seat = this.seats.get(conn);
		if (!seat) {
			return this.error(conn, ERRORS.NOT_IN_GAME, "You're not in a game");
		}
		const { room, color } = seat;
		if (!room.hintRequest || room.hintRequest.by == color) { return; } // nothing to answer (it may just have ended)
		await this.endHintLevel(room, agree === true ? HINT_CHANGE.AGREED : HINT_CHANGE.DECLINED);
	}

	cancelHintLevel(conn) {
		const seat = this.seats.get(conn);
		if (seat?.room.hintRequest?.by == seat?.color) {
			this.endHintLevel(seat.room, HINT_CHANGE.CANCELLED);
		}
	}

	// Close the room's hint level request, if it has one (applying it if agreed), telling both players
	async endHintLevel(room, result) {
		if (!room.hintRequest) { return; }
		const message = { type: "hintLevelEnded", ...room.hintRequest, result };
		room.hintRequest = null;
		if (result == HINT_CHANGE.AGREED) {
			room.record.hintLevel = message.level;
			await this.save(room);
			this.log("Game " + room.record.code + ": hint level now " + message.level);
		}
		this.broadcast(room, message);
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
		const room = { record, state, conns: { w: null, b: null }, emptyTimer: null, rewind: null, hintRequest: null };
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
			hintLevel: room.record.hintLevel ?? "captures",
		});
		if (room.conns[opp]) {
			send(room.conns[opp], { type: "opponent", status: OPPONENT.CONNECTED });
		}
		if (room.rewind) {
			send(conn, { type: "rewind", ...room.rewind });
		}
		if (room.hintRequest) {
			send(conn, { type: "hintLevelAsked", ...room.hintRequest });
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

	/** @returns {import("../src/shared/protocol.js").ServerMessage} */
	moveMessage(room, seq) {
		// The position after move seq: the current one when it's the latest move (the usual case)
		let state = room.state;
		if (seq != room.record.moves.length - 1) {
			state = createInitialState();
			room.record.moves.slice(0, seq + 1).forEach(m => applyMove(state, m));
		}
		return { type: "move", seq, move: room.record.moves[seq], color: colorOfMove(seq), hash: positionHash(state) };
	}

	/** @param {import("../src/shared/protocol.js").ServerMessage} message */
	broadcast(room, message) {
		for (const color of COLORS) {
			if (room.conns[color]) { send(room.conns[color], message); }
		}
	}

	error(conn, code, message) {
		send(conn, { type: "error", code, message });
	}
}

/** @param {import("../src/shared/protocol.js").ServerMessage} message */
function send(conn, message) {
	try {
		conn.send(message);
	} catch {
		// The connection has gone; its close is handled separately
	}
}

export { GameServer, cleanMove, colorOfMove };
