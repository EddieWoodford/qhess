"use strict";

// The Settings tab: one switch (a checkbox in index.html) per setting.
//
// To add a setting: add its switch in index.html (see the comment there) and in dom.js settings, add it to
// SETTINGS below, and give main.js setupSettings what to do when it changes.
//
// A remembered setting is kept in this browser (localStorage) and comes back the next time the page is opened.
// The others start at their default every time.

import { dom } from "./dom.js";

// Whether the device asks for a light page (its own light / dark setting)
function devicePrefersLight() {
	return window.matchMedia?.("(prefers-color-scheme: light)").matches ?? false;
}

// name: { default: its value when nothing is remembered, remember: whether to keep it in this browser }
const SETTINGS = {
	blackView: { default: false, remember: false }, // multiplayer sets it to your own side, so it isn't kept
	colourByType: { default: true, remember: true },
	lightMode: { default: devicePrefersLight(), remember: true }, // follows the device until it is switched
	potentialCheck: { default: true, remember: true }, // render.js drawSettings locks it on in a multiplayer game
	showCoords: { default: false, remember: true },
};

const STORAGE_KEY = "qhess.settings";

// The remembered settings, as { name: value }. Empty if there are none, or the browser won't keep them.
function loadRemembered() {
	try {
		return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
	} catch {
		return {};
	}
}

function remember(name, value) {
	try {
		const saved = loadRemembered();
		saved[name] = value;
		localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
	} catch {
		// The browser won't keep it (e.g. storage is blocked): it lasts until the page is closed
	}
}

// Set every switch to its remembered (or default) value and apply it, then apply each change the player makes.
// apply: { name: function(value) } for every setting, called with true / false.
function setupSettings(apply) {
	const saved = loadRemembered();
	for (const [name, setting] of Object.entries(SETTINGS)) {
		const input = dom.settings[name];
		const value = setting.remember && typeof saved[name] == "boolean" ? saved[name] : setting.default;
		input.checked = value;
		apply[name](value);
		input.addEventListener("change", () => {
			if (setting.remember) {
				remember(name, input.checked);
			}
			apply[name](input.checked);
		});
	}
}

export { setupSettings };
