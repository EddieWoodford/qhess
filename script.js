"use strict";

import { isequal, coords2text, ismember } from "./src/engine/utils.js";
import { createInitialState, oppColor, getPieces, defPiece, attPiece } from "./src/engine/state.js";
import { getPotentialMoves } from "./src/engine/moves.js";
import { findChecks, findPotentialKings, findPCAttackers } from "./src/engine/check.js";
import { updateOptionsFromEntanglement } from "./src/engine/entanglement.js";
import { getHistoryLines, parseMoveText } from "./src/engine/notation.js";
import { WK, WQ, WR, WB, WN, WP, BK, BQ, BR, BB, BN, BP, waveHTML } from "./src/client/glyphs.js";

// Classes

// One board square on the page: its button, what happens when it is hovered or clicked,
// and the highlight flags used when drawing it. The piece on the square lives in game.board.
class SquareView {
	constructor(r, c, button) {
		this.r = r;
		this.c = c;
		this.button = button;
		this.highlighted = 0;
		// 0 = not a potential move; 1-16 = bearing of potential move where 1=NNE, 2=NE, 3=ENE, 3=E, 5=ESE, etc.
		this.potentialMove = 0;
		this.highlightPotKing = 0; // 0 = not a PK; 1 = candidate for PK;
		this.highlightPotAttacker = 0; // 0 = not a PA; 1 = candidate for PA;
		this.color = (r + c) % 2 == 0 ? "w" : "b"; // square colour

		const coords = [r, c];
		this.button.onmouseenter = () => {
			if (STATE == "clear") {
				highlightPotentialMoves(coords);
			}
		}
		this.button.onmouseleave = () => {
			if (STATE == "highlightPotentialMoves") {
				setState("clear");
			}
		}
		this.button.onclick = () => {
			if (REPLAYNUMBER > -1) {return}
			FINDPIECE = "";
			clearFindPieces();
			if (STATE == "highlightPotentialMoves") {
				showPartialMove(coords);
			} else if (STATE == "showPartialMove") {
				showCompleteMove(coords);
			} else if (STATE == "selectPCKing") {
				selectPCKing(coords);
			} else if (STATE == "selectPCAttackers") {
				selectPCAttackers(coords);
			} else if (STATE == "move0") {
				setState("move0");
			} else {
				restoreGameHistory();
				setState("clear");
			}
		}
	}
	resetButtonClasses() {
		let prevClasses = this.button.className;
		prevClasses = prevClasses.split(" ");
		this.button.classList.remove(...prevClasses);
		this.button.classList.add("boardsquare");
		if (this.color == "w") {
			this.button.classList.add("whitesquare");
		} else {
			this.button.classList.add("blacksquare");
		}
	}
	setWavetext(piece) {
		if (piece === null) {
			this.button.innerHTML = "";
		} else {
			this.button.innerHTML = waveHTML(piece.waves(), piece.color);
		}
	}
}

////////////////////////////////
// Button Actions
////////////////////////////////
function sideButton1Click() {
	if (REPLAYNUMBER > -1) {
		// When in replay mode, sideButton1 is 'Resume Game From Here'
		let foo = REPLAYNUMBER;
		REPLAYNUMBER = -1;
		restoreGameHistory(null, 2*foo);
	} else {
		sideButton1Action();
	}
}

function sideButton1Action() {
	if (STATE == "showCompleteMove" || STATE == "move0") {
		highlightPotentialKings();
		setState("selectPCKing");
	} else if (STATE == "clear" && game.potCheck) {
		declareNotAKing();
		setState("clear");
	}
}

function sideButton2Click() {
	// Can put extra code here that will only happen when user clicks the button, rather than when the script calls
	// sideButton2Action() to replicate a user click (typically while restoring a game)
	
	/////////////////////
	sideButton2Action();
}

function sideButton2Action() {
	if (STATE == "showCompleteMove" || STATE == "selectPCAttackers" || STATE == "move0") {
		submitMove();
		setState("clear");
	} else if (STATE == "invalidMoveIntoCheck") {
		restoreGameHistory();
		setState("clear");
	}
}

function declareNotAKing() {
	let defKing = attPiece(game, game.pcKing);
	// game.thisMove = "[(" + defKing.waves() + ")" + coords2text([defKing.r, defKing.c]);
	defKing.removewaves("K");
	// game.thisMove = game.thisMove + "(" + defKing.waves() + ")]";
	game.thisMove = game.thisMove + "[" + coords2text([defKing.r, defKing.c]) + "]";
	updateOptionsFromEntanglement(game, game.turnColor);
	game.pcKing = -1; 
	game.pcColor = "";
	clearFindPotentialCheckPieces();
	updateChecks(game.turnColor);
}

function submitMove() {
	// Here after clicking sideButton1 when a valid move is chosen
		
	// Update move history label:
	// The move annotation itself is constructed in showCompleteMove(), but if there is a Potential Check declared,
	// then the contents of the <> in the move annotation is done here
	if (game.pcColor == game.turnColor) {
		// Must have gotten out of potential check
		game.pcKing = -1;
		game.pcColor = "";
	}
	
	if (game.history.length > 0) {
		game.history = game.history + "\r\n"
	}
	game.history = game.history + game.thisMove + pcMoveText();
	let historyArea = document.getElementById("movehistory");
	if (REPLAYNUMBER == -1) {
		historyArea.innerText = game.history;
	}
	

	if (game.takenPiece !== null) {
		game.takenPiece.captured = game.turnNumber;
	}

	// Remember this move's squares so replay can highlight the last move
	LASTSTARTCOORDS = STARTCOORDS;
	LASTENDCOORDS = ENDCOORDS;

	if (game.turnColor == "w") {
		game.turnColor =	"b";
	} else {
		game.turnNumber = game.turnNumber + 1;
		game.turnColor = "w";
	}
	if (game.turnColor == game.epColor) {
		game.epColor = "";
		game.epCoords = [];
	}
	game.thisMove = game.turnNumber.toString() + game.turnColor + ". ";
	clearFindPotentialCheckPieces();
	updateChecks(game.turnColor);
	
	// copyLastMove();
}

function findPiecesClick(wave) {
	clearFindPieces();
	if (wave == FINDPIECE) {
		FINDPIECE = "";
	} else {
		FINDPIECE = wave;
		//document.getElementById("find"+wave).style.background = "purple";
		//document.getElementById("find"+wave).style.backgroundImage = "none";
		document.getElementById("find"+wave).classList.add("findHighlight");
	}
	setState(STATE);
}

function toggleFlippedBoard() {
	if (document.documentElement.style.getPropertyValue('--board-flex-flow') == 'column-reverse nowrap') {
        document.documentElement.style.setProperty('--board-flex-flow', 'column nowrap');
		document.documentElement.style.setProperty('--boardrow-flex-flow', 'row nowrap');
    } else {
		document.documentElement.style.setProperty('--board-flex-flow', 'column-reverse nowrap');
		document.documentElement.style.setProperty('--boardrow-flex-flow', 'row-reverse nowrap');
    }
}

function clearFindPieces() {
	document.getElementById("findK").classList.remove("findHighlight");
	document.getElementById("findQ").classList.remove("findHighlight");
	document.getElementById("findR").classList.remove("findHighlight");
	document.getElementById("findN").classList.remove("findHighlight");
	document.getElementById("findB").classList.remove("findHighlight");
	document.getElementById("findP").classList.remove("findHighlight");
}

function highlightPotentialMoves(coords) {
	// Highlight potential moves temporarily while mouse is over square
	if (game.board[coords[0]][coords[1]] === null) {return;}
	if (game.board[coords[0]][coords[1]].captured > -1) {return;}
	if (game.board[coords[0]][coords[1]].color == game.turnColor) {
		SQUARES[coords[0]][coords[1]].highlighted = 1;

		let moves = getPotentialMoves(game, coords);
		for (let i=0; i < moves.length; i++) {
			let delY = coords[0] - moves[i][0];
			let delX = moves[i][1] - coords[1];
			// returns 1-16 = bearing of potential move where 1=NNE, 2=NE, 3=ENE, 3=E, 5=ESE, etc.
			let bearing = (Math.round(((Math.atan2(delX, delY) * 180) / Math.PI)/22.5) + 16 - 1) % 16 + 1;
			SQUARES[moves[i][0]][moves[i][1]].potentialMove = bearing;
		}
		setState("highlightPotentialMoves");
	}
}

function showPartialMove(coords) {
	// Show potential moves after clicking on start location
	let piece = coords2piece(coords);
	if (piece !== null && piece.color == game.turnColor) {
		
		STARTCOORDS = coords;
		let moves = getPotentialMoves(game, coords);
		for (let i=0; i<moves.length; i++) {
			let delY = coords[0] - moves[i][0];
			let delX = moves[i][1] - coords[1];
			// returns 1-16 = bearing of potential move where 1=NNE, 2=NE, 3=ENE, 3=E, 5=ESE, etc.
			let bearing = (Math.round(((Math.atan2(delX, delY) * 180) / Math.PI)/22.5) + 16 - 1) % 16 + 1;
			SQUARES[moves[i][0]][moves[i][1]].potentialMove = bearing;
		}
		setState("showPartialMove");
	}
}

function showCompleteMove(endCoords,doEP,doPromotion) {
	// Input doEP (do en passant) is optional and typically empty, except for when restoring a move history
	
	// After clicking on destination:
	let startCoords = STARTCOORDS;
	let validDestinations = getPotentialMoves(game, startCoords);
	if (!ismember(endCoords,validDestinations)) {
		setState("clear");
		return;
	}
	let movingPiece = game.board[startCoords[0]][startCoords[1]];
	game.thisMove = game.thisMove + "(" + movingPiece.waves() + ")" + coords2text(startCoords);
	
	// Remove the options from this piece based on movement:
	movingPiece.updateOptionsByDest(game, endCoords);
	
	
	movingPiece.hasmoved = 1;
	movingPiece.r = endCoords[0];
	movingPiece.c = endCoords[1];
	
	// Move the piece:
	ENDCOORDS = endCoords;
	game.takenPiece = game.board[endCoords[0]][endCoords[1]];
	if (game.takenPiece !== null) {
		game.takenPiece.captured = game.turnNumber;
		game.takenPiece.removewaves('K');
		game.thisMove = game.thisMove + "x";
	}
	game.board[endCoords[0]][endCoords[1]] = movingPiece;
	game.board[startCoords[0]][startCoords[1]] = null;
	
	
	// Collapse the pieces
	updateOptionsFromEntanglement(game);
	

	let direction  = -1;
	if (movingPiece.color == "w") {
		direction = 1;
	}
	
	// Check for en passant:
	if (isequal(endCoords,game.epCoords) && movingPiece.waves().includes("P")) {
		if (movingPiece.waves().length > 1) {
			if (doEP == undefined) {
			// In this case the attacker needs to decide if they meant to do an en passant. If they do it collapses their piece to a pawn.
				doEP = confirm("En passant?");
			}
		} else {
			doEP = true;
		}
		if (doEP) {
			game.thisMove = game.thisMove + "x";
			movingPiece.removewaves("KQNRB");
			game.takenPiece = game.board[endCoords[0]+direction][endCoords[1]];
			game.takenPiece.captured = game.turnNumber;
			game.takenPiece.removewaves("KQNRB");
			game.board[endCoords[0]+direction][endCoords[1]] = null;
			// update all the collpases again!
			updateOptionsFromEntanglement(game);
		} else {
			movingPiece.removewaves("P");
			updateOptionsFromEntanglement(game);
		}
	} else {
		doEP = false;
	}
	
	
	// Save the en passant square
	if (movingPiece.waves().includes("P")) {
		if (endCoords[0]-startCoords[0] == -2*direction) {
			game.epCoords = [startCoords[0]-direction,startCoords[1]];
			game.epColor = game.turnColor;
		}
	}
	
	// Check if the moving piece is a pawn to be promoted
	if (movingPiece.waves().includes("P")) {
		if ((game.turnColor=="w" && endCoords[0]==0) || (game.turnColor=="b" && endCoords[0]==7)) {
			if (movingPiece.waves().length > 1) {
				if (doPromotion == undefined) {
					// In this case the player needs to decide if they want to promote the piece as though it were a pawn.
					doPromotion = confirm("Promote Pawn?");
				}
			} else {
				doPromotion = true;
			}
			if (doPromotion) {
				movingPiece.removewaves("KQNBR");
				movingPiece.promoted = 1;
				
				movingPiece.promotedOptions = Array(16).fill(1);
				movingPiece.removewaves("KP"); // can't be a king or pawn
				if ((movingPiece.r + movingPiece.c)%2==0) {
					// on a white square, so black bishop is not possible
					movingPiece.promotedOptions[12] = 0;
				} else {
					// on a black square, so white bishop is not possible
					movingPiece.promotedOptions[13] = 0;
				}
			} else {
				movingPiece.removewaves("P");
			}
			updateOptionsFromEntanglement(game);
		}
	}
	
	// Finish move annotation
	if (doEP) {
		game.thisMove = game.thisMove + coords2text(endCoords) + "(" + movingPiece.waves() + ")";
		game.thisMove = game.thisMove + " e.p.";
	} else if (doPromotion) {
		game.thisMove = game.thisMove + coords2text(endCoords) + "(P)";
		game.thisMove = game.thisMove + "=(QRNB)";
	} else {
		game.thisMove = game.thisMove + coords2text(endCoords) + "(" + movingPiece.waves() + ")"
	}
	
	// Now, look to see if attacker has put themselves in automatic check. If so, it's an invalid move
	clearFindPotentialCheckPieces();
	let [kingCoords,attackerCoords] = updateChecks(game.turnColor);
	if (attackerCoords.length > 0) {
		// We will still display the invalid move, but make it impossible to submit, as
		// the player might want to inspect the board to understand how the check happened.
		setState("invalidMoveIntoCheck");
	} else {		
		// Check if the attacker has put the defender in auto check:
		clearFindPotentialCheckPieces();
		[kingCoords,attackerCoords] = updateChecks(oppColor(game.turnColor));
		if (game.autoCheck) {
			game.thisMove = game.thisMove + "+";
		}
		setState("showCompleteMove");
	}

}

////////////////////////////////
// Move History
////////////////////////////////
function restoreGameHistory(historyText,nMoves) {
	// Restore a game from whatever history is in the move history textbox
	
	let historyArea = document.getElementById("movehistory");
	let historyLines;
	if (historyText != undefined) {
		historyLines = getHistoryLines(historyText);
		historyArea.innerText = historyLines.join("\r\n");
	} else {
		historyLines = getHistoryLines(historyArea.innerText);
	}
	let moveText;
	setup();
	if (nMoves == undefined) {
		nMoves = historyLines.length;
	}
	for (let i=0; i < nMoves; i++) {
		moveText = historyLines[i];
		if (moveText!="") {
			let resultText = doMoveFromText(moveText);
			sideButton2Action(); // submit
		}
	}
}

function doMoveFromText(moveText) {
	// Replay one ply of notation by performing the same actions a player would
	let move = parseMoveText(moveText);

	// Check that the move number eg "3w. " is correct.
	if (move.turn != game.turnNumber.toString() + game.turnColor) {
		debugPrint("Move text number + colour did not match expected");
	}

	if (move.notAKing) {
		sideButton1Action(); // "Declare 'Not a King'" button
	}
	if (game.turnNumber > 0) {
		// The ply should include an actual move
		showPartialMove(move.from);
		showCompleteMove(move.to, move.enPassant, move.promotion);
	}
	if (move.pcKing) {
		sideButton1Action(); // "Add Potential Check" button
		selectPCKing(move.pcKing);
		for (const attacker of move.pcAttackers) {
			selectPCAttackers(attacker);
		}
	}
	return game.thisMove
}

function copyAllHistory() {
	let historyArea = document.getElementById("movehistory");
	let historyText = historyArea.innerText;
	navigator.clipboard.writeText(historyText);
}

function copyLastMove() {
	let historyArea = document.getElementById("movehistory");
	let historyText = historyArea.innerText;
	let historyLines = getHistoryLines(historyText);
	navigator.clipboard.writeText(historyLines[historyLines.length-1]);
}

function pasteAllRestore() {
	let historyArea = document.getElementById("movehistory");
	historyArea.innerText = "";
	navigator.clipboard.readText().then((clipText) => (restoreGameHistory(clipText)));
}

function pasteLineRestore() {
	let historyArea = document.getElementById("movehistory");
	let historyLines = getHistoryLines(historyArea.innerText);
	let historyText = historyLines.join("\r\n");
	navigator.clipboard.readText().then((clipText) => (restoreGameHistory(historyText + "\r\n" + clipText)));
}

function stepBackAll() {
	REPLAYNUMBER = 0.5;
	restoreGameHistory(null, 2*REPLAYNUMBER);
}

function stepBackMove() {
	if (REPLAYNUMBER == -1) {
		// starting replay from game state
			if (game.turnColor == "w") {
			REPLAYNUMBER = game.turnNumber - 0.5;
		} else {
			REPLAYNUMBER = game.turnNumber;
		}
	}
	REPLAYNUMBER = REPLAYNUMBER - 0.5;
	REPLAYNUMBER = Math.max(REPLAYNUMBER,0.5);
	restoreGameHistory(null, 2*REPLAYNUMBER);
	
}

function stepForwardMove() {
	let historyArea = document.getElementById("movehistory");
	let historyLines = getHistoryLines(historyArea.innerText);
	if (REPLAYNUMBER < historyLines.length/2) {
		let moveText = historyLines[2*REPLAYNUMBER];
		REPLAYNUMBER = REPLAYNUMBER + 0.5;
		doMoveFromText(moveText);
		sideButton2Action(); // submit
		
		// restoreGameHistory(null, 2*REPLAYNUMBER);
	}
}

function stepForwardAll() {
	let historyArea = document.getElementById("movehistory");
	let historyLines = getHistoryLines(historyArea.innerText);
	REPLAYNUMBER = historyLines.length/2;
	restoreGameHistory(null, 2*REPLAYNUMBER);
}

function replaynumber2turnID() {
	if (REPLAYNUMBER == -1) {
		return "";
	} else if (REPLAYNUMBER % 1 == 0) {
		return game.turnNumber.toString() + "w. ";
	} else {
		return game.turnNumber.toString() + "b. ";
	}
}



////////////////////////////////
// Check
////////////////////////////////
// Highlight the opponent pieces that could be the king and are under attack (the candidates for a
// potential check). Returns how many there are.
function highlightPotentialKings() {
	const kings = findPotentialKings(game);
	for (const [r, c] of kings) {
		SQUARES[r][c].highlightPotKing = 1;
	}
	return kings.length;
}

// Highlight the side to move's pieces that could attack the chosen potential-check king, and
// un-highlight the rest. Returns their coordinates.
function highlightPCAttackers() {
	const attackers = findPCAttackers(game);
	for (const piece of getPieces(game, game.turnColor)) {
		if (piece.captured > -1) {continue}
		SQUARES[piece.r][piece.c].highlightPotAttacker = ismember([piece.r, piece.c], attackers) ? 1 : 0;
	}
	return attackers;
}

function clearFindPotentialCheckPieces() {
	for (let r=0; r<8; r++) {
		for (let c=0; c<8; c++) {
			SQUARES[r][c].highlightPotKing = 0;
			SQUARES[r][c].highlightPotAttacker = 0;
		}
	}
}

function selectPCKing(kingCoords) {
	// Get here after clicking on a square in "selectPCKing" state
	if (SQUARES[kingCoords[0]][kingCoords[1]].highlightPotKing == 0) {
		restoreGameHistory();
		setState("clear");
		return
	}
	clearFindPotentialCheckPieces(); // stop highlighting the potential kings
	
	// Make this piece the PC King
	game.pcKing = game.board[kingCoords[0]][kingCoords[1]].i;
	game.pcColor = game.board[kingCoords[0]][kingCoords[1]].color;
	let potAttackerCoords = highlightPCAttackers();
	if (potAttackerCoords.length == 1) {
		selectPCAttackers(potAttackerCoords[0]);
	} else {
		setState("selectPCAttackers");
	}
}

function selectPCAttackers(attackerCoords) {
	// Get here when a PC attacker is selected by clicking on its square
	
	let attackerPiece = coords2piece(attackerCoords);
	if (attackerPiece === null || attackerPiece.color != game.turnColor) {
		// clicked on an empty square
		restoreGameHistory();
		setState("clear");
		return
	}
	
	let attackerMoves = getPotentialMoves(game, attackerCoords);
	let defKing = defPiece(game, game.pcKing);
	if (!ismember(defKing.coords(),attackerMoves)) {
		// clicked on a piece which doesn't attack the PC king
		restoreGameHistory();
		setState("clear");
		return
	}
	
	
	attackerPiece.updateOptionsByDest(game, defKing.coords());
	updateOptionsFromEntanglement(game, game.turnColor);
	
	// It is possible that by setting a potential check the attacker collapses down to a true king and thus puts 
	// themselves into auto check. That wouldn't be a valid move
	clearFindPotentialCheckPieces();
	updateChecks(game.turnColor);
	if (game.autoCheck) {
		setState("invalidMoveIntoCheck");
		return;
	}
	
	highlightPCAttackers();
	setState("selectPCAttackers");
}

// Search for check against `color`, and remember the result in game.autoCheck / game.potCheck,
// which the rest of the page reads. Returns [kingCoords, attackerCoords].
function updateChecks(color) {
	const result = findChecks(game, color);
	game.autoCheck = result.autoCheck;
	game.potCheck = result.potCheck;
	return [result.kingCoords, result.attackerCoords];
}

function pcMoveText() {
	// The PC notation can't be added onto game.thisMove since the king is the last entry.
	// This function returns the "<....>" text for the potential check notation
	let txt = "";
	if (game.pcKing >= 0 && game.pcColor == oppColor(game.turnColor)) {
		let piece = defPiece(game, game.pcKing);
		txt = "<" + coords2text([piece.r, piece.c]) + "+";
		
		let kingCoords;
		let attackerCoords;
		[kingCoords,attackerCoords] = updateChecks(game.pcColor);
		for (let ai=0; ai < attackerCoords.length; ai++) {
			txt = txt + " " + coords2text([attackerCoords[ai][0], attackerCoords[ai][1]]);
		}
		txt = txt + ">";
	}
	return txt;
}

////////////////////////////////
// Piece collapse
////////////////////////////////
////////////////////////////////
// Utilities
////////////////////////////////
function coords2piece(coords) {
	return game.board[coords[0]][coords[1]];
}
////////////////////////////////
// State Control
////////////////////////////////

function debugPrint(txt) {
	let debugLabel = document.getElementById("debug");
	debugLabel.innerText = txt;
}

function setState(stateIn) {
	if (stateIn == "clear" && game.turnNumber == 0) {
		stateIn = "move0";
	}
	let prevState = STATE;
	STATE = stateIn;
	let promptlabel = document.getElementById("prompt");
	let moveTextarea = document.getElementById("thismove");
	let sideButton1 = document.getElementById("sideButton1")
	let sideButton2 = document.getElementById("sideButton2")
	let historyArea = document.getElementById("movehistory");
	if (STATE != "move0") {
		historyArea.contentEditable = false;
	}
	
	// All the changing of the actual display happens here, always by simply looping over the squares and displaying 
	// them according to the variables in the object. 
	let defaultText;
	let promptText = "";
	moveTextarea.value = game.thisMove + pcMoveText();
	if (game.turnNumber == 0) {
		promptText = "Black<br>Move 0 - ";
	}
	if (game.turnColor == "w") {
		promptText = promptText + "White<br>";
	} else {
		promptText = promptText + "Black<br>";
	}

	if (game.autoCheck) {
		promptText = promptText + " Check - ";
	}
	if (game.potCheck) {
		promptText = promptText + " Potential Check - ";
	}
	
	promptlabel.innerHTML = promptText + " select piece to move.";
	if (game.turnNumber == 0) {
		promptlabel.innerHTML = "Black<br>Move 0 - add Potential Check?";
	}
	if (STATE == "clear") {
		sideButton2.style.visibility = "hidden";
		sideButton1.style.visibility = "hidden";
		STARTCOORDS = [];
		ENDCOORDS = [];
		game.takenPiece = null;
		if (game.potCheck) {
			sideButton1.style.visibility = "visible";
			sideButton1.innerText = "Declare 'Not a King'";
		}
	} else if (STATE == "move0") {
		sideButton2.style.visibility = "visible";
		sideButton1.style.visibility = "visible";
		sideButton1.innerText = "Add PC";
		sideButton2.innerText = "Pass to white";
		STARTCOORDS = [];
		ENDCOORDS = [];
		game.takenPiece = null;
	} else if (STATE == "highlightPotentialMoves") {
		sideButton2.style.visibility = "hidden";
		sideButton1.style.visibility = "hidden";
	} else if (STATE == "showPartialMove") {
		sideButton2.style.visibility = "hidden";
		sideButton1.style.visibility = "hidden";
		promptlabel.innerHTML = promptText + "Select destination";
	} else if (STATE == "showCompleteMove") {
		sideButton2.style.visibility = "visible";
		sideButton2.innerText = "Submit";
		let nPotKings = highlightPotentialKings();
		clearFindPotentialCheckPieces();
		if (nPotKings > 0) {
			promptlabel.innerHTML = promptText + "Add Potential Check / Submit";
			sideButton1.style.visibility = "visible";
			sideButton1.innerText = "Add PC";
		} else {
			promptlabel.innerHTML = promptText + "Submit";
			sideButton1.style.visibility = "hidden";
		}
	} else if (STATE == "invalidMoveIntoCheck") {
		promptlabel.innerHTML = promptText + "Invalid - moved into check";
		sideButton2.style.visibility = "visible";
		sideButton1.style.visibility = "hidden";
		sideButton2.innerText = "Cancel";
	} else if (STATE == "selectPCKing") {
		promptlabel.innerHTML = promptText + "Select King to attack";
		sideButton2.style.visibility = "hidden";
		sideButton1.style.visibility = "hidden";
	} else if (STATE == "selectPCAttackers") {
		promptlabel.innerHTML = promptText + "Select attacking pieces";
		sideButton2.style.visibility = "hidden"; // turned visible when an attacker is found in the loop below
		sideButton1.style.visibility = "hidden";
		sideButton2.innerText = "Submit";
	}
	
	// Replay Buttons
	let back2 = document.getElementById("back2");
	let back1 = document.getElementById("back1");
	let forward1 = document.getElementById("forward1");
	let forward2 = document.getElementById("forward2");
	let historyButtons = document.getElementsByClassName("historyButton");
	highlightReplayLine();
	if (REPLAYNUMBER == -1) {
		forward1.style.visibility = "hidden";
		forward2.style.visibility = "hidden";
		if (game.turnNumber > 0) {
			back2.style.visibility = "visible";
			back1.style.visibility = "visible";
		} else {
			back2.style.visibility = "hidden";
			back1.style.visibility = "hidden";
		}
		for (let bi = 0; bi < historyButtons.length; bi++) {
			historyButtons[bi].style.visibility = "visible";
		}
	} else {
		back2.style.visibility = "visible";
		back1.style.visibility = "visible";
		forward1.style.visibility = "visible";
		forward2.style.visibility = "visible";
		
		for (let bi = 0; bi < historyButtons.length; bi++) {
			historyButtons[bi].style.visibility = "hidden";
		}
		sideButton2.style.visibility = "hidden";
		sideButton1.style.visibility = "visible";
		sideButton1.innerText = "Resume from here";
	}
	
	// Loop over all the squares and format them according to their current state
	let checkAttackerCoords = [];
	let checkKingCoords = [];
	if (STATE != "selectPCAttackers" && STATE != "selectPCKing" && STATE != "highlightPotentialMoves" && STATE != "clear") {
		clearFindPotentialCheckPieces();
	}
	[checkKingCoords,checkAttackerCoords] = updateChecks(game.turnColor);
	if (STATE == "selectPCAttackers") {
		// Can only get here if player is not in check. Now we want to show the PCKing selected.
		[checkKingCoords,checkAttackerCoords] = updateChecks(oppColor(game.turnColor));
	}
	
	let sqr;
	let piece;
	for (let r = 0; r <= 7; r++) {
		for ( let c = 0; c <= 7; c++) {
			sqr = SQUARES[r][c];
			piece = game.board[r][c];
			
			if (STATE == "clear" || STATE == "move0") {
				// For other states, the propertes are set in calling functions, but you can always reset to clear by 
				// just calling setState("clear")
				sqr.highlighted = 0;
				sqr.potentialMove = 0;
				sqr.highlightPotKing = 0;
				sqr.highlightPotAttacker = 0;
			}
			if (STATE == "showPartialMove") {
				sqr.highlighted = 0;
			}
			if (STATE == "showCompleteMove") {
				sqr.highlighted = 0;
				sqr.potentialMove = 0;
			}
			if (STATE == "invalidMoveIntoCheck") {
				sqr.highlighted = 0;
				sqr.potentialMove = 0;
			}
			if (STATE == "selectPCAttackers") {
				sqr.highlightPotKing = 0;
			}
			
			// Default border:
			sqr.resetButtonClasses();
			if (STATE == "clear" && REPLAYNUMBER == -1) {
				if (piece !== null && piece.color == game.turnColor) {
					sqr.button.classList.add("selectable");
				}
			}
			
			/* sqr.button.style.borderWidth = "";
			sqr.button.style.borderColor = "black"; 
			let sqrcolor;
			if (sqr.color=='w') {
				sqrcolor = "darkgray" // default white square colour
			} else {
				sqrcolor = "dimgray" // default black square colour
			}
			sqr.button.style.background = sqrcolor; */
			
			// Write text of pieces in sqaures:
			sqr.setWavetext(piece);

			// Change formatting if in non-default state:
			if (isequal([r,c], STARTCOORDS)) {
				// sqr.button.style.borderColor = "orange";
				// sqr.button.style.borderWidth = "6px";
				sqr.button.classList.add("selectedStart");
			}
			if (isequal([r,c], ENDCOORDS)) {
				// sqr.button.style.borderColor = "green";
				// sqr.button.style.borderWidth = "6px";
				sqr.button.classList.add("selectedEnd");
			}
			if (REPLAYNUMBER > -1) {
				// In replay, show the move that led to this position
				if (isequal([r,c], LASTSTARTCOORDS)) {
					sqr.button.classList.add("selectedStart");
				}
				if (isequal([r,c], LASTENDCOORDS)) {
					sqr.button.classList.add("selectedEnd");
				}
			}

			
			if (sqr.highlightPotKing == 1) {
				// sqr.button.style.background = 'red';
				sqr.button.classList.add("potKing");
			}
			if (sqr.highlightPotAttacker == 1) {
				// sqr.button.style.background = 'blue';
				sqr.button.classList.add("potAttacker");
			}
			
			// if they're selected then turn off the highlightPot* backgrounds
			if (game.autoCheck || game.potCheck || STATE == "selectPCAttackers") {
				if (isequal([r,c],checkKingCoords)) {
					sqr.button.classList.remove("potKing");
					sqr.button.classList.add("checkKing");
					/* sqr.button.style.background = sqrcolor;
					sqr.button.style.borderColor = "red";
					sqr.button.style.borderWidth = "6px"; */
				}
				if (ismember([r,c],checkAttackerCoords)) {
					sqr.button.classList.remove("potAttacker");
					sqr.button.classList.add("checkAttacker");
					/* sqr.button.style.background = sqrcolor;
					sqr.button.style.borderColor = "blue";
					sqr.button.style.borderWidth = "6px"; */
					if (STATE == "selectPCAttackers") {
						sideButton2.style.visibility = "visible";
					}
				}
			}
			if (sqr.highlighted) {
				sqr.button.classList.add("hovered");
				// sqr.button.style.background = 'orange';
			}
			if (sqr.potentialMove > 0) {
				sqr.button.classList.add("destination" + sqr.potentialMove);
				// sqr.button.style.background = 'green';
			}
			if (piece !== null) {
				let waves = piece.waves();
				if (FINDPIECE != "" && waves.includes(FINDPIECE)) {
					sqr.button.classList.add("findHighlight");
					// sqr.button.style.background = 'purple';
				}
			}
		}
	}
	
	// Built list of captured pieces for display
	let whitecaptured = "<strong>White Captured</strong><br>";
	let blackcaptured = "<strong>Black Captured</strong><br>";
	let whiteorder = [];
	let blackorder = [];
	let capturedwaves = [];
	for (let i=0; i<16; i++) {
		whiteorder.push(game.pieces.w[i].captured);
		blackorder.push(game.pieces.b[i].captured);
	}
	for (let i=0; i <= game.turnNumber; i++) {
		let idx = whiteorder.indexOf(i);
		if (idx > -1) {whitecaptured = whitecaptured + i + '. ' + game.pieces.w[idx].wavesWithBishopColor() + "<br>";}
		idx = blackorder.indexOf(i);
		if (idx > -1) {blackcaptured = blackcaptured + i + '. ' + game.pieces.b[idx].wavesWithBishopColor() + "<br>";}
	}
	
	let capturedLabel;
	capturedLabel = document.getElementById("whitecaptured");
	capturedLabel.innerHTML = whitecaptured;
	capturedLabel = document.getElementById("blackcaptured");
	capturedLabel.innerHTML = blackcaptured;
	
	// Update the findpiece buttons to display the correct piece for this color
	if (game.turnColor == "w") {
		document.getElementById("findKpiece").classList.remove("blackpiececollapsed");
		document.getElementById("findQpiece").classList.remove("blackpiececollapsed");
		document.getElementById("findRpiece").classList.remove("blackpiececollapsed");
		document.getElementById("findNpiece").classList.remove("blackpiececollapsed");
		document.getElementById("findBpiece").classList.remove("blackpiececollapsed");
		document.getElementById("findPpiece").classList.remove("blackpiececollapsed");
		document.getElementById("findKpiece").classList.add("whitepiececollapsed");
		document.getElementById("findQpiece").classList.add("whitepiececollapsed");
		document.getElementById("findRpiece").classList.add("whitepiececollapsed");
		document.getElementById("findNpiece").classList.add("whitepiececollapsed");
		document.getElementById("findBpiece").classList.add("whitepiececollapsed");
		document.getElementById("findPpiece").classList.add("whitepiececollapsed");
		document.getElementById("findKpiece").innerHTML = WK;
		document.getElementById("findQpiece").innerHTML = WQ;
		document.getElementById("findRpiece").innerHTML = WR;
		document.getElementById("findNpiece").innerHTML = WN;
		document.getElementById("findBpiece").innerHTML = WB;
		document.getElementById("findPpiece").innerHTML = WP;
//		for (i = 0; i < 6; i++) {
//			findbuttons[i].classList.remove("blackpiececollapsed");
//			findbuttons[i].classList.add("whitepiececollapsed");
//		}
	} else {
		document.getElementById("findKpiece").classList.remove("whitepiececollapsed");
		document.getElementById("findQpiece").classList.remove("whitepiececollapsed");
		document.getElementById("findRpiece").classList.remove("whitepiececollapsed");
		document.getElementById("findNpiece").classList.remove("whitepiececollapsed");
		document.getElementById("findBpiece").classList.remove("whitepiececollapsed");
		document.getElementById("findPpiece").classList.remove("whitepiececollapsed");
		document.getElementById("findKpiece").classList.add("blackpiececollapsed");
		document.getElementById("findQpiece").classList.add("blackpiececollapsed");
		document.getElementById("findRpiece").classList.add("blackpiececollapsed");
		document.getElementById("findNpiece").classList.add("blackpiececollapsed");
		document.getElementById("findBpiece").classList.add("blackpiececollapsed");
		document.getElementById("findPpiece").classList.add("blackpiececollapsed");
		document.getElementById("findKpiece").innerHTML = BK;
		document.getElementById("findQpiece").innerHTML = BQ;
		document.getElementById("findRpiece").innerHTML = BR;
		document.getElementById("findNpiece").innerHTML = BN;
		document.getElementById("findBpiece").innerHTML = BB;
		document.getElementById("findPpiece").innerHTML = BP;
//		for (i = 0; i < 6; i++) {
//			findbuttons[i].classList.add("blackpiececollapsed");
//			findbuttons[i].classList.remove("whitepiececollapsed");
//		}
	}
}

function highlightReplayLine() {
	let historyArea = document.getElementById("movehistory");
	let historyHTML = historyArea.innerHTML;
	
	let lineStyle = "<span style=\"background-color:lightgrey\">";
	historyHTML = historyHTML.replaceAll(lineStyle,"");
	historyHTML = historyHTML.replaceAll("</span>","");
	let historyLines = historyHTML.split("<br>");
	if (REPLAYNUMBER > -1) {
		historyLines[REPLAYNUMBER*2-1] = lineStyle + historyLines[REPLAYNUMBER*2-1] + "</span>";
	}
	historyArea.innerHTML = historyLines.join("<br>");
}

function setup() {
	game = createInitialState();
	SQUARES = []; // 8 x 8 array of SquareView objects (the page's buttons)
	STARTCOORDS = [];
	ENDCOORDS = [];
	LASTSTARTCOORDS = [];
	LASTENDCOORDS = [];
	FINDPIECE = "";

	let moveTextarea = document.getElementById("thismove");
	moveTextarea.value = "";
	if (REPLAYNUMBER == -1) {
		let historyArea = document.getElementById("movehistory");
		historyArea.innerText = "";
		historyArea.contentEditable = true;
	}

	for (let r = 0; r <= 7; r++) {
		let viewRow = [];
		for (let c = 0; c <= 7; c++) {
			viewRow.push(new SquareView(r, c, document.getElementById("square" + r + c)));
		}
		SQUARES.push(viewRow);
	}
	setState("move0");
}

////////////////////////////////
// Initialisation
////////////////////////////////
let game; // the game state: see src/engine/state.js

// Page state
let SQUARES; // 8 x 8 array of SquareView objects (the page's buttons)
let STARTCOORDS; // [r,c] of the move being made, or [] if none
let ENDCOORDS;
let LASTSTARTCOORDS; // start square of the last submitted move, for replay highlighting
let LASTENDCOORDS;   // end square of the last submitted move
let FINDPIECE;
let STATE;
let REPLAYNUMBER = -1;

////////////////////////////////
// Exports
////////////////////////////////
export {
	// Used by src/client/main.js to wire up the page
	setup,
	sideButton1Click,
	sideButton2Click,
	toggleFlippedBoard,
	findPiecesClick,
	stepBackAll,
	stepBackMove,
	stepForwardMove,
	stepForwardAll,
	restoreGameHistory,
	copyAllHistory,
	copyLastMove,
	pasteAllRestore,
	pasteLineRestore,

	// Used by tests/test.html and tests/generate.html to drive and inspect the game
	game,
	sideButton1Action,
	sideButton2Action,
	getHistoryLines,
	doMoveFromText,
	showPartialMove,
	showCompleteMove,
	selectPCKing,
	selectPCAttackers,
	getPotentialMoves,
	SQUARES,
	STATE,
};
