"use strict";

// The History tab: the game record (one line per ply), the replay step buttons (<< < > >>) and the history
// buttons (Reset Game, Edit / Import, Copy All, ...).

import { dom, setVisible } from "./dom.js";

// view: see render.js
function drawHistory(view) {
	const replaying = view.replayNumber > -1;

	drawRecord(view.record, view.replayNumber);

	// Stepping back is possible once a move has been made; stepping forward only while replaying.
	// The history buttons are hidden while replaying.
	const steps = dom.stepButtons;
	setVisible(steps.back2, replaying || view.game.turnNumber > 0);
	setVisible(steps.back1, replaying || view.game.turnNumber > 0);
	setVisible(steps.forward1, replaying);
	setVisible(steps.forward2, replaying);
	// A multiplayer game can't be reset, edited or replaced from one side
	for (const button of dom.historyButtons) {
		setVisible(button, !replaying && !(view.multiplayer && dom.localOnlyButtons.includes(button)));
	}
}

// The record as one .historyLine per ply. While replaying, the line for the position being shown is marked
// .replayLine and scrolled into view; otherwise the box follows the newest move.
let recordShown = null;
function drawRecord(record, replayNumber) {
	const box = dom.history;
	// Only rebuild when the record has changed (controller.js makes a new array each time), so redrawing for
	// other reasons (hovering a square, say) leaves the box where the player scrolled it
	const changed = record !== recordShown;
	if (changed) {
		box.replaceChildren(...record.map(line => {
			const el = document.createElement("div");
			el.className = "historyLine";
			el.textContent = line;
			return el;
		}));
		recordShown = record;
	}

	// replayNumber 0.5 is after the first ply (line 0), 1 after the second, ...
	const current = replayNumber > -1 ? replayNumber*2 - 1 : -1;
	[...box.children].forEach((el, i) => el.classList.toggle("replayLine", i == current));

	if (current > -1 && box.children[current]) {
		scrollIntoBox(box, box.children[current]);
	} else if (changed) {
		box.scrollTop = box.scrollHeight;
	}
}

// Scroll box (a scrolling element) just enough that el, inside it, is fully visible.
// Unlike el.scrollIntoView(), this never scrolls the page itself.
function scrollIntoBox(box, el) {
	const boxRect = box.getBoundingClientRect();
	const elRect = el.getBoundingClientRect();
	const style = getComputedStyle(box);
	// The visible area inside the border, less the padding, so the line isn't tucked under the edge
	const visibleTop = boxRect.top + box.clientTop + parseFloat(style.paddingTop);
	const visibleBottom = boxRect.top + box.clientTop + box.clientHeight - parseFloat(style.paddingBottom);
	if (elRect.top < visibleTop) {
		box.scrollTop -= visibleTop - elRect.top;
	} else if (elRect.bottom > visibleBottom) {
		box.scrollTop += elRect.bottom - visibleBottom;
	}
}

export { drawHistory };
