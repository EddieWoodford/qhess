// Classes
class Square {
    constructor(r, c, buttonID) {
        this.r = r;
        this.c = c;
		this.piece = "";
		this.highlighted = 0;
		// 0 = not a potential move; 1-16 = bearing of potential move where 1=NNE, 2=NE, 3=ENE, 3=E, 5=ESE, etc.
		this.potentialMove = 0; 
		this.highlightPotKing = 0; // 0 = not a PK; 1 = candidate for PK; 
		this.highlightPotAttacker = 0; // 0 = not a PA; 1 = candidate for PA;
		
		let x = r+c;
		if (x%2 == 0) {
			this.color = "w";
		} else {
			this.color = "b";
		}
		this.chesscoords = String.fromCharCode(c+97) + (8-r);
		
        this.button = document.getElementById(buttonID);
        this.button.onmouseenter = () => {
			if (STATE == "clear") {
				highlightPotentialMoves(buttonID);
			}
        }
		this.button.onmouseleave = () => {
			if (STATE == "highlightPotentialMoves") {
				setState("clear");
			}
        }
		this.button.onclick = () => {
			if (ONLINEGAME && ONLINECOLOR == oppColor(TURNCOLOR)) {return}
			if (REPLAYNUMBER > -1) {return}
			FINDPIECE = "";
			clearFindPieces();
			if (STATE == "highlightPotentialMoves") {
				showPartialMove(buttonID);
			} else if (STATE == "showPartialMove") {
				showCompleteMove(buttonID);
			} else if (STATE == "selectPCKing") {
				selectPCKing(buttonID);
			} else if (STATE == "selectPCAttackers") {
				selectPCAttackers(buttonID);
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
		// this.button.addEventListener("click",this.set(buttonID))
		// this.button.addEventListener("mouseout",this.clear(buttonID))
	
	setWavetext() {
		let wavetext;
		let waves;
		if (this.piece == "") {
			wavetext = "";
		} else {
			
			wavetext = "";
			waves = this.piece.waves();
			let allwaves = "KQRBNP";
			for (let i=0; i<6; i++) {
				if (waves.includes(allwaves[i])) {
					wavetext = wavetext + allwaves[i];
				} else {
					wavetext = wavetext + "empty";
				}
				if (i==2) {wavetext = wavetext + "<br>"};
			}
			
			if (this.piece.color == "w") {
				if (waves.length==1) {
					wavetext = waves;
					wavetext = wavetext.replace (/^/, '<div class="whitepiececollapsed">');
				} else {
					wavetext = wavetext.replace (/^/, '<div class="whitepiece">');
				}
				wavetext = wavetext.replace (/$/, '</div>');
				// Need to be careful with the strings used in WB, WK, etc to ensure they don't contain any of the waves
				// "KWRBNP" as then this method of replacing the text would replace unintentional chars.
				wavetext = wavetext.replace("B",WB);
				wavetext = wavetext.replace("K",WK);
				wavetext = wavetext.replace("Q",WQ);
				wavetext = wavetext.replace("R",WR);
				wavetext = wavetext.replace("N",WN);
				wavetext = wavetext.replace("P",WP);
				wavetext = wavetext.replaceAll("empty","&nbsp;");
			} else {
				if (waves.length==1) {
					wavetext = waves;
					wavetext = wavetext.replace (/^/, '<div class="blackpiececollapsed">');
				} else {
					wavetext = wavetext.replace (/^/, '<div class="blackpiece">');
				}
				wavetext = wavetext.replace (/$/, '</div>');
				wavetext = wavetext.replace("B",BB);
				wavetext = wavetext.replace("K",BK);
				wavetext = wavetext.replace("Q",BQ);
				wavetext = wavetext.replace("R",BR);
				wavetext = wavetext.replace("N",BN);
				wavetext = wavetext.replace("P",BP);
				wavetext = wavetext.replaceAll("empty","&nbsp;");
			}
		}
		this.button.innerHTML = wavetext;
	}
    reset() {
        this.button.innerText = "";
    }
}

class Piece {
	constructor(i, r, c, color) {
		this.i = i; // 1-16, to identify each piece uniquely from starting position
		this.r = r; // row
		this.c = c; // column
		this.color = color;
		this.captured = -1; // turn number when this piece was captured. -1 indicates not yet captured
		this.hasmoved = 0; // boolean for whether this piece has moved
		this.fullcollapsed = 0; // boolean for whether this piece is fully collapsed
		this.promoted = 0; // boolean for whether this piece is a promoted pawn
		this.promotedOptions = [];
		// options:
		// options is a 16 element array of 0/1 values to indicate the remaining options available to this piece
		// P1,P2,P3,P4,P5,P6,P7,P8,R1,R2,N1,N2,Bb,Bw,Q, K
		// 0  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15
		this.options = Array(16).fill(1);
		if ((this.r+this.c)%2==0) {
			// on a white square, so black bishop is not possible
			this.options[12] = 0;
		} else {
			// on a black square, so white bishop is not possible
			this.options[13] = 0;
		}
	}
	coords() {
		return [this.r,this.c];
	}
	removewaves(waves) {
		// Remove a wave from the options array
		for (let wi=0; wi < waves.length; wi++) {
			let optidxs = wave2optidxs(waves[wi]);
			for (let oi = 0; oi < optidxs.length; oi++) {
				if (this.promoted==0) {
					this.options[optidxs[oi]] = 0;
				} else {
					this.promotedOptions[optidxs[oi]] = 0;
				}
			}
		}
	}
	updateOptionsByDest(destCoords) {
		let currentWaves = this.waves();
		for (let wi=0; wi < currentWaves.length; wi++) {
			let waveDestinations = getPotentialMoves([this.r,this.c],currentWaves[wi]);
			if (!ismember(destCoords,waveDestinations)) {
				this.removewaves(currentWaves[wi]);
			}
		}
	}
	waves() {
		// Waves string based on options array
		let allwaves = "KQBNRP";
		let wavesout = "";
		let subopts;
		for (let wi = 0; wi < 6; wi++) {
			let optidxs = wave2optidxs(allwaves[wi]);
			if (this.promoted == 0) {
				subopts = this.options.slice(optidxs[0],optidxs[optidxs.length-1]+1);
			} else {
				subopts = this.promotedOptions.slice(optidxs[0],optidxs[optidxs.length-1]+1);
		}
			if (sum(subopts) > 0) {
				wavesout = wavesout + allwaves[wi];
			}
		}
		return wavesout
	}
	wavesWithBishopColor() {
		let wavesout = this.waves();
		if (wavesout.includes('B')) {
			if (this.options[12]==1) {
				wavesout = wavesout.replace('B','Bb');
			} else {
				wavesout = wavesout.replace('B','Bw');
			}
		}
		return wavesout;
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
		findPotentialKingsToAttack();
		setState("selectPCKing");
	} else if (STATE == "clear" && POTCHECK) {
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
	let defKing = attPiece(PCKING);
	// THISMOVE = "[(" + defKing.waves() + ")" + BOARD[defKing.r][defKing.c].chesscoords;
	defKing.removewaves("K");
	// THISMOVE = THISMOVE + "(" + defKing.waves() + ")]";
	THISMOVE = THISMOVE + "[" + BOARD[defKing.r][defKing.c].chesscoords + "]";
	updateOptionsFromEntanglement(TURNCOLOR);
	PCKING = -1; 
	PCCOLOR = "";
	clearFindPotentialCheckPieces();
	findChecks(TURNCOLOR);
}

function submitMove() {
	// Here after clicking sideButton1 when a valid move is chosen
		
	// Update move history label:
	// The move annotation itself is constructed in showCompleteMove(), but if there is a Potential Check declared,
	// then the contents of the <> in the move annotation is done here
	if (PCCOLOR == TURNCOLOR) {
		// Must have gotten out of potential check
		PCKING = -1;
		PCCOLOR = "";
	}
	
	if (MOVEHISTORY.length > 0) {
		MOVEHISTORY = MOVEHISTORY + "\r\n"
	}
	MOVEHISTORY = MOVEHISTORY + THISMOVE + pcMoveText();
	historyArea = document.getElementById("movehistory");
	if (REPLAYNUMBER == -1) {
		historyArea.innerText = MOVEHISTORY;
	}
	if (ONLINEGAME && (ONLINECOLOR == "" || TURNCOLOR == ONLINECOLOR)) {
		// first person to make a move sets the colors
		ONLINECOLOR = TURNCOLOR;
		SOCKET.emit("make.move", {
			movetext: THISMOVE + pcMoveText(),
			color: TURNCOLOR
		});
	}
		
	TAKENPIECE.captured = TURNNUMBER;
	
	if (TURNCOLOR == "w") {
		TURNCOLOR =	"b";
	} else {
		TURNNUMBER = TURNNUMBER + 1;
		TURNCOLOR = "w";
	}
	if (TURNCOLOR == EPCOLOR) {
		EPCOLOR = "";
		EPCOORDS = [];
	}
	THISMOVE = TURNNUMBER.toString() + TURNCOLOR + ". ";
	clearFindPotentialCheckPieces();
	findChecks(TURNCOLOR);

	
	// copyLastMove();
}

function findPiecesClick(wave) {
	clearFindPieces();
	if (wave == FINDPIECE) {
		FINDPIECE = "";
	} else {
		FINDPIECE = wave;
		document.getElementById("find"+wave).style.background = "purple";
		document.getElementById("find"+wave).style.backgroundImage = "none";
	}
	setState(STATE);
}

function toggleBoardFontSize() {
    if (document.documentElement.style.getPropertyValue('--board-font-size') == '3.5vmin') {
        document.documentElement.style.setProperty('--board-font-size', '2.5vmin');
    } else {
        document.documentElement.style.setProperty('--board-font-size', '3.5vmin');
    }
}

function togglePageTheme() {
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
	let img = "linear-gradient(to bottom right, darkgray, dimgray)"
	document.getElementById("findK").style.backgroundImage = img;
	document.getElementById("findQ").style.backgroundImage = img;
	document.getElementById("findR").style.backgroundImage = img;
	document.getElementById("findN").style.backgroundImage = img;
	document.getElementById("findB").style.backgroundImage = img;
	document.getElementById("findP").style.backgroundImage = img;
}

function highlightPotentialMoves(buttonID) {
	// Highlight potential moves temporarily while mouse is over square
	let coords = buttonID2coords(buttonID);
	if (BOARD[coords[0]][coords[1]].piece == "") {return;}
	if (BOARD[coords[0]][coords[1]].piece.captured > -1) {return;}
	if (BOARD[coords[0]][coords[1]].piece.color == TURNCOLOR) {
		BOARD[coords[0]][coords[1]].highlighted = 1;

		let moves = getPotentialMoves(coords);
		for (let i=0; i < moves.length; i++) {
			delY = coords[0] - moves[i][0];
			delX = moves[i][1] - coords[1];
			// returns 1-16 = bearing of potential move where 1=NNE, 2=NE, 3=ENE, 3=E, 5=ESE, etc.
			let bearing = (Math.round(((Math.atan2(delX, delY) * 180) / Math.PI)/22.5) + 16 - 1) % 16 + 1;
			BOARD[moves[i][0]][moves[i][1]].potentialMove = bearing;
		}
		setState("highlightPotentialMoves");
	}
}

function showPartialMove(buttonID) {
	// Show potential moves after clicking on start location
	let coords = buttonID2coords(buttonID);
	let piece = coords2piece(coords);
	if (piece.color == TURNCOLOR) {
		
		STARTID = buttonID;
		let moves = getPotentialMoves(coords);
		for (let i=0; i<moves.length; i++) {
			delY = coords[0] - moves[i][0];
			delX = moves[i][1] - coords[1];
			// returns 1-16 = bearing of potential move where 1=NNE, 2=NE, 3=ENE, 3=E, 5=ESE, etc.
			let bearing = (Math.round(((Math.atan2(delX, delY) * 180) / Math.PI)/22.5) + 16 - 1) % 16 + 1;
			BOARD[moves[i][0]][moves[i][1]].potentialMove = bearing;
		}
		setState("showPartialMove");
	}
}

function showCompleteMove(buttonID,doEP,doPromotion) {
	// Input doEP (do en passant) is optional and typically empty, except for when restoring a move history
	
	// After clicking on destination:
	let startCoords = buttonID2coords(STARTID);
	let validDestinations = getPotentialMoves(startCoords);
	let endCoords = buttonID2coords(buttonID)
	if (!ismember(endCoords,validDestinations)) {
		setState("clear");
		return;
	}
	movingPiece = BOARD[startCoords[0]][startCoords[1]].piece;
	THISMOVE = THISMOVE + "(" + movingPiece.waves() + ")" + BOARD[startCoords[0]][startCoords[1]].chesscoords;
	
	// Remove the options from this piece based on movement:
	movingPiece.updateOptionsByDest(endCoords);
	
	
	movingPiece.hasmoved = 1;
	movingPiece.r = endCoords[0];
	movingPiece.c = endCoords[1];
	
	// Move the piece:
	ENDID = buttonID;
	TAKENPIECE = BOARD[endCoords[0]][endCoords[1]].piece;
	if (TAKENPIECE != "") {
		TAKENPIECE.captured = TURNNUMBER;
		TAKENPIECE.removewaves('K');
		THISMOVE = THISMOVE + "x";
	}
	BOARD[endCoords[0]][endCoords[1]].piece = movingPiece;
	BOARD[startCoords[0]][startCoords[1]].piece = "";
	
	
	// Collapse the pieces
	updateOptionsFromEntanglement();
	

	let direction  = -1;
	if (movingPiece.color == "w") {
		direction = 1;
	}
	
	// Check for en passant:
	if (isequal(endCoords,EPCOORDS) && movingPiece.waves().includes("P")) {
		if (movingPiece.waves().length > 1) {
			if (doEP == undefined) {
			// In this case the attacker needs to decide if they meant to do an en passant. If they do it collapses their piece to a pawn.
				doEP = confirm("En passant?");
			}
		} else {
			doEP = true;
		}
		if (doEP) {
			THISMOVE = THISMOVE + "x";
			movingPiece.removewaves("KQNRB");
			TAKENPIECE = BOARD[endCoords[0]+direction][endCoords[1]].piece;
			TAKENPIECE.captured = TURNNUMBER;
			TAKENPIECE.removewaves("KQNRB");
			BOARD[endCoords[0]+direction][endCoords[1]].piece = "";
			// update all the collpases again!
			updateOptionsFromEntanglement();
		} else {
			movingPiece.removewaves("P");
			updateOptionsFromEntanglement();
		}
	} else {
		doEP = false;
	}
	
	
	// Save the en passant square
	if (movingPiece.waves().includes("P")) {
		if (endCoords[0]-startCoords[0] == -2*direction) {
			EPCOORDS = [startCoords[0]-direction,startCoords[1]];
			EPCOLOR = TURNCOLOR;
		}
	}
	
	// Check if the moving piece is a pawn to be promoted
	if (movingPiece.waves().includes("P")) {
		if ((TURNCOLOR=="w" && endCoords[0]==0) || (TURNCOLOR=="b" && endCoords[0]==7)) {
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
			updateOptionsFromEntanglement();
		}
	}
	
	// Finish move annotation
	if (doEP) {
		THISMOVE = THISMOVE + BOARD[endCoords[0]][endCoords[1]].chesscoords + "(" + movingPiece.waves() + ")";
		THISMOVE = THISMOVE + " e.p.";
	} else if (doPromotion) {
		THISMOVE = THISMOVE + BOARD[endCoords[0]][endCoords[1]].chesscoords + "(P)";
		THISMOVE = THISMOVE + "=(QRNB)";
	} else {
		THISMOVE = THISMOVE + BOARD[endCoords[0]][endCoords[1]].chesscoords + "(" + movingPiece.waves() + ")"
	}
	
	// Now, look to see if attacker has put themselves in automatic check. If so, it's an invalid move
	clearFindPotentialCheckPieces();
	[kingCoords,attackerCoords] = findChecks(TURNCOLOR);
	if (attackerCoords.length > 0) {
		// We will still display the invalid move, but make it impossible to submit, as
		// the player might want to inspect the board to understand how the check happened.
		setState("invalidMoveIntoCheck");
	} else {		
		// Check if the attacker has put the defender in auto check:
		clearFindPotentialCheckPieces();
		[kingCoords,attackerCoords] = findChecks(oppColor());
		if (AUTOCHECK) {
			THISMOVE = THISMOVE + "+";
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
	if (historyText != undefined) {
		historyText = historyText.replaceAll("\r\n\r\n","\r\n");
		historyArea.innerText = historyText;
	}
	historyText = historyArea.innerHTML;
	historyText = historyText.replaceAll("&gt;",">");
	historyText = historyText.replaceAll("&lt;","<");
	let historyLines = historyText.split("<br>");
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
	let r;
	let c;
	
	// Check that the move number eg "3w. " is correct
	moveText = moveText.split(".");
	turnText = moveText[0].trim();
	moveText = moveText[1].trim();
	if (turnText != TURNNUMBER.toString() + TURNCOLOR) {
		debugPrint("Move text number + colour did not match expected");
	}
	
	let doEP = (moveText.includes("e.p.")); // do En Passant
	let doPromotion = (moveText.includes("=")); // do Pawn Promotion
	let pcText = "";
	if (moveText.includes("]")) {
		// declare Not A King
		moveText = moveText.split("]");
		moveText = moveText[1];
		sideButton1Action(); 
	}
	if (moveText.includes("<")) {
		// Split off potential check text to apply later
		moveText = moveText.split(">");
		moveText = moveText[0].split("<");
		pcText = moveText[1].split(" ");
		moveText = moveText[0];
	}
	if (moveText.includes("(")) {
		// Remove waveforms as they're not needed for the replay
		moveText = moveText.split(")");
		moveText = moveText[1].split("(");
		moveText = moveText[0];
	}
	if (TURNNUMBER > 0) {
		// moveText should include an actual move
		moveText = moveText.replace("x","");
		
		// Now moveText should be 4 chars long, such as h2h3, indicating the from-to coordinates
		[r,c] = coordstext2coords(moveText.substring(0,2));
		let startButtonID = coords2buttonID([r,c]);
		[r,c] = coordstext2coords(moveText.substring(2,4));
		let endButtonID = coords2buttonID([r,c]);
		showPartialMove(startButtonID);
		showCompleteMove(endButtonID,doEP,doPromotion);
	}
	
	if (pcText.length > 0) {
		sideButton1Action(); // "Add Potential Check" button
		[r,c] = coordstext2coords(pcText[0]);
		let kingButtonID = coords2buttonID([r,c]);
		selectPCKing(kingButtonID);
		let attackerButtonID;
		for (pci=1; pci < pcText.length; pci++) {
			// Start at idx 1 since idx 0 is the king
			pcText[pci] = pcText[pci].replace("+","");
			[r,c] = coordstext2coords(pcText[pci]);
			let attackerButtonID = coords2buttonID([r,c]);
			selectPCAttackers(attackerButtonID);
		}
	}
	return THISMOVE + pcMoveText();
	
}

function copyAllHistory() {
	let historyArea = document.getElementById("movehistory");
	let historyText = historyArea.innerText;
	navigator.clipboard.writeText(historyText);
}

function copyLastMove() {
	let historyArea = document.getElementById("movehistory");
	let historyText = historyArea.innerText;
	historyText = historyText.split("\r\n");
	historyText = historyText[historyText.length-1];
	historyText = historyText.split("\r");
	historyText = historyText[historyText.length-1];
	historyText = historyText.split("\n");
	historyText = historyText[historyText.length-1];
	navigator.clipboard.writeText(historyText);
}

function pasteAllRestore() {
	let historyArea = document.getElementById("movehistory");
	historyArea.innerText = "";
	navigator.clipboard.readText().then((clipText) => (restoreGameHistory(clipText)));
}

function pasteLineRestore() {
	let historyArea = document.getElementById("movehistory");
	historyText = historyArea.innerText;
	navigator.clipboard.readText().then((clipText) => (restoreGameHistory(historyText + "\r\n" + clipText)));
}

function stepBackAll() {
	REPLAYNUMBER = 0.5;
	restoreGameHistory(null, 2*REPLAYNUMBER);
}

function stepBackMove() {
	if (REPLAYNUMBER == -1) {
		// starting replay from game state
			if (TURNCOLOR == "w") {
			REPLAYNUMBER = TURNNUMBER - 0.5;
		} else {
			REPLAYNUMBER = TURNNUMBER;
		}
	}
	REPLAYNUMBER = REPLAYNUMBER - 0.5;
	REPLAYNUMBER = Math.max(REPLAYNUMBER,0.5);
	restoreGameHistory(null, 2*REPLAYNUMBER);
	
}

function stepForwardMove() {
	let historyArea = document.getElementById("movehistory");
	historyLines = historyArea.innerHTML.split("<br>");
	if (REPLAYNUMBER < historyLines.length/2) {
		moveText = historyLines[2*REPLAYNUMBER];
		REPLAYNUMBER = REPLAYNUMBER + 0.5;
		doMoveFromText(moveText);
		sideButton2Action(); // submit
		
		// restoreGameHistory(null, 2*REPLAYNUMBER);
	}
}

function stepForwardAll() {
	let historyArea = document.getElementById("movehistory");
	historyLines = historyArea.innerHTML.split("<br>");
	REPLAYNUMBER = historyLines.length/2;
	restoreGameHistory(null, 2*REPLAYNUMBER);
}


function replaynumber2turnID() {
	if (REPLAYNUMBER == -1) {
		return "";
	} else if (REPLAYNUMBER % 1 == 0) {
		return TURNNUMBER.toString() + "w. ";
	} else {
		return TURNNUMBER.toString() + "b. ";
	}
}



////////////////////////////////
// Check
////////////////////////////////
function findPotentialKingsToAttack() {
	// FInd all candidate kings for potential check
	let pieces = getPieces(TURNCOLOR);
	let piece;
	let moves;
	let nPotKings = 0;
	
	for (let r=0; r<8; r++) {
		for (let c=0; c<8; c++) {
			if (BOARD[r][c].piece == "") {continue};
			if (BOARD[r][c].piece.color == TURNCOLOR) {continue};
			if (!BOARD[r][c].piece.waves().includes("K")) {continue};
			// Now we know the square has an opponent king-wave on it
			// If the square is being attacked by any piece then it is a valid candidate for a PC King, and then we want to
			// highlight it.
			for (let pi=0; pi < pieces.length; pi++) {
				piece = pieces[pi];
				if (piece.captured > -1) {continue}
				moves = getPotentialMoves([piece.r,piece.c]);
				if (ismember([r,c],moves)) {
					BOARD[r][c].highlightPotKing = 1;
					nPotKings++;
				}
			}
		}
	}
	return nPotKings;
}

function findPCAttackers() {
	// Now a potential check king has been selected, so highlight the potential attacking pieces
	// Also called after every new PC attacker is selected, in case that selection collapses waves and changes
	// the remaining candidates
	
	let attackPieces = getPieces(TURNCOLOR);
	let piece;
	let moves;
	let defKing = defPiece(PCKING);
	
	let potAttackerCoords = [];
	for (let pi=0; pi < attackPieces.length; pi++) {
		piece = attackPieces[pi];
		if (piece.captured > -1) {continue}
		moves = getPotentialMoves(piece.coords());
		if (ismember(defKing.coords(),moves)) { 
			BOARD[piece.r][piece.c].highlightPotAttacker = 1;
			potAttackerCoords.push([piece.r,piece.c]);
		} else {
			BOARD[piece.r][piece.c].highlightPotAttacker = 0;
		}
	}
	return potAttackerCoords;
}

function clearFindPotentialCheckPieces() {
	for (let r=0; r<8; r++) {
		for (let c=0; c<8; c++) {
			BOARD[r][c].highlightPotKing = 0;
			BOARD[r][c].highlightPotAttacker = 0;
		}
	}
}

function selectPCKing(buttonID) {
	// Get here after clicking on a square in "selectPCKing" state
	let kingCoords = buttonID2coords(buttonID);
	if (BOARD[kingCoords[0]][kingCoords[1]].highlightPotKing == 0) {
		restoreGameHistory();
		setState("clear");
		return
	}
	clearFindPotentialCheckPieces(); // stop highlighting the potential kings
	
	// Make this piece the PC King
	PCKING = BOARD[kingCoords[0]][kingCoords[1]].piece.i;
	PCCOLOR = BOARD[kingCoords[0]][kingCoords[1]].piece.color;
	let potAttackerCoords = findPCAttackers();
	if (potAttackerCoords.length == 1) {
		let buttonID = coords2buttonID(potAttackerCoords[0]);
		selectPCAttackers(buttonID);
	} else {
		setState("selectPCAttackers");
	}
}

function selectPCAttackers(buttonID) {
	// Get here when a PC attacker is selected by clicking on its square
	
	let attackerCoords = buttonID2coords(buttonID);
	let attackerPiece = coords2piece(attackerCoords);
	if (attackerPiece == "" || attackerPiece.color != TURNCOLOR) {
		// clicked on an empty square
		restoreGameHistory();
		setState("clear");
		return
	}
	
	let attackerMoves = getPotentialMoves(attackerCoords);
	let defKing = defPiece(PCKING);
	if (!ismember(defKing.coords(),attackerMoves)) {
		// clicked on a piece which doesn't attack the PC king
		restoreGameHistory();
		setState("clear");
		return
	}
	
	
	attackerPiece.updateOptionsByDest(defKing.coords());
	updateOptionsFromEntanglement(TURNCOLOR);
	
	// It is possible that by setting a potential check the attacker collapses down to a true king and thus puts 
	// themselves into auto check. That wouldn't be a valid move
	clearFindPotentialCheckPieces();
	findChecks(TURNCOLOR);
	if (AUTOCHECK) {
		setState("invalidMoveIntoCheck");
		return;
	}
	
	findPCAttackers();
	setState("selectPCAttackers");
}

function findChecks(color) {
	// Search to see if a check exists. 
	// Should be called whenever the board state changes and is potentially in a valid move position
	// color is the color of the king to check for check. What a great sentance.
	
	// First look for Auto Check:
	AUTOCHECK = false;
	POTCHECK = false;
	let defPieces = getPieces(color);
	let attPieces = getPieces(oppColor(color));
	let kingCoords = [];
	for (let pi=0; pi < 16; pi++) {
		if (defPieces[pi].captured==-1 && defPieces[pi].waves() == "K") {
			kingCoords = [defPieces[pi].r,defPieces[pi].c];
			break;
		}
	} 
	let attackerCoords = [];
	if (kingCoords.length > 0) {
		// There is a collapsed king, so look for auto check
		let moveCoords;
		for (let pi=0; pi < 16; pi++) {
			attacker = attPieces[pi];
			if (attacker.captured > -1) {continue}
			moveCoords = getPotentialMoves(attacker.coords());
			if (ismember(kingCoords,moveCoords)) {
				attackerCoords.push(attacker.coords());
			}
		}
		if (attackerCoords.length > 0) {
			AUTOCHECK = true;
			return [kingCoords,attackerCoords];
		} else {
			// For auto check, only return anything if there are attackers
			return [[],[]];
		}
		
	} else {

		// If no auto check, then check if the defender of potential check has moved the potential king out of the way ...
		// of the potential attackers.
		if (PCKING == -1) {
			return [[],[]];
		}
		if (PCCOLOR != color) {
			return [[],[]];
		}
		let defKing = defPieces[PCKING];
		if (!defKing.waves().includes("K")) {
			return [[],[]];
		}
		kingCoords = [defKing.r,defKing.c];
		let pi = 0;
		let attacker;
		let moveCoords;
		for (let pi=0; pi < 16; pi++) {
			// Loop through the attacking pieces and see if it is unambiguously attacking the potential king.
			attacker = attPieces[pi];
			if (attacker.captured > -1) {continue}
			moveCoords = getCertainMoves(attacker.coords());
			if (ismember(kingCoords,moveCoords)) {
				attackerCoords.push(attacker.coords());
			}
		}
		if (attackerCoords.length > 0) {
			POTCHECK = true;
		}
		// even if no attackers exist, still return the kingCoords
		return [kingCoords,attackerCoords];
		
	}
}

function pcMoveText() {
	// The PC notation can't be added onto THISMOVE since the king is the last entry.
	// This function returns the "<....>" text for the potential check notation
	let txt = "";
	if (PCKING >= 0 && PCCOLOR == oppColor()) {
		piece = defPiece(PCKING);
		txt = "<" + BOARD[piece.r][piece.c].chesscoords + "+";
		
		let kingCoords;
		let attackerCoords;
		[kingCoords,attackerCoords] = findChecks(PCCOLOR);
		for (let ai=0; ai < attackerCoords.length; ai++) {
			txt = txt + " " + BOARD[attackerCoords[ai][0]][attackerCoords[ai][1]].chesscoords;
		}
		txt = txt + ">";
	}
	return txt;
}

////////////////////////////////
// Piece collapse
////////////////////////////////

function updateOptionsFromFullCollapse(colors) {
	// Loop through the pieces. Continue until the set isn't changed after a pass.
	// If a piece only has one waveform, assign it to a specific option, and remove that option from all other pieces
	let pieces;
	let i;
	let piece;
	if (colors == undefined) {
		colors = ["w","b"];
	}
	for (color of colors) {	
		pieces = getPieces(color);
		i = 0;
		while (i < 16) {
			piece = pieces[i];
			if (piece.fullcollapsed == 1) {
				i = i+1;
				continue;
			}
			if (piece.promoted == 1) {
				i = i+1;
				continue;
			}
			// If a piece only has one waveform, assign it to a specific option, 
			// and remove that option from all other pieces:
			let waves = piece.waves();
			if (waves.length == 1) {
				let optidxs = wave2optidxs(waves);
				for (oi = 0; oi < optidxs.length; oi++) {
					if (piece.options[optidxs[oi]] == 1) {
						break;
					}
				}
				// Now optidxs[oi] is the option index to set for this piece and remove for all others
				// Loop through other pieces:
				for (j = 0; j < 16; j++) {
					if (j==i) {
						pieces[j].options = Array(16).fill(0);
						pieces[j].options[optidxs[oi]] = 1;	
					} else {
						pieces[j].options[optidxs[oi]] = 0;
					}
				}
				piece.fullcollapsed = 1;
				i = 0; // start the loop again
			} else {
				i = i+1;
			}
		}
	}
}

function updateOptionsFromEntanglement(colors) {
	
	let OM_original;
	let OM;
	let pieceIdx;
	let optionIdx;
	let matchingCols;
	let matchingRows;
	let rowsDone;
	let colsDone;
	let OM_before;
	let result;
	
	
	if (colors == undefined) {
		colors = ["w","b"];
	}
	updateOptionsFromFullCollapse(colors);
	for (color of colors) {	
		pieces = getPieces(color);
		OM_original = getOM(pieces);
		OM = clone2DArray(OM_original);

		if (isValid(OM)) {
			pieceIdx = -1;
			rowsDone = Array(16).fill(false);
			OM_before = clone2DArray(OM);

			while (pieceIdx < 15) { // <15 here since we increment at start of loop
				pieceIdx++;

				if (rowsDone[pieceIdx]) {
					continue;
				}

				matchingRows = Array(16).fill(false);
				for (let ri = pieceIdx; ri < 16; ri++) {
					if (isequal(OM[pieceIdx], OM[ri])) {
						matchingRows[ri] = true;
					}
				}

				colsDone = Array(16).fill(false);

				for (optionIdx = 0; optionIdx < 16; optionIdx++) {
					matchingCols = Array(16).fill(false);

					if (colsDone[optionIdx]) {
						continue;
					}

					for (let ci = optionIdx; ci < 16; ci++) {
						if (isequal(getcolumn(OM, optionIdx), getcolumn(OM, ci))) {
							matchingCols[ci] = true;
						}
					}

					if (OM[pieceIdx][optionIdx] === 1) {
						// imagine that this piece is moved so that only this option remains
						let OM_reduced = clone2DArray(OM);
						OM_reduced.splice(pieceIdx, 1);
						OM_reduced.forEach(row => row.splice(optionIdx, 1));

						// Sort 1's into bottom right corner. This speeds things up significantly in testing
						let sum1 = colsum(OM_reduced);
						let sum2 = rowsum(OM_reduced);
						OM_reduced = sortcols(OM_reduced,sum1);
						OM_reduced = sortrows(OM_reduced,sum2);

						result = isValid(OM_reduced);

						if (!result) {
							setvalue(OM[pieceIdx],matchingCols,0);
						}
					}
					setvalue(colsDone,matchingCols,true);
				}
				for (let ri = pieceIdx; ri < 16; ri++) {
					if (matchingRows[ri]) {
						OM[ri] = [...OM[pieceIdx]];
						pieces[ri].options = [...OM[pieceIdx]];
						rowsDone[ri] = true;
					}
				}

				if (!isequal(OM_before[pieceIdx], OM[pieceIdx])) {
					// Something has changed, so start the process again as that change may induce new collapses
					pieceIdx = -1;
					rowsDone = Array(16).fill(false);
					updateOptionsFromFullCollapse(color);
					OM_before = clone2DArray(OM);
				}
			}

		} else {
			throw new Error('Original OM is not valid');
		}
	}
}

function getOM(pieces) {
	let OM = [];
	for (let pi=0; pi < pieces.length; pi++) {
		OM.push(pieces[pi].options);
	}
	return OM;
}

function isValid(OM) {
	// Check if the Option Matrix (OM) is valid - it contains an arrangement which would result in a full chess demographic. 
	// That's equivalent to saying that the bipartite graph indicated by the OM has a perfect matching, 
	// or that each row can be assigned to exactly 1 column with a 1 in entry (row,col).
	
	
	
    const sz = [OM.length, OM[0].length];
	
    if (sz[0] != sz[1]) {
        throw new Error('OM should be square');
    }

    if (sz[0] === 1) {
        let result = +(OM==1);
        return result;
    }

    const sum1 = colsum(OM);
    if (sum1.some(val => val === 0)) {
        return false;
    }

    const sum2 = rowsum(OM);
    if (sum2.some(val => val === 0)) {
        return false;
    }

    let done = new Array(sz[0]).fill(false);
	let matchingRows;
	let OM2;
	for (let i=0; i < OM.length; i++) {
        if (done[i]) {
            continue;
        }

        matchingRows = new Array(sz[0]).fill(false);
        for (let ri = i; ri < sz[0]; ri++) {
            if (OM[ri].every((val, idx) => val === OM[i][idx])) {
                matchingRows[ri] = true;
            }
        }

        if (OM[i][0] === 1) {
            OM2 = OM.map(row => row.slice(1)); // delete 1st col
            OM2.splice(i, 1); // delete ith row
            if (isValid(OM2)) {
                return true;
            }
        }
		setvalue(done,matchingRows,true);
		
    }
	// If we make it here then none of the rows gave a valid result, so return false
    return false;
}

function getCertainMoves(coords) {
	// Get a list of the certain move destinations. That is - the desinations that a piece can definitely move to in all of their available waves.
	
	let piece = BOARD[coords[0]][coords[1]].piece; // Find the source pieceID
	if (piece=="") {
		return [];
	}
	let waves = piece.waves();
	let moves;
	let thismoves;
	for (wi=0; wi < waves.length; wi++) {
		// Loop through the waves and intersec the resulting moves
		thismoves = getPotentialMoves(coords,waves[wi]);
		if (wi==0) {
			moves = clone2DArray(thismoves);
		} else {
			let mi=0;
			while (mi < moves.length) {
				if (!ismember(moves[mi],thismoves)) {
					moves.splice(mi,1);
					if (moves.length == 0) {
						return [];
					}
				} else {
					mi++;
				}
			}
		}
	}
	return moves;
	
}

function getPotentialMoves(coords,waves) {
	// Get a list of all potential destination coordinates.
	// Optional input waves only returns destination for those passed in, otherwise use waves available to piece
	
	let piece = BOARD[coords[0]][coords[1]].piece; // Find the source pieceID
	if (piece.captured > -1) {
		return []
	}
	if (piece=="") {
		return []
	}
	if (waves == undefined) {
		waves = piece.waves();
	}
	let opponentColor = "w";
	let direction  = -1;
	if (piece.color == "w") {
		opponentColor = "b";
		direction = 1;
	}
	let newcoords = [];
	let moves = [];
	// Switch through difference piece types, adding to the growing moves array
	
	// King:
	if (waves.includes("K")) {
		for (let r=-1; r<=1; r++) {
			for (let c=-1; c<=1; c++) {
				newcoords = [coords[0]+r,coords[1]+c];
				if (isValidCoord(newcoords) && BOARD[newcoords[0]][newcoords[1]].piece.color != piece.color) {moves.push(newcoords)};
			}	
		}
	}
	
	// Pawn:
	if (waves.includes("P")) {
		newcoords = [coords[0]-direction,coords[1]]
		if (isValidCoord(newcoords) && BOARD[newcoords[0]][newcoords[1]].piece=="") {
			moves.push(newcoords)
			// if it can go 1 forward then it might be able to go 2 on its first move:
			if (piece.hasmoved == 0) {
				newcoords = [coords[0]-2*direction,coords[1]]
				if (isValidCoord(newcoords) && BOARD[newcoords[0]][newcoords[1]].piece=="") {
					moves.push(newcoords)
				}
			}
		}
		
		newcoords = [coords[0]-direction,coords[1]-1]
		if (isValidCoord(newcoords)) {
			if (isequal(newcoords,EPCOORDS) || BOARD[newcoords[0]][newcoords[1]].piece.color == opponentColor) {
				moves.push(newcoords)
			}
		}
		newcoords = [coords[0]-direction,coords[1]+1]
		if (isValidCoord(newcoords)) {
			if (isequal(newcoords,EPCOORDS) || BOARD[newcoords[0]][newcoords[1]].piece.color == opponentColor) {
				moves.push(newcoords)
			}
		}
	}
	
	// Rooks and Queens:
	if (waves.includes("R") || waves.includes("Q")) {
		for (let i=coords[0]+1; i<=7; i++) {
			newcoords = [i,coords[1]]
			if (BOARD[newcoords[0]][newcoords[1]].piece.color == piece.color) {break;}
			moves.push(newcoords)
			if (BOARD[newcoords[0]][newcoords[1]].piece!="") {break;}
		}
		for (let i=coords[0]-1; i>=0; i--) {
			newcoords = [i,coords[1]]
			if (BOARD[newcoords[0]][newcoords[1]].piece.color == piece.color) {break;}
			moves.push(newcoords)
			if (BOARD[newcoords[0]][newcoords[1]].piece!="") {break;}
		}
		for (let i=coords[1]+1; i<=7; i++) {
			newcoords = [coords[0],i]
			if (BOARD[newcoords[0]][newcoords[1]].piece.color == piece.color) {break;}
			moves.push(newcoords)
			if (BOARD[newcoords[0]][newcoords[1]].piece!="") {break;}
		}
		for (let i=coords[1]-1; i>=0; i--) {
			newcoords = [coords[0],i]
			if (BOARD[newcoords[0]][newcoords[1]].piece.color == piece.color) {break;}
			moves.push(newcoords)
			if (BOARD[newcoords[0]][newcoords[1]].piece!="") {break;}
		}
	}
	
	// Bishops and Queens:
	if (waves.includes("B") || waves.includes("Q")) {
		for (let i=1; i<=7; i++) {
			newcoords = [coords[0]+i,coords[1]+i]
			if (isValidCoord(newcoords)) {
				if (BOARD[newcoords[0]][newcoords[1]].piece.color == piece.color) {break;}
				moves.push(newcoords)
				if (BOARD[newcoords[0]][newcoords[1]].piece!="") {break;}
			}
		}
		for (let i=1; i<=7; i++) {
			newcoords = [coords[0]+i,coords[1]-i]
			if (isValidCoord(newcoords)) {
				if (BOARD[newcoords[0]][newcoords[1]].piece.color == piece.color) {break;}
				moves.push(newcoords)
				if (BOARD[newcoords[0]][newcoords[1]].piece!="") {break;}
			}
		}
		for (let i=1; i<=7; i++) {
			newcoords = [coords[0]-i,coords[1]-i]
			if (isValidCoord(newcoords)) {
				if (BOARD[newcoords[0]][newcoords[1]].piece.color == piece.color) {break;}
				moves.push(newcoords)
				if (BOARD[newcoords[0]][newcoords[1]].piece!="") {break;}
			}
		}
		for (let i=1; i<=7; i++) {
			newcoords = [coords[0]-i,coords[1]+i]
			if (isValidCoord(newcoords)) {
				if (BOARD[newcoords[0]][newcoords[1]].piece.color == piece.color) {break;}
				moves.push(newcoords)
				if (BOARD[newcoords[0]][newcoords[1]].piece!="") {break;}
			}
		}
	}
	
	// Knights:
	if (waves.includes("N")) {
		newcoords = [coords[0]+2,coords[1]+1];
		if (isValidCoord(newcoords) && BOARD[newcoords[0]][newcoords[1]].piece.color != piece.color) {moves.push(newcoords)};
		newcoords = [coords[0]+2,coords[1]-1];
		if (isValidCoord(newcoords) && BOARD[newcoords[0]][newcoords[1]].piece.color != piece.color) {moves.push(newcoords)};
		newcoords = [coords[0]-2,coords[1]+1];
		if (isValidCoord(newcoords) && BOARD[newcoords[0]][newcoords[1]].piece.color != piece.color) {moves.push(newcoords)};
		newcoords = [coords[0]-2,coords[1]-1];
		if (isValidCoord(newcoords) && BOARD[newcoords[0]][newcoords[1]].piece.color != piece.color) {moves.push(newcoords)};
		newcoords = [coords[0]+1,coords[1]+2];
		if (isValidCoord(newcoords) && BOARD[newcoords[0]][newcoords[1]].piece.color != piece.color) {moves.push(newcoords)};
		newcoords = [coords[0]+1,coords[1]-2];
		if (isValidCoord(newcoords) && BOARD[newcoords[0]][newcoords[1]].piece.color != piece.color) {moves.push(newcoords)};
		newcoords = [coords[0]-1,coords[1]+2];
		if (isValidCoord(newcoords) && BOARD[newcoords[0]][newcoords[1]].piece.color != piece.color) {moves.push(newcoords)};
		newcoords = [coords[0]-1,coords[1]-2];
		if (isValidCoord(newcoords) && BOARD[newcoords[0]][newcoords[1]].piece.color != piece.color) {moves.push(newcoords)};
	}
	
	for (let i=moves.length-1; i>=0; i--) {
		if (moves[i][0]==coords[0] && moves[i][1]==coords[1]) {
			moves.splice(i,1)
		}
	}
	
	return moves
}

////////////////////////////////
// Utilities
////////////////////////////////
function setvalue(arr,filter,val) {
	for (let i=0; i < filter.length; i++) {
		if (filter[i]) {
			arr[i] = val;
		}
	}
}
function isequal(arr1, arr2) {
    if (arr1.length !== arr2.length) {
        return false;
    }
	for (let i=0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i]) {
            return false;
        }
    }
    return true;
}
function clone2DArray(arr) {
    return arr.map(row => [...row]);
}
function buttonID2coords(buttonID) {
	return [+buttonID.substr(6,1),+buttonID.substr(7,2)]
}
function coords2piece(coords) {
	return BOARD[coords[0]][coords[1]].piece;
}
function coords2buttonID(coords) {
	return "square"+coords[0]+coords[1]
}
function coordstext2coords(coordstext) {
	c = coordstext[0].charCodeAt()-97;
	r = 8-coordstext[1];
	return [r,c];
}
function isValidCoord(coords) {
	return coords[0] >= 0 && coords[0] <= 7 && coords[1] >= 0 && coords[1] <= 7
}
function ismember(coords,coordlist) {
	for (let i=0; i < coordlist.length; i++) {
		if (coords[0] == coordlist[i][0] && coords[1] == coordlist[i][1]) {
			return 1
		}
	}
	return 0
}
function sum(x) {
	return x.reduce((a, b) => a + b, 0)
}
function getcolumn(matrix, col) {
    return matrix.map(row => row[col]);
}
function colsum(M) {
	return M.reduce((x, a) => x.map((b, i) => a[i] + b));
}
function rowsum(M) {
	return M.map(y => y.reduce((a, b) => a+b));
}
function sortcols(M,ref) {
	// Sort ref and then sort the cols of M the same way
	idxs = Array.from(ref.keys()).sort((a,b) => ref[a]-ref[b])
	for (let i=0; i < M.length; i++) {
		M[i] = idxs.map(j => M[i][j])
	}
	return M
}
function sortrows(M,ref) {
	// Sort ref and then sort the rows of M the same way
	idxs = Array.from(ref.keys()).sort((a,b) => ref[a]-ref[b])
	M = idxs.map(j => M[j])
	return M
}
function wave2optidxs(wave) {
	// P1,P2,P3,P4,P5,P6,P7,P8,R1,R2,N1,N2,Bb,Bw,Q, K
	// 0  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15
	if (wave=="P") {
		return [0,1,2,3,4,5,6,7];
	}
	if (wave == "R") {
		return [8,9];
	}
	if (wave == "N") {
		return [10,11];
	}
	if (wave == "B") {
		return [12,13];
	}
	if (wave == "Q") {
		return [14];
	}
	if (wave=="K") {
		return [15]
	}
}
function oppColor(color) {
	if (color == undefined) {
		color = TURNCOLOR;
	}
	if (color=="w") {
		return "b";
	}
	return "w";
}
function getPieces(color) {
	if (color == "w") {
		return WHITEPIECES;
	} else {
		return BLACKPIECES;
	}
}
function defPiece(i) {
	let pieces = getPieces(oppColor());
	return pieces[i];
}
function attPiece(i) {
	let pieces = getPieces(TURNCOLOR);
	return pieces[i];
}

////////////////////////////////
// State Control
////////////////////////////////

function debugPrint(txt) {
	debugLabel = document.getElementById("debug");
	debugLabel.innerText = txt;
}

function setState(stateIn) {
	if (stateIn == "clear" && TURNNUMBER == 0) {
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
	moveTextarea.value = THISMOVE + pcMoveText();
	if (TURNNUMBER == 0) {
		promptText = "Black<br>Move 0 - ";
	}
	if (TURNCOLOR == "w") {
		promptText = promptText + "White<br>";
	} else {
		promptText = promptText + "Black<br>";
	}

	if (AUTOCHECK) {
		promptText = promptText + " Check - ";
	}
	if (POTCHECK) {
		promptText = promptText + " Potential Check - ";
	}
	
	promptlabel.innerHTML = promptText + " select piece to move.";
	if (TURNNUMBER == 0) {
		promptlabel.innerHTML = "Black<br>Move 0 - add Potential Check?";
	}
	
	if (STATE == "clear") {
		sideButton2.style.visibility = "hidden";
		sideButton1.style.visibility = "hidden";
		STARTID = "";
		ENDID = "";
		TAKENPIECE = "";
		if (POTCHECK) {
			sideButton1.style.visibility = "visible";
			sideButton1.innerText = "Declare 'Not a King'";
		}
	} else if (STATE == "move0") {
		sideButton2.style.visibility = "visible";
		sideButton1.style.visibility = "visible";
		sideButton1.innerText = "Add PC";
		sideButton2.innerText = "Pass to white";
		STARTID = "";
		ENDID = "";
		TAKENPIECE = "";
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
		let nPotKings = findPotentialKingsToAttack();
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
	let waitingForOpponent = false;
	if (ONLINEGAME && ONLINECOLOR == oppColor(TURNCOLOR)) {
		sideButton2.style.visibility = "hidden";
		sideButton1.style.visibility = "hidden";
		promptlabel.innerHTML = "Waiting for Opponent";
		waitingForOpponent = true;
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
		if (TURNNUMBER > 0) {
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
	[checkKingCoords,checkAttackerCoords] = findChecks(TURNCOLOR);
	if (STATE == "selectPCAttackers") {
		// Can only get here if player is not in check. Now we want to show the PCKing selected.
		[checkKingCoords,checkAttackerCoords] = findChecks(oppColor());
	}
	
	let sqr;
	let piece;
	for (let r = 0; r <= 7; r++) {
		for ( let c = 0; c <= 7; c++) {
			i = r*8 + c
			x = r + c
			sqr = BOARD[r][c];
			piece = sqr.piece;
			
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
			
			if (STATE == "clear" && !waitingForOpponent) {
				if (piece != "" && piece.color == TURNCOLOR) {
					sqr.button.classList.add("selectable");
				}
			}
			
			
			// Write text of pieces in sqaures:
			sqr.setWavetext();

			// Change formatting if in non-default state:
			if (sqr.button.id == STARTID) {
				// sqr.button.style.borderColor = "orange";
				// sqr.button.style.borderWidth = "6px";
				sqr.button.classList.add("selectedStart");
			}
			if (sqr.button.id == ENDID) {
				// sqr.button.style.borderColor = "green";
				// sqr.button.style.borderWidth = "6px";
				sqr.button.classList.add("selectedEnd");
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
			if (AUTOCHECK || POTCHECK || STATE == "selectPCAttackers") {
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
			
			if (!waitingForOpponent) {
				if (sqr.highlighted) {
					sqr.button.classList.add("hovered");
					// sqr.button.style.background = 'orange';
				}
				if (sqr.potentialMove > 0) {
					sqr.button.classList.add("destination" + sqr.potentialMove);
					// sqr.button.style.background = 'green';
				}
			}
			
			if (piece != "") {
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
		whiteorder.push(WHITEPIECES[i].captured);
		blackorder.push(BLACKPIECES[i].captured);
	}
	for (let i=0; i <= TURNNUMBER; i++) {
		let idx = whiteorder.indexOf(i);
		if (idx > -1) {whitecaptured = whitecaptured + i + '. ' + WHITEPIECES[idx].wavesWithBishopColor() + "<br>";}
		idx = blackorder.indexOf(i);
		if (idx > -1) {blackcaptured = blackcaptured + i + '. ' + BLACKPIECES[idx].wavesWithBishopColor() + "<br>";}
	}
	
	let capturedLabel;
	capturedLabel = document.getElementById("whitecaptured");
	capturedLabel.innerHTML = whitecaptured;
	capturedLabel = document.getElementById("blackcaptured");
	capturedLabel.innerHTML = blackcaptured;
	
	// Update the findpiece buttons to display the correct piece for this color
	if (TURNCOLOR == "w") {
		document.getElementById("findK").innerHTML = WK;
		document.getElementById("findQ").innerHTML = WQ;
		document.getElementById("findR").innerHTML = WR;
		document.getElementById("findN").innerHTML = WN;
		document.getElementById("findB").innerHTML = WB;
		document.getElementById("findP").innerHTML = WP;
	} else {
		document.getElementById("findK").innerHTML = BK;
		document.getElementById("findQ").innerHTML = BQ;
		document.getElementById("findR").innerHTML = BR;
		document.getElementById("findN").innerHTML = BN;
		document.getElementById("findB").innerHTML = BB;
		document.getElementById("findP").innerHTML = BP;
	}
}

function highlightReplayLine() {
	let historyArea = document.getElementById("movehistory");
	let historyHTML = historyArea.innerHTML;
	
	lineStyle = "<span style=\"background-color:lightgrey\">";
	historyHTML = historyHTML.replaceAll(lineStyle,"");
	historyHTML = historyHTML.replaceAll("</span>","");
	let historyLines = historyHTML.split("<br>");
	if (REPLAYNUMBER > -1) {
		historyLines[REPLAYNUMBER*2-1] = lineStyle + historyLines[REPLAYNUMBER*2-1] + "</span>";
	}
	historyArea.innerHTML = historyLines.join("<br>");
}

function setup() {
	TURNNUMBER = 0;
	TURNCOLOR = "b";
	TAKENPIECE = "";
	BOARD = []; // 8 x 8 array of Square objects
	STARTID = "";
	DESTID = "";
	WHITEPIECES = [];
	BLACKPIECES = [];
	MOVEHISTORY = "";
	THISMOVE = "0b. ";
	EPCOORDS = [];
	EPCOLOR = "";
	AUTOCHECK = false;
	POTCHECK = false;
	PCKING = -1; // piece idx which is selected as potential check king
	PCCOLOR = ""; // the color of the king in potential check
	FINDPIECE = "";
	
	moveTextarea = document.getElementById("thismove");
	moveTextarea.value = "";
	if (REPLAYNUMBER == -1) {
		historyArea = document.getElementById("movehistory");
		historyArea.innerText = "";
		historyArea.contentEditable = true;
	}
	
	
    let squareButtons = document.querySelectorAll('[id^="square"]');
	for (let r = 0; r <= 7; r++) {
		let thisrow = [];
		for ( let c = 0; c <= 7; c++) {
			i = r*8 + c
			let square = new Square(r, c, squareButtons[i].id);
			
			thisrow.push(square)
		}
		BOARD.push(thisrow)
	}
	for (let r = 0; r <= 1; r++) {
		for (let c=0; c <= 7; c++) {
			i = r*8 + c
			let piece = new Piece(i, r, c, 'b')
			BLACKPIECES.push(piece)
			BOARD[r][c].piece = BLACKPIECES[i]
		}
	}for (let r = 6; r <= 7; r++) {
		for (let c=0; c <= 7; c++) {
			i = (r-6)*8 + c
			let piece = new Piece(i, r, c, 'w')
			WHITEPIECES.push(piece)
			BOARD[r][c].piece = WHITEPIECES[i]
		}
	}
	setState("move0");
}

////////////////////////////////
// Networking
////////////////////////////////

function datestr() {
	const date = new Date();
	let currentDay= String(date.getDate()).padStart(2, '0');
	let currentMonth = String(date.getMonth()+1).padStart(2,"0");
	let currentYear = date.getFullYear();
	let currentMinute = String(date.getMinutes()).padStart(2,"0");
	let currentSecond = String(date.getSeconds()).padStart(2,"0");
	let currentHour = String(date.getHours()).padStart(2,"0");

	// we will display the date as DD-MM-YYYY 

	return `${currentYear}-${currentMonth}-${currentDay}--${currentHour}-${currentMinute}-${currentSecond}`;
}

function createGame() {
	if (!ONLINEGAME) {
		const genRanHex = size => [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
		const gameID = datestr() + "--" + genRanHex(8);
		ONLINEGAME = true;
		SOCKET.emit("create.game", {
			movehistory: MOVEHISTORY,
			gameID: gameID,
			playerID: "Alice"
		});
		navigator.clipboard.writeText(gameID);
		showNetworkID(gameID);
	}
}

function joinGame() {
	if (!ONLINEGAME) {
		ONLINEGAME = true;
		const gameID = prompt("Enter Game ID");
		SOCKET.emit("join.game", {
			gameID: gameID,
			playerID: "Bob"
		});
		showNetworkID(gameID);
	}
}

function leaveGame() {
	if (ONLINEGAME) {
		ONLINEGAME = false;
		ONLINECOLOR = "";
		SOCKET.emit("leave.game");
	}
}

function showNetworkID(gameID) {
	let lbl = document.getElementById("networkid");
	lbl.innerText = gameID;
}



////////////////////////////////
// Initialisation
////////////////////////////////

const url = window.location.origin;
let SOCKET;
if (url != "file://") {
	SOCKET = io.connect(url);
	// Bind event on players move
	SOCKET.on("move.made", function(data) {
		ONLINECOLOR = oppColor(data.color); // on first move, recieve colour choice
		let newMoveText = doMoveFromText(data.movetext);
		if (newMoveText == data.movetext) {
			sideButton2Action(); // submit
		}
	});
}


// Chess piece coloured emojis:
const WK = "<span style='color:#7E7427'>&#9812;</span>";
const WQ = "<span style='color:#563F54'>&#9813;</span>";
const WR = "<span style='color:#394F67'>&#9814;</span>";
const WB = "<span style='color:#771515'>&#9815;</span>";
const WN = "<span style='color:#803300'>&#9816;</span>";
const WP = "<span style='color:#45711A'>&#9817;</span>";
const BK = "<span style='color:#FCE94F'>&#9818;</span>";
const BQ = "<span style='color:#AD7FA8'>&#9819;</span>";
const BR = "<span style='color:#729FCF'>&#9820;</span>";
const BB = "<span style='color:#EF2929'>&#9821;</span>";
const BN = "<span style='color:#FF6600'>&#9822;</span>";
const BP = "<span style='color:#8AE234'>&#9823;</span>";

let TURNNUMBER;
let TURNCOLOR;
let TAKENPIECE;
let BOARD; // 8 x 8 array of Square objects
let STARTID;
let DESTID;
let WHITEPIECES;
let BLACKPIECES;
let MOVEHISTORY;
let THISMOVE;
let EPCOORDS;
let EPCOLOR;
let AUTOCHECK;
let POTCHECK;
let PCKING;
let PCCOLOR;
let FINDPIECE;
let STATE;
let REPLAYNUMBER = -1;
let ONLINEGAME = false;
let ONLINECOLOR = "";

window.onload = setup





