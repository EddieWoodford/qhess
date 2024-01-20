function doNothing() {
  event.preventDefault();
  event.stopPropagation();
};

// infomation modal
var iw = document.getElementById('infoWrapper'),
ib = document.getElementById('infoButton'),
ic = document.getElementById('infoClose');

function displayInfo() {
  iw.style.display = 'block'
};
function closeInfo() {
  iw.style.display = 'none'
};

// help modal
var hw = document.getElementById('helpWrapper'),
hb = document.getElementById('helpButton'),
hc = document.getElementById('helpClose');

function displayHelp() {
  hw.style.display = 'block'
};
function closeHelp() {
  hw.style.display = 'none'
};

// meta (score and share) modal
var mw = document.getElementById('metaWrapper'),
mb = document.getElementById('metaButton'),
mc = document.getElementById('metaClose');

function displayMeta() {
  mw.style.display = 'block'
};
function closeMeta() {
  mw.style.display = 'none'
};

// options modal
var ow = document.getElementById('optionsWrapper'),
ob = document.getElementById('optionsButton'),
oc = document.getElementById('optionsClose');

function displayOptions() {
  ow.style.display = 'block'
};
function closeOptions() {
  ow.style.display = 'none'
};

// create game modal
var cw = document.getElementById('createGameWrapper');
// cb = document.getElementById('optionsButton'),
// cc = document.getElementById('optionsClose');

function displayCreateGame() { 
	// done via the "Create Game" button
  cw.style.display = 'block'
};
function closeCreateGame() {
  cw.style.display = 'none'
};