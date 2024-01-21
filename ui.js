////////////////////////////////
// UI
////////////////////////////////
function doNothing() {
  event.preventDefault();
  event.stopPropagation();
};
// infomation modal
function displayInfo() {
  document.getElementById('infoWrapper').style.display = 'block'
};
function closeInfo() {
  document.getElementById('infoWrapper').style.display = 'none'
};
// help modal
function displayHelp() {
  document.getElementById('helpWrapper').style.display = 'block'
};
function closeHelp() {
  document.getElementById('helpWrapper').style.display = 'none'
};
// meta (score and share) modal
function displayMeta() {
  document.getElementById('metaWrapper').style.display = 'block'
};
function closeMeta() {
  document.getElementById('metaWrapper').style.display = 'none'
};
// options modal
function displayOptions() {
  document.getElementById('optionsWrapper').style.display = 'block'
};
function closeOptions() {
  document.getElementById('optionsWrapper').style.display = 'none'
};
// create game modal
function displayCreateGame() { 
	// done via the "Create Game" button
  document.getElementById('createGameWrapper').style.display = 'block'
};
function closeCreateGame() {
  document.getElementById('createGameWrapper').style.display = 'none'
};
// login modal
function displayLogin() { 
	// done via the "Create Game" button
	if (PLAYERID == "") {
		document.getElementById('loginWrapper').style.display = 'block';
		const playerIDInput = document.getElementById("playerIDInput");
		playerIDInput.focus();
		playerIDInput.select();
	}
  
};
function closeLogin() {
	document.getElementById('loginWrapper').style.display = 'none'
};
