// Use port number from the PORT environment variable or 3000 if not specified
console.log(process.env.PORT)
const port = process.env.PORT || 3000;

const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server,{
	  connectionStateRecovery: {
		// the backup duration of the sessions and the packets
		maxDisconnectionDuration: 2 * 60 * 1000,
		// whether to skip middlewares upon successful recovery
		skipMiddlewares: true,
	  }
	});

const os = require("os");
// const fs = require("fs");

app.use(express.static(__dirname))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

server.listen(port, () => {
  console.log('listening on *:' + port);
});

if (os.hostname().indexOf("DESKTOP") > -1) {
    console.log('local at ' + __dirname )
} else {
	console.log(os.hostname())
	console.log('deployed at ' + __dirname )
}




// These arrays are all the same length and can be thought of as columns in a database, 1 row per game
var gameTitle = []; // array of gameTitle
var gameID = []; // array of gameID
var moveHistory = []; // array of move historys
var blackID = []; // black player ID
var blackSocket = []; // black socket
var blackSocketID = []; // black socket.id
var whiteID = []; // white ID
var whiteSocket = []; // white socket
var whiteSocketID = []; // white socket.id

// Object with playerID as property and list of gameIDs as value
var players = {};

// When a client connects
io.on("connection", function(socket) {
    let id = socket.id;

    console.log("New client connected. ID: ", socket.id);

	socket.on("login.attempt", function(data) {
		// Login credentials check goes here
		
		// Login success
		console.log(data.playerID + " logged in");
		socket.emit("login.success", data);
		
		// Login fail
		// socket.emit("login.fail");
	});

    socket.on("disconnect", () => {// Bind event for that socket (player)
        console.log("Client disconnected. ID: ", socket.id);
        socket.broadcast.emit("clientdisconnect", id);
		removePlayerFromGame(socket);
		printDB();
    });
	
	socket.on("create.game", function(data) {
		// create new row in database:
		setupGame(data);
		addPlayerToGame(data,socket);
	});

	socket.on("join.game", function(data) {
		let i = addPlayerToGame(data,socket);
		
		if (i > -1) {
			if (blackID[i] && whiteID[i]) {
				// savePlayerGameList(blackID[i]);
				// savePlayerGameList(whiteID[i]);
				
				socket.emit("start.game", {
					gameID: gameID[i],
					moveHistory: moveHistory[i],
					color: data.color, // the data object was modified to include .color in addPlayerToGame()
				});
				opponentOf(socket).emit("start.game", {
					gameID: gameID[i],
					moveHistory: moveHistory[i],
					color: oppColor(data.color), // the data object was modified to include .color in addPlayerToGame()
				});
			}
		}
	});
	
	socket.on("leave.game", function() {
		removePlayerFromGame(socket);
		printDB();
	})
    


    // Event for when any player makes a move
    socket.on("make.move", function(data) {
		// console.log(data);
		
		// Validation of the moves can be done here

		// Validation passed:
		// Update the game record
		let i = socket2i(socket);
		let thisMoveHistory = getHistoryLines(data.moveHistory)
		thisMoveHistory.push(data.movetext);
		moveHistory[i] = thisMoveHistory;
		
		
		// socket.emit("move.made", data); // Emit for the player who made the move
		opponentOf(socket).emit("move.made", data); // Emit for the opponent
		
		// Save the game history to json
		let jsonData = {}
		jsonData.gameID = gameID[i];
		jsonData.gameTitle = gameTitle[i];
		jsonData.blackID = blackID[i];
		jsonData.whiteID = whiteID[i];
		jsonData.moveHistory = moveHistory[i];
		console.log(jsonData);
		let jsonText = JSON.stringify(jsonData,null,4);
		let filepath = __dirname + "/games/" + gameID[i] + ".json";
		/* fs.writeFile(filepath,jsonText,"utf8",(err) => {
			if (err) {
				console.log(err);
			} else {
				console.log('File write success');
			}
		}); */
    });


});



function setupGame(data) {
	gameID.push(data.gameID);
	gameTitle.push(data.gameTitle);
	moveHistory.push(data.moveHistory);
	blackID.push(null);
	blackSocket.push(null);
	blackSocketID.push(null);
	whiteID.push(null);
	whiteSocket.push(null);
	whiteSocketID.push(null);
}

function addPlayerToGame(data,socket) {
	let i = gameID.indexOf(data.gameID);
	
	if (i == -1) {
		/* // look for game file to restore historic game
		// console.log(data);
		let filepath = __dirname + "/games/" + data.gameID + ".json";
		try {
			const fileData = fs.readFileSync(filepath)
			const jsonData = JSON.parse(fileData)
			// Check if player is part of this game
			if (jsonData.blackID == data.playerID) {
				data.color = "b";
			} else if (jsonData.whiteID == data.playerID) {
				data.color = "w";
			} else {
				console.log("Both seats taken at this game")
				socket.emit("err.gamefull");
				return -1
			}
			// console.log(jsonData)
			console.log("Setting up old game: " + jsonData.gameID);
			setupGame(jsonData);
			
			// printDB();
			i = gameID.indexOf(jsonData.gameID);
		} catch (err) {
			console.error(err.message);
		}
		 */
		if (i == -1) {
			// no live game or historic game of that id exists
			console.log("Game ID does not exist");
			socket.emit("err.gamenotfound");
			return -1
		}

	}
	
	// Figure out which color the player wants
	let color;
	let oppID;
	if (data.color) {
		color = data.color; // color requested by input
		oppID = null;
	} else if (!blackID[i]) {
		color = "b"; // black available
		oppID = whiteID[i];
	} else if (!whiteID[i]) {
		color = "w"; // whie available
		oppID = blackID[i];
	} else {
		console.log("Both seats taken at this game")
		socket.emit("err.gamefull");
		return -1
	}
	data.color = color; 
	
	if (color == "b") {
		if (blackID[i]) {
			console.log("Black is taken at this game")
			socket.emit("err.seattaken");
			return -1
		}
		blackID[i] = data.playerID;
		blackSocket[i] = socket;
		blackSocketID[i] = socket.id;
	} else {
		if (whiteID[i]) {
			console.log("White is taken at this game")
			socket.emit("err.seattaken");
			return -1
		}
		whiteID[i] = data.playerID;
		whiteSocket[i] = socket;
		whiteSocketID[i] = socket.id;
	}
	data.moveHistory = moveHistory[i];
	data.gameTitle = gameTitle[i];

	console.log("Added " + data.playerID + " to " + data.gameID + " in color " + color);
	socket.emit("game.joined",data)
	printDB();
	return i
}

// savePlayerGameList(playerID) {
	// filepath = __dirname + "/players/" + playerID + ".json";
// }

function removePlayerFromGame(socket) {
	if (opponentOf(socket)) {
		opponentOf(socket).emit("opponent.left");
	}
	let i = whiteSocketID.indexOf(socket.id);
	
	if (i > -1) {
		console.log("Removed " + whiteID[i] + " from " + gameID[i]);
		delete whiteID[i];
		delete whiteSocket[i];
		delete whiteSocketID[i];
	} else {
		i = blackSocketID.indexOf(socket.id);
		if (i > -1) {
			console.log("Removed " + blackID[i] + " from " + gameID[i]);
			delete blackID[i];
			delete blackSocket[i];
			delete blackSocketID[i];
		}
	}
	
	/* if (i > -1) {
		if (!blackID[i] && !whiteID[i]) {
			// No players left for this game, remove row from database
			console.log("Cleaned up game " + gameID[i]);
			gameID.splice(i,1);
			gameTitle.splice(i,1);
			moveHistory.splice(i,1);
			blackID.splice(i,1);
			blackSocket.splice(i,1);
			blackSocketID.splice(i,1);
			whiteID.splice(i,1);
			whiteSocket.splice(i,1);
			whiteSocketID.splice(i,1);
		}
	} */
	
}


////////////////////////////////
// Utilities
////////////////////////////////
function socket2i(socket) {
	let i = whiteSocketID.indexOf(socket.id);
	if (i > -1) {
		return i;
	} else {
		i = blackSocketID.indexOf(socket.id);
		return i;
	}
}
function opponentOf(socket) {
	let i = whiteSocketID.indexOf(socket.id);
	if (i > -1) {
		return blackSocket[i];
	} else {
		i = blackSocketID.indexOf(socket.id);
		if (i > -1) {
			return whiteSocket[i];
		} else {
			return
		}
	}
}
function oppColor(color) {
	if (color=="w") {
		return "b";
	}
	return "w";
}
function getHistoryLines(historyText) {
	// ingest historyText in various formats and return a reliable format - an array of trimmed lines
	if (historyText.length == 0) {
		return [];
	}
	if (typeof historyText == "object") {
		historyText = historyText.join("\r\n");
	}
	
	const splitOn = (slicable, ...indices) =>
		[0, ...indices].map((n, i, m) => slicable.slice(n, m[i + 1]).trim());
	
	historyText = historyText.replaceAll("\r","");
	historyText = historyText.replaceAll("\n","");
	var matches = historyText.match(/(\d+[bw]\.)/g)
	if (matches == null) {
		return [];
	}
	var idxs = [];
	for (i=0; i<matches.length; i++) {
	  idxs.push(historyText.indexOf(matches[i]));
	}
	var historyLines = splitOn(historyText,...idxs);
	historyLines = historyLines.filter((str) => str.length > 0)
	return historyLines
}
function printDB() {
	console.log("gameID:");
	console.log(gameID);
	console.log("gameTitle:");
	console.log(gameTitle);
	console.log("blackID:");
	console.log(blackID);
	console.log("whiteID:");
	console.log(whiteID);
	console.log("moveHistory:");
	console.log(moveHistory);
}
