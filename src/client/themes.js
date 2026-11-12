"use strict";

// The board themes in the Theme dialog (Settings tab). Each has a light and a dark version, picked by the dialog's
// Light mode switch. A theme's look is in style.css 1.1, under [data-board-theme="{id}"].
//
// To add a theme: add it here, and its dark and light blocks in style.css 1.1.

import { waveHTML } from "./glyphs.js";

const THEMES = [
	{ id: "classic", name: "Classic" }, // grey squares, White in outline
	{ id: "pillbox", name: "Pillbox" }, // brown squares, filled symbols on pills
];

const DEFAULT_THEME = "pillbox";

// Fill the dialog's list: per theme, its button and two example squares drawn in that theme.
// The light square has a White bishop, the dark one a Black piece that could still be anything.
function buildThemeList(container) {
	container.innerHTML = THEMES.map(theme => '<div class="theme-option">'
		+ '<button class="historyButton theme-button" data-value="' + theme.id + '" aria-pressed="false">'
		+ theme.name + '</button>'
		+ '<div class="theme-preview" data-board-theme="' + theme.id + '" aria-hidden="true">'
		+ '<div class="boardsquare whitesquare theme-square">' + waveHTML("B", "w") + '</div>'
		+ '<div class="boardsquare blacksquare theme-square">' + waveHTML("KQRBNP", "b") + '</div>'
		+ '</div></div>').join("");
}

export { THEMES, DEFAULT_THEME, buildThemeList };
