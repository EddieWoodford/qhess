"use strict";

// The History tab: the move history box, the replay step buttons (<< < > >>) and the history buttons
// (Reset Game, Copy All, ...).
// NOTE: the history box's text is also where controller.js reads the history back from (for Restore
// History and replay stepping). Phase 4 of the UI plan makes the history data instead.

import { dom, setVisible } from "./dom.js";

// view: see render.js
function drawHistory(view) {
	const game = view.game;
	const replaying = view.replayNumber > -1;

	// The history can be typed or pasted in only before the first move
	if (view.state != "move0") {
		dom.history.contentEditable = false;
	}

	highlightReplayLine(view.replayNumber);
	if (!replaying) {
		followNewMoves(game.history);
	}

	// Stepping back is possible once a move has been made; stepping forward only while replaying.
	// The history buttons are hidden while replaying.
	const steps = dom.stepButtons;
	setVisible(steps.back2, replaying || game.turnNumber > 0);
	setVisible(steps.back1, replaying || game.turnNumber > 0);
	setVisible(steps.forward1, replaying);
	setVisible(steps.forward2, replaying);
	for (const button of dom.historyButtons) {
		setVisible(button, !replaying);
	}
}

// Highlight the history line for the current replay position (or none when not replaying), and scroll
// the history box so it stays in view
function highlightReplayLine(replayNumber) {
	const historyArea = dom.history;
	let historyHTML = historyArea.innerHTML;

	const lineStyle = "<span style=\"background-color:lightgrey\">";
	historyHTML = historyHTML.replaceAll(lineStyle,"");
	historyHTML = historyHTML.replaceAll("</span>","");
	const historyLines = historyHTML.split("<br>");
	if (replayNumber > -1) {
		historyLines[replayNumber*2-1] = lineStyle + historyLines[replayNumber*2-1] + "</span>";
	}
	historyArea.innerHTML = historyLines.join("<br>");

	const highlighted = historyArea.querySelector("span");
	if (highlighted) {
		scrollIntoBox(historyArea, highlighted);
	}
}

// During normal play, scroll the history box to the bottom whenever the history changes, so the newest
// move is in view. Only on a change: redrawing for other reasons (hovering a square, say) leaves the box
// where the player scrolled it.
let historyLastShown = null;
function followNewMoves(history) {
	if (history !== historyLastShown) {
		dom.history.scrollTop = dom.history.scrollHeight;
		historyLastShown = history;
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
