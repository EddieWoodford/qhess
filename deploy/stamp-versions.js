// Stamps a copy of the site for GitHub Pages so that a browser never runs an old cached script with a new page.
// Run by .github/workflows/pages.yml on the copy it deploys, not on the repo:
//
//   node deploy/stamp-versions.js _site
//
// Pages lets browsers keep every file for 10 minutes, each on its own clock, so just after a deploy a new
// index.html could run with an old cached script. Each script and the stylesheet get an address carrying a hash of
// their contents (Pages ignores the ?v=… part and serves the file as usual): a changed file has a new address, so it
// is fetched fresh, and an unchanged one stays cached. The scripts import each other by relative paths, which can't
// carry a version, so an import map in index.html sends each of them to its stamped address.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The first 10 hex digits of the file's SHA-256: changes whenever the file does
function versionOf(file) {
	return createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 10);
}

// Every .js file under dir, as paths relative to root with forward slashes
function scriptsUnder(root, dir) {
	return readdirSync(path.join(root, dir)).flatMap(name => {
		const rel = dir + "/" + name;
		if (statSync(path.join(root, rel)).isDirectory()) { return scriptsUnder(root, rel); }
		return name.endsWith(".js") ? [rel] : [];
	});
}

// index.html with the versions in it. versions: { "src/client/main.js": "1a2b3c4d5e", "style.css": …, … }.
// Adds an import map (before the first module script, as it must be) for every script, and stamps the page's own
// module script and stylesheet links, which an import map doesn't reach.
function stampIndex(html, versions) {
	const stamped = rel => "./" + rel + "?v=" + versions[rel];
	const scripts = Object.keys(versions).filter(rel => rel.endsWith(".js")).sort();
	const map = { imports: Object.fromEntries(scripts.map(rel => ["./" + rel, stamped(rel)])) };
	const firstModule = html.search(/<script type="module"/);
	if (firstModule < 0) { throw new Error("index.html has no module script to stamp"); }
	if (html.includes('type="importmap"')) { throw new Error("index.html already has an import map"); }
	const indent = html.slice(html.lastIndexOf("\n", firstModule) + 1, firstModule);
	html = html.slice(0, firstModule)
		+ '<script type="importmap">\n' + JSON.stringify(map, null, "\t") + "\n" + indent + "</script>\n" + indent
		+ html.slice(firstModule);
	return html.replace(/(<script type="module" src="|<link rel="stylesheet" href=")([^"?]+)"/g,
		(all, start, rel) => versions[rel] ? start + rel + "?v=" + versions[rel] + '"' : all);
}

// Stamp dir/index.html with the versions of dir's scripts (under src/) and dir/style.css
function stampSite(dir) {
	const files = [...scriptsUnder(dir, "src"), "style.css"];
	const versions = Object.fromEntries(files.map(rel => [rel, versionOf(path.join(dir, rel))]));
	const index = path.join(dir, "index.html");
	writeFileSync(index, stampIndex(readFileSync(index, "utf8"), versions));
	return versions;
}

if (process.argv[1] && path.resolve(process.argv[1]) == fileURLToPath(import.meta.url)) {
	const dir = process.argv[2];
	if (!dir) {
		console.error("Usage: node deploy/stamp-versions.js <site folder>");
		process.exit(1);
	}
	const versions = stampSite(dir);
	console.log("Stamped " + Object.keys(versions).length + " files in " + path.join(dir, "index.html"));
}

export { stampIndex, stampSite };
