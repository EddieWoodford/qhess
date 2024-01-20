const http = require("http")
const express = require("express");
const app = express();
const socketIo = require("socket.io");
const fs = require("fs");

const server = http.Server(app).listen(8080);
const io = socketIo(server);


// Serve static resources
// app.use(express.static(__dirname + "/../client/"));
// app.use(express.static(__dirname + "/../node_modules/"));

app.use(express.static(__dirname + "/"));
app.use(express.static(__dirname + "/node_modules/"));

app.get("/", (req, res) => {
    const stream = fs.createReadStream(__dirname + "/index.html");
    stream.pipe(res);
});



// These arrays are all the same length and can be thought of as columns in a database, 1 row per game
var gameID = []; // array of gameID
var movehistory = []; // array of move historys
var blackID = []; // black player ID
var blackSocket = []; // black socket
var blackSocketID = []; // black socket.id
var whiteID = []; // white ID
var whiteSocket = []; // white socket
var whiteSocketID = []; // white socket.id




// When a client connects
io.on("connection", function(socket) {
    let id = socket.id;

    console.log("New client connected. ID: ", socket.id);

    socket.on("disconnect", () => {// Bind event for that socket (player)
        console.log("Client disconnected. ID: ", socket.id);
        socket.broadcast.emit("clientdisconnect", id);
		removePlayerFromGame(socket);
		printDB();
    });
	
	socket.on("create.game", function(data) {
		// create new row in database:
		gameID.push(data.gameID);
		movehistory.push(data.movehistory);
		blackID.push(null);
		blackSocket.push(null);
		blackSocketID.push(null);
		whiteID.push(null);
		whiteSocket.push(null);
		whiteSocketID.push(null);
		
		addPlayerToGame(data,socket);
	});

	socket.on("join.game", function(data) {
		let i = addPlayerToGame(data,socket);
		
		if (i > -1) {
			socket.emit("start.game", {
				gameID: gameID[i],
				movehistory: movehistory[i],
				color: data.color, // the data object was modified to include .color in addPlayerToGame()
			});
			opponentOf(socket).emit("start.game", {
				gameID: gameID[i],
				movehistory: movehistory[i],
				color: oppColor(data.color), // the data object was modified to include .color in addPlayerToGame()
			});
		}
	});
	
	socket.on("leave.game", function() {
		removePlayerFromGame(socket);
		printDB();
	})
    


    // Event for when any player makes a move
    socket.on("make.move", function(data) {
		console.log(data);
		
		// Validation of the moves can be done here

		// socket.emit("move.made", data); // Emit for the player who made the move
		opponentOf(socket).emit("move.made", data); // Emit for the opponent
        
		
		// Update the game record
		let i = socket2i(socket);
		let jsonData = {}
		jsonData.gameID = gameID[i];
		jsonData.blackID = blackID[i];
		jsonData.whiteID = whiteID[i];
		let movehistory = data.movehistory.split("\r\n")
		movehistory.push(data.movetext);
		jsonData.movehistory = movehistory;
		console.log(jsonData);
		let jsonText = JSON.stringify(jsonData,null,4);
		fs.writeFile(__dirname + "/games/test.json",jsonText,"utf8",(err) => {
			if (err) {
				console.log(err);
			} else {
				console.log('File write success');
			}
		});
    });


});

function printDB() {
	console.log("gameID:");
	console.log(gameID);
	console.log("blackID:");
	console.log(blackID);
	console.log("whiteID:");
	console.log(whiteID);
}


function addPlayerToGame(data,socket) {
	let i = gameID.indexOf(data.gameID)
	if (i == -1) {
		// look for game file to restore historic game
		
		
		// no live game or historic game of that id exists
		console.log("Game ID does not exist");
		socket.emit("game.notfound");
		return -1
	}
	
	// Figure out which color the player wants
	let color;
	if (data.color) {
		color = data.color; // color requested by input
	} else if (!blackID[i]) {
		color = "b"; // black available
	} else if (!whiteID[i]) {
		color = "w"; // white available
	} else {
		console.log("Both seats taken at this game")
		socket.emit("game.full");
		return -1
	}
	data.color = color; 
	
	if (color == "b") {
		if (blackID[i]) {
			console.log("Black is taken at this game")
			socket.emit("seat.taken");
			return -1
		}
		blackID[i] = data.playerID;
		blackSocket[i] = socket;
		blackSocketID[i] = socket.id;
	} else {
		if (whiteID[i]) {
			console.log("White is taken at this game")
			socket.emit("seat.taken");
			return -1
		}
		whiteID[i] = data.playerID;
		whiteSocket[i] = socket;
		whiteSocketID[i] = socket.id;
	}

	console.log("Added " + data.playerID + " to " + data.gameID + " in color" + color);
	printDB();
	return i
}



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
	
	
	if (!blackID[i] && !whiteID[i]) {
		// No players left for this game, remove row from database
		console.log("Cleaned up game " + gameID[i]);
		gameID.splice(i,1);
		movehistory.splice(i,1);
		blackID.splice(i,1);
		blackSocket.splice(i,1);
		blackSocketID.splice(i,1);
		whiteID.splice(i,1);
		whiteSocket.splice(i,1);
		whiteSocketID.splice(i,1);
	}
	
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

