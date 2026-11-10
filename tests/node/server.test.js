// Levels 2 and 3: the real server with two scripted players over websockets.
// Every example game is played through it, each player sending its own colour's moves, and checked after every
// move against tests/snapshots.json. Then the things that go wrong: bad requests, out-of-turn and illegal
// moves, dropped connections, resent moves, and abandoned games.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { startServer, startOnFreePort } from "../../server/server.js";
import { colorOfMove } from "../../server/rooms.js";
import { normalizeCode } from "../../src/shared/protocol.js";
import { TestClient } from "./test-client.js";
import { exampleGames, snapshots, moveFromLine, historyAsLines } from "./helpers.js";

const games = exampleGames();
const snaps = snapshots();
const NO_MOVE = { notAKing: null, from: null, to: null, enPassant: false, promotion: false, castle: false, pcKing: null, pcAttackers: [] };

let server;
const clients = [];

before(async () => {
	server = await startServer({ port: 0, host: "127.0.0.1", emptyRoomMs: 200 });
});

after(async () => {
	for (const c of clients) { c.close(); }
	await server.close();
});

async function client(name) {
	const c = new TestClient(server.port, name);
	clients.push(c);
	await c.open();
	return c;
}

// Two players in a new game. creatorColor: "w", "b" or "random". Returns { creator, joiner, w, b, code }.
async function newGame(creatorColor = "w") {
	const creator = await client("creator");
	const joiner = await client("joiner");
	const created = await creator.request({ type: "create", color: creatorColor }, "welcome");
	assert.equal(created.opponent, "waiting");
	assert.deepEqual(created.moves, []);
	assert.match(created.code, /^[A-Z]+-\d\d$/);
	const joined = await joiner.request({ type: "join", code: created.code }, "welcome");
	assert.equal(joined.code, created.code);
	assert.notEqual(joined.color, created.color);
	assert.notEqual(joined.token, created.token);
	assert.equal(joined.opponent, "connected");
	assert.equal((await creator.next("opponent")).status, "connected");
	const byColor = { [created.color]: creator, [joined.color]: joiner };
	return { creator, joiner, w: byColor.w, b: byColor.b, code: created.code };
}

// Play line number seq of a game file from the right player, and check both players get it and agree with the
// snapshot. Returns the move message.
async function playLine(players, lines, seq, snap) {
	const mover = players[colorOfMove(seq)];
	mover.send({ type: "move", seq, move: moveFromLine(lines[seq]) });
	const seen = [];
	for (const p of [players.w, players.b]) {
		const msg = await p.next("move", m => m.seq == seq);
		assert.equal(msg.color, colorOfMove(seq));
		assert.equal(msg.hash, msg.localHash, "player's copy matches the server after move " + seq);
		if (snap) { assert.equal(msg.hash, snap.plyHashes[seq], "position after ply " + seq + " (" + lines[seq] + ")"); }
		seen.push(msg);
	}
	assert.deepEqual(seen[0].move, seen[1].move);
	return seen[0];
}

////////////////////////////////
// Whole games
////////////////////////////////

games.forEach(({ name, lines }, gi) => {
	test("two players play " + name + " through the server", async () => {
		const players = await newGame(gi % 2 == 0 ? "w" : "b");
		for (let seq = 0; seq < lines.length; seq++) {
			await playLine(players, lines, seq, snaps.games[name]);
		}
		for (const p of [players.w, players.b]) {
			assert.deepEqual(historyAsLines(p.state.history), lines, "written history");
		}
		players.creator.send({ type: "leave" });
		assert.equal((await players.joiner.next("ended")).reason, "opponent_left");
	});
});

////////////////////////////////
// Starting and joining
////////////////////////////////

test("random colour gives the creator either colour", async () => {
	const colors = new Set();
	for (let i = 0; i < 20 && colors.size < 2; i++) {
		const c = await client("random");
		colors.add((await c.request({ type: "create", color: "random" }, "welcome")).color);
		c.send({ type: "leave" });
	}
	assert.deepEqual([...colors].sort(), ["b", "w"]);
});

test("join codes are forgiving about how they're typed", async () => {
	assert.equal(normalizeCode("tiger 42"), "TIGER-42");
	assert.equal(normalizeCode(" Tiger-42 "), "TIGER-42");
	assert.equal(normalizeCode("TIGER42"), "TIGER-42");
	assert.equal(normalizeCode("42"), null);
	assert.equal(normalizeCode(undefined), null);
	const creator = await client("creator");
	const { code } = await creator.request({ type: "create", color: "w" }, "welcome");
	const joiner = await client("joiner");
	const typed = code.toLowerCase().replace("-", " ");
	assert.equal((await joiner.request({ type: "join", code: typed }, "welcome")).code, code);
});

test("joining a game that doesn't exist, or is full", async () => {
	const c = await client("lost");
	assert.equal((await c.request({ type: "join", code: "NOPE-00" }, "error")).code, "not_found");
	assert.equal((await c.request({ type: "join", code: "nonsense" }, "error")).code, "not_found");
	const { code } = await newGame();
	assert.equal((await c.request({ type: "join", code }, "error")).code, "full");
});

test("bad requests are refused without harm", async () => {
	const c = await client("bad");
	assert.equal((await c.request("not json", "error")).code, "bad_request");
	assert.equal((await c.request({ type: "dance" }, "error")).code, "bad_request");
	assert.equal((await c.request({ type: "create", color: "purple" }, "error")).code, "bad_request");
	assert.equal((await c.request({ type: "move", seq: 0, move: NO_MOVE }, "error")).code, "not_in_game");
	assert.equal((await c.request({ type: "resume", code: "NOPE-00", token: "x" }, "error")).code, "not_found");
	assert.equal((await c.request({ type: "ping" }, "pong")).type, "pong");
});

////////////////////////////////
// Moves that aren't allowed
////////////////////////////////

test("moves out of turn, illegal moves and junk are rejected, and the game carries on", async () => {
	const { lines } = games[0];
	const players = await newGame("w");
	// White can't play Black's move 0
	assert.match((await players.w.request({ type: "move", seq: 0, move: NO_MOVE }, "rejected")).error, /turn/);
	await playLine(players, lines, 0);
	// Black can't move twice
	assert.match((await players.b.request({ type: "move", seq: 1, move: moveFromLine(lines[1]) }, "rejected")).error, /turn/);
	// White can't move a Black piece, or make an impossible move, or send junk
	const blackPiece = { ...NO_MOVE, from: [1, 4], to: [2, 4] };
	assert.equal((await players.w.request({ type: "move", seq: 1, move: blackPiece }, "rejected")).seq, 1);
	const impossible = { ...NO_MOVE, from: [6, 0], to: [3, 1] }; // a2-b5: no piece moves like that
	assert.equal((await players.w.request({ type: "move", seq: 1, move: impossible }, "rejected")).seq, 1);
	const junk = { ...NO_MOVE, from: [9, 9], to: "e4" };
	assert.match((await players.w.request({ type: "move", seq: 1, move: junk }, "rejected")).error, /isn't a move/);
	assert.match((await players.w.request({ type: "move", seq: 1, move: null }, "rejected")).error, /isn't a move/);
	// Nothing was played: the real move still goes through
	await playLine(players, lines, 1, snaps.games[games[0].name]);
});

test("nobody can move before the second player joins", async () => {
	const c = await client("alone");
	await c.request({ type: "create", color: "b" }, "welcome");
	assert.match((await c.request({ type: "move", seq: 0, move: NO_MOVE }, "rejected")).error, /opponent/);
});

test("a move with the wrong number gets the whole game back instead", async () => {
	const { lines } = games[0];
	const players = await newGame("w");
	await playLine(players, lines, 0);
	await playLine(players, lines, 1);
	// Black thinks it's still move 0, and sends a different move 0
	const sync = await players.b.request({ type: "move", seq: 0, move: { ...NO_MOVE, pcKing: [6, 4], pcAttackers: [[1, 4]] } }, "sync");
	assert.equal(sync.moves.length, 2);
	// ... or skips ahead
	assert.equal((await players.b.request({ type: "move", seq: 5, move: NO_MOVE }, "sync")).moves.length, 2);
	assert.equal((await players.b.request({ type: "sync" }, "sync")).moves.length, 2);
});

////////////////////////////////
// Dropped connections
////////////////////////////////

test("a player who drops out can resume and finish the game", async () => {
	const { name, lines } = games[2];
	const snap = snaps.games[name];
	const players = await newGame("w");
	const half = Math.floor(lines.length / 2);
	for (let seq = 0; seq < half; seq++) {
		await playLine(players, lines, seq, snap);
	}
	// Black's connection dies; White is told, and the seat is kept
	const { code, token } = players.b;
	players.b.kill();
	assert.equal((await players.w.next("opponent")).status, "disconnected");
	// Black comes back on a new connection, and gets the whole game so far
	const b2 = await client("black again");
	const welcome = await b2.request({ type: "resume", code, token }, "welcome");
	assert.equal(welcome.color, "b");
	assert.equal(welcome.opponent, "connected");
	assert.equal(welcome.moves.length, half);
	assert.equal(b2.hash(), snap.plyHashes[half - 1]);
	assert.equal((await players.w.next("opponent")).status, "connected");
	players.b = b2;
	for (let seq = half; seq < lines.length; seq++) {
		await playLine(players, lines, seq, snap);
	}
	assert.deepEqual(historyAsLines(b2.state.history), lines);
});

test("a move resent after a reconnect is confirmed, not played twice", async () => {
	const { name, lines } = games[0];
	const snap = snaps.games[name];
	const players = await newGame("w");
	await playLine(players, lines, 0, snap);
	// White sends move 1, and the connection drops before White sees the answer
	players.w.send({ type: "move", seq: 1, move: moveFromLine(lines[1]) });
	await players.b.next("move", m => m.seq == 1); // the server did play it
	const { code, token } = players.w;
	players.w.kill();
	await players.b.next("opponent", m => m.status == "disconnected");
	// White reconnects and, not knowing whether it went through, sends it again
	const w2 = await client("white again");
	const welcome = await w2.request({ type: "resume", code, token }, "welcome");
	assert.equal(welcome.moves.length, 2);
	w2.useMoves(welcome.moves.slice(0, 1)); // pretend this copy hadn't seen it, so it's checked again when it arrives
	w2.send({ type: "move", seq: 1, move: moveFromLine(lines[1]) });
	const ack = await w2.next("move", m => m.seq == 1);
	assert.equal(ack.hash, snap.plyHashes[1]);
	assert.equal(ack.localHash, ack.hash);
	// Still only two moves; Black hasn't been sent anything more
	assert.equal((await w2.request({ type: "sync" }, "sync")).moves.length, 2);
	players.w = w2;
	await playLine(players, lines, 2, snap);
});

test("resuming from a second tab takes the seat over from the first", async () => {
	const players = await newGame("w");
	const { code, token } = players.w;
	const other = await client("second tab");
	await other.request({ type: "resume", code, token }, "welcome");
	assert.equal((await players.w.next("error")).code, "replaced");
	await players.w.waitClosed();
	// Black isn't told White left, only that White is (still) connected
	assert.equal((await players.b.next("opponent")).status, "connected");
	assert.equal((await other.request({ type: "resume", code, token: "wrong" }, "error")).code, "bad_token");
});

test("a game nobody is connected to is closed after a while", async () => {
	const players = await newGame("w");
	const { code, token } = players.w;
	players.w.kill();
	players.b.kill();
	await new Promise(r => setTimeout(r, 400)); // emptyRoomMs is 200 in these tests
	const c = await client("too late");
	assert.equal((await c.request({ type: "resume", code, token }, "error")).code, "not_found");
});

test("a game with one player still connected is kept", async () => {
	const players = await newGame("w");
	const { code, token } = players.b;
	players.b.kill();
	await players.w.next("opponent", m => m.status == "disconnected");
	await new Promise(r => setTimeout(r, 400));
	const b2 = await client("back later");
	assert.equal((await b2.request({ type: "resume", code, token }, "welcome")).color, "b");
});

test("leaving closes the game for both players", async () => {
	const players = await newGame("b");
	players.w.send({ type: "leave" });
	assert.equal((await players.b.next("ended")).reason, "opponent_left");
	const c = await client("late joiner");
	assert.equal((await c.request({ type: "join", code: players.code }, "error")).code, "not_found");
});

////////////////////////////////
// Files
////////////////////////////////

// The status for a request path sent exactly as written (fetch would tidy up ".." first)
function rawStatus(path) {
	return new Promise((resolve, reject) => {
		http.get({ host: "127.0.0.1", port: server.port, path }, res => { res.resume(); resolve(res.statusCode); }).on("error", reject);
	});
}

test("serves the game's files and nothing it shouldn't", async () => {
	const url = p => "http://127.0.0.1:" + server.port + p;
	const home = await fetch(url("/"));
	assert.equal(home.status, 200);
	assert.match(await home.text(), /<title>Qhess<\/title>/);
	const js = await fetch(url("/src/shared/protocol.js"));
	assert.match(js.headers.get("content-type"), /javascript/);
	assert.equal((await fetch(url("/node_modules/ws/package.json"))).status, 403);
	assert.equal(await rawStatus("/..%5c..%5csecret.txt"), 403);
	assert.ok([403, 404].includes(await rawStatus("/%2e%2e/%2e%2e/secret.txt"))); // tidied up, or refused
	assert.equal(await rawStatus("/../package.json"), 200); // tidied to /package.json, inside the project
	assert.equal((await fetch(url("/missing.js"))).status, 404);
	assert.equal((await fetch(url("/index.html"), { method: "PUT", body: "x" })).status, 403);
});

////////////////////////////////
// Starting up
////////////////////////////////

test("a port that can't be used is skipped, without crashing", async () => {
	// The port the shared server has is taken; Windows-reserved ports fail the same way (EACCES instead)
	const skipped = [];
	const second = await startOnFreePort(server.port, { host: "127.0.0.1" }, port => skipped.push(port));
	try {
		assert.equal(skipped[0], server.port); // (the next port may happen to be taken too, by another test)
		assert.ok(second.port > server.port);
		assert.equal((await fetch("http://127.0.0.1:" + second.port + "/")).status, 200);
	} finally {
		await second.close();
	}
	await assert.rejects(startServer({ port: server.port, host: "127.0.0.1" }), { code: "EADDRINUSE" });
});
