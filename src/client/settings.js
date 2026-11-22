"use strict";

// The Settings tab: one switch (a checkbox in index.html) per setting, and a button to put them all back to default.
// The theme is a setting too, chosen from a list of buttons (themes.js) in the Theme dialog. Until one is chosen
// it follows the device's own light / dark setting.
//
// To add a setting: add its switch in index.html (see the comment there) and in dom.js settings, add it to
// SETTINGS below, and give main.js setupSettings what to do when it changes.
//
// A remembered setting is kept in this browser (localStorage) and comes back the next time the page is opened.
// The others start at their default every time.

import { dom } from "./dom.js";
import { THEMES, defaultTheme } from "./themes.js";
import { HINT_LEVELS } from "../shared/protocol.js";

// The device's own light / dark setting
const lightQuery = window.matchMedia?.("(prefers-color-scheme: light)");

// Whether the device asks for a light page
function devicePrefersLight() {
	return lightQuery?.matches ?? false;
}

// name: { default: its value (or a function giving it) when nothing is remembered, remember: whether to keep it
// in this browser, choices: for a setting chosen from buttons (each with data-value) rather than a switch, a
// function giving the values it can take }
const SETTINGS = {
	blackView: { default: false, remember: false }, // multiplayer sets it to your own side, so it isn't kept
	potentialCheck: { default: true, remember: true }, // render.js drawSettings locks it on in a multiplayer game
	showCoords: { default: false, remember: true },
	// How much the board shows before Submit. render.js drawSettings shows a multiplayer game's level instead.
	hintLevel: { default: "captures", remember: true, choices: () => HINT_LEVELS },
	// The themes are read from themes/ (themes.js loadThemes) before setupSettings runs
	theme: { default: () => defaultTheme(devicePrefersLight()), remember: true,
		choices: () => THEMES.map(theme => theme.id) },
};

const STORAGE_KEY = "qhess.settings";

// What to do when each setting changes (from setupSettings)
let applyFns = {};

// The value of each setting chosen from buttons, as last set
const chosen = {};

function defaultValue(setting) {
	return typeof setting.default == "function" ? setting.default() : setting.default;
}

// The remembered settings, as { name: value }. Empty if there are none, or the browser won't keep them.
function loadRemembered() {
	try {
		return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") ?? {};
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

// Whether a value could be this setting's (a remembered one might be from an older version of the page)
function isValid(setting, value) {
	return setting.choices ? setting.choices().includes(value) : typeof value == "boolean";
}

function isRemembered(name) {
	return isValid(SETTINGS[name], loadRemembered()[name]);
}

// A setting's value as shown: its switch, or which of its buttons is pressed
function shown(name) {
	return SETTINGS[name].choices ? chosen[name] : dom.settings[name].checked;
}

// Show a setting's value on its switch (or buttons) and apply it
function set(name, value) {
	if (SETTINGS[name].choices) {
		chosen[name] = value;
		for (const button of dom.settings[name].querySelectorAll("[data-value]")) {
			button.setAttribute("aria-pressed", button.dataset.value == value);
		}
	} else {
		dom.settings[name].checked = value;
	}
	applyFns[name](value);
}

// Settings held at a value for now, whatever the player chose: { name: the player's own value }
const held = {};

// Hold a switch at a value: it shows that value and can't be changed (the demo holds Show coordinates on, as its
// thought bubbles name squares). With no value, let it go: the player's own value comes back.
function holdSetting(name, value) {
	const input = dom.settings[name];
	if (value !== undefined) {
		if (!(name in held)) { held[name] = shown(name); }
		input.disabled = true;
		set(name, value);
	} else if (name in held) {
		input.disabled = false;
		set(name, held[name]);
		delete held[name];
	}
}

// The player changed a setting
function change(name, value) {
	if (SETTINGS[name].remember) {
		remember(name, value);
	}
	set(name, value);
}

// Set every switch to its remembered (or default) value and apply it, then apply each change the player makes.
// apply: { name: function(value) } for every setting, called with true / false (or a choice's value).
function setupSettings(apply) {
	applyFns = apply;
	const saved = loadRemembered();
	for (const [name, setting] of Object.entries(SETTINGS)) {
		const input = dom.settings[name];
		set(name, setting.remember && isValid(setting, saved[name]) ? saved[name] : defaultValue(setting));
		if (setting.choices) {
			input.addEventListener("click", e => {
				const button = e.target.closest("[data-value]");
				if (button) { change(name, button.dataset.value); }
			});
		} else {
			input.addEventListener("change", () => change(name, input.checked));
		}
	}
	// Until a theme is chosen, it follows the device, even when the device changes while the page is open
	lightQuery?.addEventListener?.("change", () => {
		if (!isRemembered("theme")) {
			set("theme", defaultValue(SETTINGS.theme));
		}
	});
}

// Every setting back to its default, and nothing remembered, so the theme follows the device again.
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
		if (name in held) { held[name] = value; continue; } // (it comes back when let go)
		if (!setting.remember && input.disabled) { continue; }
		// Only the ones that change (Potential Check, say, restarts a game at move 0 when it is applied). A locked
		// switch shows the game's value rather than the player's, so it is applied anyway.
		if (shown(name) === value && !input.disabled) { continue; }
		set(name, value);
	}
}

export { setupSettings, resetSettings, holdSetting };
