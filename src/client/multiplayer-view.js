"use strict";

// The Multiplayer tab. It shows one of three sections:
//   #mpStart  not in a multiplayer game: start one (choosing a colour) or join one with a code
//   #mpGame   in a game: its code to send to a friend, your colour, and how the connections are
//   #mpEnded  the game is over or couldn't be joined: why, and a button back to single player
// The buttons are wired up in main.js.

import { dom } from "./dom.js";

const COLOR_NAMES = { w: "White", b: "Black" };

// view: see render.js. view.multiplayer is null in single player, else controller.js ui.multiplayer.
function drawMultiplayer(view) {
	const mp = view.multiplayer;
	const els = dom.mp;
	const phase = mp ? mp.phase : "none";
	els.start.hidden = phase != "none";
	els.game.hidden = phase != "playing" && phase != "connecting";
	els.ended.hidden = phase != "ended" && phase != "left";
	els.tabTitle.classList.toggle("mp-live", phase == "playing");
	if (!mp) { return; }

	els.code.textContent = mp.code ?? "…";
	els.color.textContent = mp.color ? COLOR_NAMES[mp.color] : "…";
	els.opponent.textContent = {
		waiting: "not joined yet",
		connected: "connected",
		disconnected: "disconnected (their seat is kept for them)",
	}[mp.opponent] ?? "";
	els.connection.textContent = mp.connection == "connected" ? "connected" : "reconnecting…";
	els.connection.classList.toggle("mp-problem", mp.connection != "connected");
	els.opponent.classList.toggle("mp-problem", mp.opponent == "disconnected");

	let message;
	if (phase == "connecting" && mp.serverStarting) {
		message = "Starting the multiplayer server. It sleeps when nobody is playing, so this can take up to a minute…";
	} else if (phase == "connecting") {
		message = "Connecting to the server…";
	} else if (mp.opponent == "waiting") {
		message = "Send this code to your friend. The game starts when they join.";
	} else {
		message = "Playing. Your side is at the bottom of the board.";
	}
	els.message.textContent = message;
	els.endedText.textContent = phase == "left" ? "You left the game." : (mp.message || "The game has ended.");
}

export { drawMultiplayer };
