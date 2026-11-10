"use strict";

// Show/hide the modals: info, help and options (from the header) and import (from the History tab).
// Each modal is a full-screen wrapper (click it to close) holding a content box (clicks inside don't close it),
// opened by the button with id name + "Button".

const MODALS = ["info", "help", "options", "import"];

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

export { setupModals, showModal, hideModal };
