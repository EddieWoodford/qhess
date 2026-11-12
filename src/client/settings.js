"use strict";

// The Settings tab: one switch (a checkbox in index.html) per setting, and a button to put them all back to default.
//
// To add a setting: add its switch in index.html (see the comment there) and in dom.js settings, add it to
// SETTINGS below, and give main.js setupSettings what to do when it changes.
//
// A remembered setting is kept in this browser (localStorage) and comes back the next time the page is opened.
// The others start at their default every time.

import { dom } from "./dom.js";

// The device's own light / dark setting
const lightQuery = window.matchMedia?.("(prefers-color-scheme: light)");

// Whether the device asks for a light page
function devicePrefersLight() {
	return lightQuery?.matches ?? false;
}

// name: { default: its value (or a function giving it) when nothing is remembered, remember: whether to keep it
// in this browser }
const SETTINGS = {
	blackView: { default: false, remember: false }, // multiplayer sets it to your own side, so it isn't kept
	colourByType: { default: true, remember: true },
	lightMode: { default: devicePrefersLight, remember: true }, // follows the device until it is switched
	potentialCheck: { default: true, remember: true }, // render.js drawSettings locks it on in a multiplayer game
	showCoords: { default: false, remember: true },
};

const STORAGE_KEY = "qhess.settings";

// What to do when each setting changes (from setupSettings)
let applyFns = {};

function defaultValue(setting) {
	return typeof setting.default == "function" ? setting.default() : setting.default;
}

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

function isRemembered(name) {
	return typeof loadRemembered()[name] == "boolean";
}

// Show a setting's value on its switch and apply it
function set(name, value) {
	dom.settings[name].checked = value;
	applyFns[name](value);
}

// Set every switch to its remembered (or default) value and apply it, then apply each change the player makes.
// apply: { name: function(value) } for every setting, called with true / false.
function setupSettings(apply) {
	applyFns = apply;
	const saved = loadRemembered();
	for (const [name, setting] of Object.entries(SETTINGS)) {
		const input = dom.settings[name];
		set(name, setting.remember && typeof saved[name] == "boolean" ? saved[name] : defaultValue(setting));
		input.addEventListener("change", () => {
			if (setting.remember) {
				remember(name, input.checked);
			}
			apply[name](input.checked);
		});
	}
	// Until Light mode is switched, it follows the device, even when the device changes while the page is open
	lightQuery?.addEventListener?.("change", () => {
		if (!isRemembered("lightMode")) {
			set("lightMode", devicePrefersLight());
		}
	});
}

// Every setting back to its default, and nothing remembered, so Light mode follows the device again.
// A setting that can't be changed just now (Black's view in a multiplayer game) is left as it is.
function resetSettings() {
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		// Nothing could be remembered anyway
	}
	for (const [name, setting] of Object.entries(SETTINGS)) {
		const input = dom.settings[name];
		const value = defaultValue(setting);
		if (!setting.remember && input.disabled) { continue; }
		// Only the ones that change (Potential Check, say, restarts a game at move 0 when it is applied). A locked
		// switch shows the game's value rather than the player's, so it is applied anyway.
		if (input.checked === value && !input.disabled) { continue; }
		set(name, value);
	}
}

export { setupSettings, resetSettings };
