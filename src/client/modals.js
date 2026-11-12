"use strict";

// Show/hide the modals: Edit / Import (from the History tab), Rules (from the Info tab), Theme (from the Settings tab),
// and the choice dialog below.
// Each modal is a full-screen wrapper (click it to close) holding a content box (clicks inside don't close it),
// opened by the button with id name + "Button".

const MODALS = ["import", "rules", "theme"];

function showModal(name) {
	document.getElementById(name + "Wrapper").style.display = "block";
}

function hideModal(name) {
	document.getElementById(name + "Wrapper").style.display = "none";
}

function setupModals() {
	for (const name of MODALS) {
		document.getElementById(name + "Button").addEventListener("click", () => showModal(name));
		document.getElementById(name + "Wrapper").addEventListener("click", () => hideModal(name));
		// Clicks inside the content box shouldn't reach the wrapper and close the modal
		document.getElementById(name + "Div").addEventListener("click", e => e.stopPropagation());
	}
}

// The choice dialog: a question with two answers, e.g. "Take en passant?" (controller.js askChoice).
// choice = { text, yes, no, cancel }: the question and the buttons' labels. cancel is optional: a third button that
// does the same as clicking outside the box.
// Calls onAnswer(true) or onAnswer(false), or onAnswer(null) if it's cancelled or closed by clicking outside the box.
function showChoice(choice, onAnswer) {
	const $ = id => document.getElementById(id);
	$("choiceText").textContent = choice.text;
	$("choiceYes").textContent = choice.yes;
	$("choiceNo").textContent = choice.no;
	$("choiceCancel").textContent = choice.cancel ?? "";
	$("choiceCancel").hidden = !choice.cancel;
	const answer = value => {
		hideModal("choice");
		onAnswer(value);
	};
	$("choiceYes").onclick = () => answer(true);
	$("choiceNo").onclick = () => answer(false);
	$("choiceCancel").onclick = () => answer(null);
	$("choiceWrapper").onclick = () => answer(null);
	$("choiceDiv").onclick = e => e.stopPropagation();
	showModal("choice");
	$("choiceYes").focus();
}

export { setupModals, showModal, hideModal, showChoice };
