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
