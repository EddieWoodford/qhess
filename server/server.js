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

// Folders that are never served
const HIDDEN = ["node_modules", ".git", ".claude"];

// The only file a browser may write: the test page's "Record new snapshots" saves it
const WRITABLE = "tests/snapshots.json";

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
	if (rel == "" || rel.endsWith("/")) { rel += "index.html"; }
	const full = path.resolve(ROOT, rel);
	const relToRoot = path.relative(ROOT, full);
	if (relToRoot.startsWith("..") || path.isAbsolute(relToRoot) || HIDDEN.includes(relToRoot.split(path.sep)[0])) {
		return sendText(res, 403, "Forbidden");
	}
	if (req.method == "PUT") {
		if (relToRoot.split(path.sep).join("/") != WRITABLE) {
			return sendText(res, 403, "Only " + WRITABLE + " can be written");
		}
		const chunks = [];
		for await (const chunk of req) { chunks.push(chunk); }
		await writeFile(full, Buffer.concat(chunks));
		return sendText(res, 200, "Saved");
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
		httpServer.once("error", reject);
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

	// Use the first free port from firstPort
	let server;
	for (let port = firstPort; port < firstPort + 20 && !server; port++) {
		try {
			server = await startServer({ port, log });
		} catch (err) {
			if (err.code != "EADDRINUSE") { throw err; }
		}
	}
	if (!server) {
		console.error("No free port between " + firstPort + " and " + (firstPort + 19));
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

export { startServer };
