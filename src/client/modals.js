"use strict";

// Show/hide the modals: Edit / Import (from the History tab), and the choice dialog below.
// Each modal is a full-screen wrapper (click it to close) holding a content box (clicks inside don't close it),
// opened by the button with id name + "Button".

const MODALS = ["import"];

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
// choice = { text, yes, no }: the question and the two buttons' labels.
// Calls onAnswer(true) or onAnswer(false), or onAnswer(null) if it's closed by clicking outside the box.
function showChoice(choice, onAnswer) {
	const $ = id => document.getElementById(id);
	$("choiceText").textContent = choice.text;
	$("choiceYes").textContent = choice.yes;
	$("choiceNo").textContent = choice.no;
	const answer = value => {
		hideModal("choice");
		onAnswer(value);
	};
	$("choiceYes").onclick = () => answer(true);
	$("choiceNo").onclick = () => answer(false);
	$("choiceWrapper").onclick = () => answer(null);
	$("choiceDiv").onclick = e => e.stopPropagation();
	showModal("choice");
	$("choiceYes").focus();
}

export { setupModals, showModal, hideModal, showChoice };
