// deploy/stamp-versions.js: the GitHub Pages copy of index.html sends every script and the stylesheet to an address
// carrying its version, so a browser never runs an old cached script with a new page.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdtempSync, cpSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stampIndex, stampSite } from "../../deploy/stamp-versions.js";

const root = fileURLToPath(new URL("../../", import.meta.url));

test("stamps the page's scripts and stylesheet, and maps every script's imports to its stamped address", () => {
	const html = '<head>\n    <link rel="stylesheet" href="style.css">\n    <script>/* plain */</script>\n'
		+ '    <script type="module" src="src/client/main.js"></script>\n</head>';
	const out = stampIndex(html, { "src/client/main.js": "aaa", "src/client/glyphs.js": "bbb", "style.css": "ccc" });
	assert.match(out, /href="style\.css\?v=ccc"/);
	assert.match(out, /src="src\/client\/main\.js\?v=aaa"/);
	const map = JSON.parse(out.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
	assert.deepEqual(map.imports, {
		"./src/client/glyphs.js": "./src/client/glyphs.js?v=bbb",
		"./src/client/main.js": "./src/client/main.js?v=aaa",
	});
	// The import map comes before the module script, as browsers need
	assert.ok(out.indexOf('type="importmap"') < out.indexOf('type="module"'));
});

test("refuses a page it can't stamp", () => {
	assert.throws(() => stampIndex("<head></head>", {}), /no module script/);
});

test("stamps a copy of the real site: every script under src/, each version changing with its file", () => {
	const dir = mkdtempSync(path.join(tmpdir(), "qhess-stamp-"));
	try {
		cpSync(path.join(root, "src"), path.join(dir, "src"), { recursive: true });
		for (const f of ["index.html", "style.css"]) { cpSync(path.join(root, f), path.join(dir, f)); }
		const versions = stampSite(dir);
		const scripts = readdirSync(path.join(dir, "src"), { recursive: true, encoding: "utf8" })
			.filter(f => f.endsWith(".js")).map(f => "src/" + f.split(path.sep).join("/"));
		const html = readFileSync(path.join(dir, "index.html"), "utf8");
		const map = JSON.parse(/** @type {RegExpMatchArray} */ (html.match(/<script type="importmap">([\s\S]*?)<\/script>/))[1]);
		assert.deepEqual(Object.keys(map.imports).sort(), scripts.map(f => "./" + f).sort());
		assert.match(html, new RegExp('src="src/client/main\\.js\\?v=' + versions["src/client/main.js"] + '"'));

		// Change one file and stamp again (from the original page): only its version changes
		cpSync(path.join(root, "index.html"), path.join(dir, "index.html"));
		writeFileSync(path.join(dir, "src/client/glyphs.js"), "// changed\n", { flag: "a" });
		const again = stampSite(dir);
		assert.notEqual(again["src/client/glyphs.js"], versions["src/client/glyphs.js"]);
		assert.equal(again["src/client/main.js"], versions["src/client/main.js"]);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
