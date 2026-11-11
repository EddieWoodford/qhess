// The browser's multiplayer session (src/client/socket-session.js), run in Node against the real server with
// Node's built-in WebSocket: whole games played through submitMove, and the connection dropping mid-game.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer } from "../../server/server.js";
import { colorOfMove } from "../../server/rooms.js";
import { SocketSession, savedSeat } from "../../src/client/socket-session.js";
import { socketUrl, usesHostedServer, HOSTED_SERVER } from "../../src/client/server-address.js";
import { positionHash } from "../../src/engine/position-hash.js";
import { exampleGames, snapshots, moveFromLine, historyAsLines } from "./helpers.js";

const games = exampleGames();
const snaps = snapshots();

let server;
const sessions = [];

before(async () => {
	server = await startServer({ port: 0, host: "127.0.0.1" });
});

after(async () => {
	for (const s of sessions) { s.leave(); }
	await server.close();
});

function memoryStorage() {
	const items = new Map();
	return { getItem: k => items.get(k) ?? null, setItem: (k, v) => items.set(k, v), removeItem: k => items.delete(k) };
}

function session(url = "ws://127.0.0.1:" + server.port + "/ws") {
	const s = new SocketSession({ url, storage: memoryStorage() });
	s.errors = [];
	s.onEvent(e => { if (e.type == "error") { s.errors.push(e); } });
	sessions.push(s);
	return s;
}

async function waitFor(what, check, ms = 4000) {
	const end = Date.now() + ms;
	while (!check()) {
		if (Date.now() > end) { throw new Error("timed out waiting for " + what); }
		await new Promise(r => setTimeout(r, 5));
	}
}

async function newGame(color = "w") {
	const creator = session();
	creator.start({ create: color });
	await waitFor("game created", () => creator.info().phase == "playing");
	const joiner = session();
	joiner.start({ join: creator.info().code.toLowerCase() });
	await waitFor("game joined", () => joiner.info().phase == "playing" && creator.info().opponent == "connected");
	const byColor = { [creator.color]: creator, [joiner.color]: joiner };
	return { creator, joiner, w: byColor.w, b: byColor.b };
}

// Play line seq from the right player and wait for both to have it
async function play(players, lines, seq, snap) {
	const mover = players[colorOfMove(seq)];
	const waiter = players[colorOfMove(seq + 1)];
	const result = mover.submitMove(moveFromLine(lines[seq]));
	assert.deepEqual(result, { ok: true, pending: true }, "submit ply " + seq + " (" + lines[seq] + ")");
	assert.equal(mover.info().pending, true);
	// The other player can't move meanwhile
	assert.equal(waiter.submitMove(moveFromLine(lines[seq])).ok, false);
	await waitFor("move " + seq + " to arrive", () => mover.moves.length > seq && waiter.moves.length > seq && !mover.pending);
	if (snap) {
		assert.equal(positionHash(mover.getState()), snap.plyHashes[seq], "position after ply " + seq);
		assert.equal(positionHash(waiter.getState()), snap.plyHashes[seq], "position after ply " + seq);
	}
}

for (const { name, lines } of [games[1], games[3]]) {
	test("two browser sessions play " + name, async () => {
		const players = await newGame("b");
		let changes = 0;
		players.w.onChange(() => changes++);
		for (let seq = 0; seq < lines.length; seq++) {
			await play(players, lines, seq, snaps.games[name]);
		}
		assert.ok(changes >= lines.length, "the page is told about every move");
		assert.deepEqual(historyAsLines(players.b.getState().history), lines);
		assert.deepEqual(players.w.errors, []);
	});
}

test("the seat is remembered for a page reload, and forgotten on leaving", async () => {
	const { creator } = await newGame("w");
	assert.deepEqual(savedSeat(creator.storage), { code: creator.code, token: creator.token });
	creator.leave();
	assert.equal(savedSeat(creator.storage), null);
	assert.equal(creator.info().phase, "left");
});

test("a reloaded page resumes its seat from the saved code and token", async () => {
	const { name, lines } = games[0];
	const players = await newGame("w");
	await play(players, lines, 0);
	await play(players, lines, 1);
	const seat = savedSeat(players.b.storage);
	players.b.ws.close(); // as if the tab closed...
	players.b.phase = "left"; // ...and this session is gone
	const reloaded = session();
	reloaded.start({ resume: seat });
	await waitFor("resumed", () => reloaded.info().phase == "playing");
	assert.equal(reloaded.color, "b");
	assert.equal(reloaded.moves.length, 2);
	players.b = reloaded;
	await play(players, lines, 2, snaps.games[name]);
});

test("a dropped connection reconnects by itself and the game carries on", async () => {
	const { name, lines } = games[0];
	const snap = snaps.games[name];
	const players = await newGame("w");
	await play(players, lines, 0, snap);
	players.w.ws.close(); // the network drops
	await waitFor("reconnecting", () => players.w.info().connection == "reconnecting");
	await waitFor("opponent told", () => players.b.info().opponent == "disconnected");
	await waitFor("reconnected", () => players.w.info().connection == "connected");
	await waitFor("opponent told", () => players.b.info().opponent == "connected");
	for (let seq = 1; seq < 6; seq++) {
		await play(players, lines, seq, snap);
	}
});

test("a move made while disconnected is sent once the connection is back", async () => {
	const { name, lines } = games[0];
	const snap = snaps.games[name];
	const players = await newGame("w");
	await play(players, lines, 0, snap);
	players.w.ws.close();
	await waitFor("reconnecting", () => players.w.info().connection == "reconnecting");
	assert.deepEqual(players.w.submitMove(moveFromLine(lines[1])), { ok: true, pending: true });
	await waitFor("move delivered", () => players.b.moves.length == 2 && !players.w.pending);
	assert.equal(positionHash(players.b.getState()), snap.plyHashes[1]);
	assert.equal(players.w.moves.length, 2);
});

test("a move lost between server and player is caught up from a sync", async () => {
	const { name, lines } = games[0];
	const snap = snaps.games[name];
	const players = await newGame("w");
	await play(players, lines, 0, snap);
	// Black's copy drops the last move, as if a message had been lost; the next move then doesn't follow on
	players.b.useMoves(players.b.moves.slice(0, 0));
	players.w.submitMove(moveFromLine(lines[1]));
	await waitFor("black caught up", () => players.b.moves.length == 2);
	assert.equal(positionHash(players.b.getState()), snap.plyHashes[1]);
});

test("a game that has gone can't be resumed", async () => {
	const s = session();
	s.start({ resume: { code: "NOPE-00", token: "x" } });
	await waitFor("ended", () => s.info().phase == "ended");
	assert.equal(s.info().endedReason, "not_found");
	assert.equal(s.errors.at(-1).fatal, true);
});

test("a wrong code says so", async () => {
	const s = session();
	s.start({ join: "NOPE-00" });
	await waitFor("ended", () => s.info().phase == "ended");
	assert.match(s.errors.at(-1).message, /no game/i);
});

test("when the opponent leaves, the game ends", async () => {
	const players = await newGame("w");
	players.b.leave();
	await waitFor("ended", () => players.w.info().phase == "ended");
	assert.equal(players.w.info().endedReason, "opponent_left");
	assert.equal(players.w.submitMove(moveFromLine(games[0].lines[0])).ok, false);
});

test("no server: says the server is starting, then gives up", async () => {
	const s = new SocketSession({ url: "ws://127.0.0.1:1/ws", storage: memoryStorage(), startWaitMs: 4500 });
	sessions.push(s);
	s.start({ create: "w" });
	assert.equal(s.info().serverStarting, false);
	await waitFor("server starting", () => s.info().serverStarting, 4000);
	assert.equal(s.info().phase, "connecting");
	await waitFor("gave up", () => s.info().phase == "ended", 4000);
	assert.equal(s.info().endedReason, "unreachable");
	assert.equal(s.info().serverStarting, false);
});

test("the server address: the page's own server, or the hosted one from GitHub Pages", () => {
	const at = href => new URL(href);
	assert.equal(socketUrl(at("http://localhost:8000/")), "ws://localhost:8000/ws");
	assert.equal(socketUrl(at("http://192.168.1.5:8001/")), "ws://192.168.1.5:8001/ws");
	assert.equal(socketUrl(at("https://qhess.onrender.com/")), "wss://qhess.onrender.com/ws");
	assert.equal(socketUrl(at("https://someone.github.io/qhess/")), "wss://" + HOSTED_SERVER + "/ws");
	assert.equal(usesHostedServer(at("https://someone.github.io/qhess/")), true);
	assert.equal(usesHostedServer(at("http://localhost:8000/")), false);
	assert.equal(usesHostedServer(undefined), false);
});
