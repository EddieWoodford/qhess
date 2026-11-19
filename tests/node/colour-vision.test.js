// tools/colour-vision.js: the colour-blindness simulation the theme generator checks its colours with

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../tools/colour-vision.js";

const { KINDS, MATRICES, simulate, deltaE, svgMatrix } = globalThis.ColourVision;

test("each kind keeps white, black and greys as they are", () => {
	for (const { id } of KINDS) {
		for (const grey of ["#ffffff", "#000000", "#808080", "#333333"]) {
			assert.ok(deltaE(simulate(grey, id), grey) < 1, id + " " + grey + " -> " + simulate(grey, id));
		}
	}
});

test("the colours each kind confuses look alike, and the ones it doesn't stay apart", () => {
	const red = "#d03030", green = "#3a8a30", blue = "#3050d0";
	assert.ok(deltaE(red, green) > 20, "apart with normal vision");
	// (protanopia less so, as it also darkens the red)
	for (const [kind, factor] of [["protanopia", 2], ["deuteranopia", 5]]) {
		assert.ok(deltaE(simulate(red, kind), simulate(green, kind)) < deltaE(red, green) / factor, kind + ": red and green");
		assert.ok(deltaE(simulate(red, kind), simulate(blue, kind)) > 20, kind + ": red and blue");
	}
	// Tritanopia: blue and green move together, red and green stay apart
	assert.ok(deltaE(simulate(red, "tritanopia"), simulate(green, "tritanopia")) > 20, "tritanopia: red and green");
	assert.ok(deltaE(simulate("#2a9df4", "tritanopia"), simulate("#2fbf71", "tritanopia")) < deltaE("#2a9df4", "#2fbf71") / 2,
		"tritanopia: blue and green");
	// Protanopia darkens red
	assert.ok(deltaE(simulate("#ff0000", "protanopia"), "#000000") < deltaE("#ff0000", "#000000") - 10, "red looks darker");
});

test("deltaE: zero for the same colour, about 100 from black to white", () => {
	assert.equal(deltaE("#123456", "#123456"), 0);
	assert.ok(Math.abs(deltaE("#000000", "#ffffff") - 100) < 0.5);
	assert.equal(simulate("#abcdef", "none"), "#abcdef");
});

test("the SVG filter matrices are the same matrices", () => {
	for (const { id } of KINDS) {
		const values = svgMatrix(id).trim().split(/\s+/).map(Number);
		assert.equal(values.length, 20);
		assert.deepEqual([0, 1, 2, 5, 6, 7, 10, 11, 12].map(i => values[i]), MATRICES[id]);
		assert.deepEqual(values.slice(15), [0, 0, 0, 1, 0]);
	}
});
