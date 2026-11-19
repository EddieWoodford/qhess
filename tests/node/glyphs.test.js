// The piece HTML drawn in a board square: always six grid cells, so missing types don't shift the rest.

import { test } from "node:test";
import assert from "node:assert/strict";
import { waveHTML } from "../../src/client/glyphs.js";

const cells = html => html.match(/<span[^>]*><\/span>/g);

test("an uncollapsed piece is six cells, empty spans for the types it can't be", () => {
	const html = waveHTML("KP", "w");
	const c = cells(html);
	assert.equal(c.length, 6);
	assert.match(c[0], /glyph-wK/);
	assert.equal(c[1], "<span></span>");
	assert.equal(c[4], "<span></span>");
	assert.match(c[5], /glyph-wP/);
	assert.doesNotMatch(html, /&nbsp;|<br>/);
});

test("a collapsed piece is one large symbol", () => {
	assert.equal(waveHTML("B", "b"),
		'<div class="blackpiececollapsed"><span class="glyph glyph-b glyph-bB"></span></div>');
});

test("types the move being made has ruled out are still drawn, marked lost", () => {
	const c = cells(waveHTML("QR", "w", "KP"));
	assert.equal(c.length, 6);
	assert.match(c[0], /glyph-wK glyph-lost/);
	assert.doesNotMatch(c[1], /glyph-lost/);
	assert.match(c[1], /glyph-wQ/);
	assert.equal(c[3], "<span></span>", "a type it couldn't be before either stays empty");
	assert.match(c[5], /glyph-wP glyph-lost/);
});

test("a piece the move collapses keeps its grid until it's submitted", () => {
	const c = cells(waveHTML("N", "b", "KQBRP"));
	assert.equal(c.length, 6);
	assert.equal(c.filter(x => /glyph-lost/.test(x)).length, 5);
	assert.doesNotMatch(c[4], /glyph-lost/);
});
