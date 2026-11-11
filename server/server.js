// The Qhess server: serves the game's files, and runs multiplayer games over a websocket at /ws.
//
//   npm start                      (or double-click start.bat)
//   node server/server.js --port 8000 --no-browser --open tests/test.html
//
// It listens on every network interface, so a friend on the same network can open the address it prints.
// Single player needs nothing from the server beyond the files.

import http from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { exec } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { GameServer } from "./rooms.js";
import { SOCKET_PATH } from "../src/shared/protocol.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const MIME = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".txt": "text/plain; charset=utf-8",
	".md": "text/plain; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".ico": "image/x-icon",
	".woff2": "font/woff2",
};

// What a browser may fetch: the page, and the folders it (and the browser test page) loads from. Everything else,
// such as the server's own code, .git and node_modules, is refused. A path must start with one of these exactly as
// written: on Windows other spellings reach the same file (".GIT", or the short name "GIT~1"), so a list of what
// to hide can't be relied on.
const PUBLIC = ["index.html", "style.css", "src", "tests", "example_games"];

// The only file a browser may write: the test page's "Record new snapshots" saves it. Only from this computer
// (the server is open to the whole network), only JSON, and only up to this size.
const WRITABLE = "tests/snapshots.json";
const MAX_WRITE_BYTES = 1024 * 1024;

// How often to check each websocket is still alive (a dead one is dropped, and its seat kept for a reconnect)
const HEARTBEAT_MS = 15000;

function sendText(res, status, text) {
	res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
	res.end(text);
}

async function serveFile(req, res) {
	let rel;
	try {
		rel = decodeURIComponent(new URL(req.url, "http://localhost").pathname).replace(/^\/+/, "");
	} catch {
		return sendText(res, 400, "Bad request");
	}
	// This computer's address on the network, for the page's join links (src/client/join-link.js)
	if (rel == "network-address") {
		res.writeHead(200, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
		return res.end(JSON.stringify({ addresses: lanAddresses() }));
	}
	if (rel == "" || rel.endsWith("/")) { rel += "index.html"; }
	const full = path.resolve(ROOT, rel);
	const relToRoot = path.relative(ROOT, full);
	if (relToRoot.startsWith("..") || path.isAbsolute(relToRoot) || !PUBLIC.includes(relToRoot.split(path.sep)[0])) {
		return sendText(res, 403, "Forbidden");
	}
	if (req.method == "PUT") {
		return writeSnapshots(req, res, relToRoot.split(path.sep).join("/"), full);
	}
	if (req.method != "GET" && req.method != "HEAD") {
		return sendText(res, 405, "Method not allowed");
	}
	try {
		const body = await readFile(full);
		res.writeHead(200, {
			"Content-Type": MIME[path.extname(full).toLowerCase()] ?? "application/octet-stream",
			"Cache-Control": "no-store", // so edits show up on a normal refresh
		});
		res.end(req.method == "HEAD" ? undefined : body);
	} catch {
		sendText(res, 404, "Not found: " + rel);
	}
}

// A PUT of the one writable file (see WRITABLE)
async function writeSnapshots(req, res, rel, full) {
	if (rel != WRITABLE) {
		return sendText(res, 403, "Only " + WRITABLE + " can be written");
	}
	if (!isFromThisComputer(req)) {
		return sendText(res, 403, WRITABLE + " can only be written from this computer");
	}
	// The body is exactly Content-Length bytes (Node holds the client to it), so checking it caps the upload
	const length = Number(req.headers["content-length"]);
	if (!Number.isInteger(length)) {
		return sendText(res, 411, "Content-Length needed");
	}
	if (length > MAX_WRITE_BYTES) {
		res.setHeader("Connection", "close"); // and don't read the rest
		return sendText(res, 413, "Too large");
	}
	const chunks = [];
	for await (const chunk of req) { chunks.push(chunk); }
	const body = Buffer.concat(chunks);
	try {
		JSON.parse(body.toString("utf8"));
	} catch {
		return sendText(res, 400, WRITABLE + " must be JSON");
	}
	await writeFile(full, body);
	return sendText(res, 200, "Saved");
}

// Did the request come from this computer (not another one on the network)?
function isFromThisComputer(req) {
	return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress);
}

// Start the server. Returns { port, gameServer, close() } once it's listening.
// options: port (0 = any free port), host, log, and anything GameServer takes (store, emptyRoomMs, ...)
function startServer(options = {}) {
	const log = options.log ?? (() => {});
	const gameServer = new GameServer({ ...options, log });
	const httpServer = http.createServer((req, res) => {
		serveFile(req, res).catch(err => {
			log("Error serving " + req.url + ": " + err);
			if (!res.headersSent) { sendText(res, 500, "Server error"); }
		});
	});

	const wss = new WebSocketServer({ server: httpServer, path: SOCKET_PATH, maxPayload: 64 * 1024 });
	// The websocket server repeats the HTTP server's errors (such as a port that can't be used); those are
	// handled where the HTTP server starts listening, below
	wss.on("error", () => {});
	wss.on("connection", ws => {
		const conn = {
			send(message) {
				if (ws.readyState == ws.OPEN) { ws.send(JSON.stringify(message)); }
			},
			close() {
				ws.close(4000, "replaced");
			},
		};
		ws.isAlive = true;
		ws.on("pong", () => { ws.isAlive = true; });
		ws.on("message", (data, isBinary) => {
			ws.isAlive = true;
			gameServer.handle(conn, isBinary ? "" : data.toString());
		});
		ws.on("close", () => gameServer.disconnect(conn));
		ws.on("error", () => {});
	});

	// Drop connections that have stopped answering (a laptop lid closed, a network gone)
	const heartbeat = setInterval(() => {
		for (const ws of wss.clients) {
			if (!ws.isAlive) {
				ws.terminate();
				continue;
			}
			ws.isAlive = false;
			ws.ping();
		}
	}, options.heartbeatMs ?? HEARTBEAT_MS);

	return new Promise((resolve, reject) => {
		httpServer.once("error", err => {
			// Couldn't start (e.g. the port is taken): tidy up so another port can be tried
			clearInterval(heartbeat);
			gameServer.close();
			wss.close();
			reject(err);
		});
		httpServer.listen(options.port ?? 8000, options.host, () => {
			resolve({
				port: httpServer.address().port,
				gameServer,
				close() {
					clearInterval(heartbeat);
					gameServer.close();
					for (const ws of wss.clients) { ws.terminate(); }
					wss.close();
					return new Promise(done => httpServer.close(() => done()));
				},
			});
		});
	});
}

// Start the server on the first port from firstPort that can be used. A port is skipped if another program
// has it (EADDRINUSE) or the system won't allow it (EACCES: Windows reserves some ports, often including 8000).
// onSkip(port) is called for each port skipped.
async function startOnFreePort(firstPort, options = {}, onSkip = () => {}, tries = 20) {
	for (let port = firstPort; port < firstPort + tries; port++) {
		try {
			return await startServer({ ...options, port });
		} catch (err) {
			if (err.code != "EADDRINUSE" && err.code != "EACCES") { throw err; }
			onSkip(port);
		}
	}
	throw new Error("No usable port between " + firstPort + " and " + (firstPort + tries - 1));
}

// The addresses another computer on this network could use to reach this one
function lanAddresses() {
	return Object.values(networkInterfaces()).flat()
		.filter(a => a && a.family == "IPv4" && !a.internal)
		.map(a => a.address);
}

async function main() {
	const args = process.argv.slice(2);
	const arg = name => {
		const i = args.indexOf(name);
		return i > -1 ? args[i + 1] : undefined;
	};
	const firstPort = Number(arg("--port") ?? process.env.PORT ?? 8000);
	const log = text => console.log(new Date().toLocaleTimeString() + "  " + text);

	let server;
	try {
		server = await startOnFreePort(firstPort, { log }, port => {
			console.log("Port " + port + " is in use or reserved by Windows; trying " + (port + 1));
		});
	} catch (err) {
		console.error(err.message);
		process.exit(1);
	}
	const url = "http://localhost:" + server.port + "/";
	console.log("Qhess server running.");
	console.log("  On this computer:   " + url + "   (tests: " + url + "tests/test.html)");
	for (const address of lanAddresses()) {
		console.log("  On your network:    http://" + address + ":" + server.port + "/");
	}
	console.log("Press Ctrl+C to stop. Games in progress are lost when it stops.");

	if (!args.includes("--no-browser")) {
		const page = url + (arg("--open") ?? "").replace(/^\/+/, "");
		const opener = process.platform == "win32" ? 'start "" ' : process.platform == "darwin" ? "open " : "xdg-open ";
		exec(opener + '"' + page + '"');
	}
}

if (process.argv[1] && path.resolve(process.argv[1]) == fileURLToPath(import.meta.url)) {
	main();
}

export { startServer, startOnFreePort };
