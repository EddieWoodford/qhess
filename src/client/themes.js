"use strict";

// The board themes: one CSS file each in themes/, listed in themes/index.json (the local server writes that list
// from the folder; GitHub Pages serves the committed copy). The Theme dialog (Settings tab) shows one button per
// theme. A theme sets the board's colours, how the pieces are drawn, and whether the page around the board is
// light or dark (style.css 1.1 lists what it sets).
//
// To add a theme: make one with tools/theme-generator.html (Export) or copy a file in themes/, and save it there.

import { waveHTML } from "./glyphs.js";

// The themes, once loadThemes has read them: { id (its file name without .css), name, page: "dark" or "light" },
// in order of name
const THEMES = [];

// Read every theme file and add its CSS to the page, each under [data-board-theme="{id}"] in place of the file's
// .qhess-theme, so the page (and each preview in the Theme dialog) shows whichever theme its attribute names.
async function loadThemes() {
	let files;
	try {
		files = await (await fetch("themes/index.json", { cache: "no-store" })).json();
	} catch {
		files = ["dark-distinct.css", "dark-simple.css", "light-distinct.css", "light-simple.css"];
	}
	const loaded = await Promise.all(files.map(async file => {
		try {
			const res = await fetch("themes/" + encodeURIComponent(file), { cache: "no-store" });
			return res.ok ? { file, css: await res.text() } : null;
		} catch {
			return null; // a theme that can't be read is left out
		}
	}));
	const style = document.createElement("style");
	style.id = "themeStyles";
	for (const { file, css } of loaded.filter(Boolean)) {
		const id = file.replace(/\.css$/i, "").replace(/[^\w-]/g, "-");
		const value = name => css.match(new RegExp(name + "\\s*:\\s*([^;]+);"))?.[1].trim();
		const name = value("--theme-name")?.replace(/^["']|["']$/g, "") || id;
		const page = value("--theme-page") == "light" ? "light" : "dark";
		style.textContent += css.replaceAll(".qhess-theme", '[data-board-theme="' + id + '"]') + "\n";
		THEMES.push({ id, name, page });
	}
	THEMES.sort((a, b) => a.name.localeCompare(b.name));
	document.head.append(style);
}

// The theme to start with until one is chosen: Distinct, light or dark as the device is set; else the first
function defaultTheme(prefersLight) {
	const want = prefersLight ? "light-distinct" : "dark-distinct";
	return THEMES.some(theme => theme.id == want) ? want : THEMES[0]?.id;
}

function themeById(id) {
	return THEMES.find(theme => theme.id == id);
}

// Fill the dialog's list: per theme, its button and two example squares drawn in that theme.
// The light square has a White bishop, the dark one a Black piece that could still be anything.
function buildThemeList(container) {
	container.innerHTML = THEMES.map(theme => '<div class="theme-option">'
		+ '<button class="historyButton theme-button" data-value="' + theme.id + '" aria-pressed="false">'
		+ theme.name.replace(/[<>&"]/g, "") + '</button>'
		+ '<div class="theme-preview" data-board-theme="' + theme.id + '" aria-hidden="true">'
		+ '<div class="boardsquare whitesquare theme-square">' + waveHTML("B", "w") + '</div>'
		+ '<div class="boardsquare blacksquare theme-square">' + waveHTML("KQRBNP", "b") + '</div>'
		+ '</div></div>').join("");
}

export { THEMES, loadThemes, defaultTheme, themeById, buildThemeList };
