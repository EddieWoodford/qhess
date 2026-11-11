// Join links and their QR codes (src/client/join-link.js), and the server's network address for them.
// Each QR code is read back with a real QR reader (jsQR) to check it says what it should.

import { test } from "node:test";
import assert from "node:assert/strict";
import jsQR from "jsqr";
import { codeFromUrl, urlWithoutJoin, joinLink, qrMatrix, qrSvg } from "../../src/client/join-link.js";
import { startServer } from "../../server/server.js";

const at = href => new URL(href);

test("a join link keeps the page's address and adds the code", () => {
	assert.equal(joinLink("TIGER-42", at("https://someone.github.io/qhess/")),
		"https://someone.github.io/qhess/?join=TIGER-42");
	assert.equal(joinLink("TIGER-42", at("https://someone.github.io/qhess/index.html?join=OTTER-11#x")),
		"https://someone.github.io/qhess/index.html?join=TIGER-42");
	assert.equal(joinLink("TIGER-42", at("http://192.168.1.20:8000/")), "http://192.168.1.20:8000/?join=TIGER-42");
});

test("a join link made on a localhost page uses the network address", () => {
	assert.equal(joinLink("TIGER-42", at("http://localhost:8000/"), "192.168.1.20"),
		"http://192.168.1.20:8000/?join=TIGER-42");
	assert.equal(joinLink("TIGER-42", at("http://127.0.0.1:8001/"), "10.0.0.5"), "http://10.0.0.5:8001/?join=TIGER-42");
	// Without one it stays localhost; a page with a real address is never changed
	assert.equal(joinLink("TIGER-42", at("http://localhost:8000/")), "http://localhost:8000/?join=TIGER-42");
	assert.equal(joinLink("TIGER-42", at("https://someone.github.io/qhess/"), "192.168.1.20"),
		"https://someone.github.io/qhess/?join=TIGER-42");
});

test("the code is read from the address, however it was typed", () => {
	assert.equal(codeFromUrl(at("https://x.github.io/qhess/?join=TIGER-42")), "TIGER-42");
	assert.equal(codeFromUrl(at("http://localhost:8000/?join=tiger42")), "TIGER-42");
	assert.equal(codeFromUrl(at("http://localhost:8000/?join=nonsense")), null);
	assert.equal(codeFromUrl(at("http://localhost:8000/")), null);
});

test("taking the code out of the address leaves the rest", () => {
	assert.equal(urlWithoutJoin(at("https://x.github.io/qhess/?join=TIGER-42")), "https://x.github.io/qhess/");
	assert.equal(urlWithoutJoin(at("http://localhost:8000/?a=1&join=TIGER-42#h")), "http://localhost:8000/?a=1#h");
});

// Draw the QR code's squares as an image (with a white border) and read it with jsQR
function readQr(matrix, scale = 4, border = 4) {
	const size = (matrix.length + border * 2) * scale;
	const pixels = new Uint8ClampedArray(size * size * 4).fill(255);
	matrix.forEach((row, r) => row.forEach((dark, c) => {
		if (!dark) { return; }
		for (let y = 0; y < scale; y++) {
			for (let x = 0; x < scale; x++) {
				const i = (((r + border) * scale + y) * size + (c + border) * scale + x) * 4;
				pixels[i] = pixels[i + 1] = pixels[i + 2] = 0;
			}
		}
	}));
	return jsQR(pixels, size, size)?.data ?? null;
}

test("the QR code reads back as the link", () => {
	for (const link of [
		"http://192.168.1.20:8000/?join=TIGER-42",
		"https://someone.github.io/qhess_clone2025/?join=PENGUIN-07",
		"http://localhost:8000/?join=OWL-99",
	]) {
		assert.equal(readQr(qrMatrix(link)), link);
	}
});

test("the QR code's picture is an SVG of the same squares", () => {
	const link = "http://192.168.1.20:8000/?join=TIGER-42";
	const svg = qrSvg(link);
	assert.match(svg, /^<svg[^>]* viewBox="0 0 \d+ \d+"/);
	const darkSquares = qrMatrix(link).flat().filter(Boolean).length;
	assert.equal((svg.match(/M\d+,\d+l/g) ?? []).length, darkSquares);
});

test("the server says its network addresses", async () => {
	const server = await startServer({ port: 0, host: "127.0.0.1" });
	try {
		const res = await fetch("http://127.0.0.1:" + server.port + "/network-address");
		assert.equal(res.status, 200);
		const { addresses } = await res.json();
		assert.ok(Array.isArray(addresses));
		for (const a of addresses) { assert.match(a, /^\d+\.\d+\.\d+\.\d+$/); }
	} finally {
		await server.close();
	}
});
