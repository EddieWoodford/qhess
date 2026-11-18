// The board themes in themes/: the list the game reads matches the folder, and every theme sets everything a theme
// needs (style.css 1.1).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("../../themes/", import.meta.url));
const files = readdirSync(dir).filter(f => f.endsWith(".css")).sort();

test("themes/index.json lists exactly the theme files (the local server rewrites it; commit it with a new theme)", () => {
	assert.deepEqual(JSON.parse(readFileSync(dir + "index.json", "utf8")), files);
});

const REQUIRED = [
	"--theme-name", "--theme-page",
	"--board-white-col", "--board-black-col", "--board-square-border",
	..."KQRBNP".split("").map(t => "--white-" + t),
	"--glyph-w-bg", "--glyph-b-bg", "--glyph-radius", "--glyph-padding", "--glyph-margin", "--glyph-shadow",
	"--glyph-line-height", "--uncollapsed-size", "--collapsed-size",
	...["w", "b"].flatMap(s => "KQRBNP".split("").map(t => "--piece-" + s + t)),
	"--piece-selectedStart-col", "--piece-dest-col", "--piece-checkKing-col", "--piece-checkAttacker-col",
];

for (const file of files) {
	test("theme " + file + " sets every theme variable, under .qhess-theme", () => {
		const css = readFileSync(dir + file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
		assert.match(css, /\.qhess-theme\s*\{/);
		const set = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
		assert.deepEqual(REQUIRED.filter(v => !set.has(v)), []);
		assert.match(css, /--theme-page:\s*(dark|light)\s*;/);
	});
}
