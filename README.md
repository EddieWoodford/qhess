# Qhess: Quantum Chess

Quantum Chess is the idea that every piece on the chess board, initially, could
become any piece - they are in superposition. As pieces are moved, their
options collapse, so by the end of the game, each player has a normal
demographic of pieces. Further reading: http://wiki.thorx.net/wiki/QuantumChess

The rules are in [Chess Variant Rules and How to Play.md](Chess%20Variant%20Rules%20and%20How%20to%20Play.md).

## Running it

You need [Node.js](https://nodejs.org/) 20 or later (`winget install OpenJS.NodeJS.LTS` on Windows).

Double-click `start.bat`, or run:

```
npm install
npm start
```

This starts the Qhess server and opens the game at http://localhost:8000/. The window
also prints an "On your network" address that other devices on the same network can open.

Single player (both sides on one screen) is the default and needs nothing else.

## Playing a friend (multiplayer)

1. Open the side panel (📜) and the **Multiplayer** tab.
2. Choose White, Black or Random, and press **Create game**. You get a code like `TIGER-42`.
3. Send the code to your friend. They open the game from the server's address, go to the
   Multiplayer tab, type the code (case and spacing don't matter) and press **Join**.

Your own side is always at the bottom of the board. The board is locked while it's your
opponent's turn. The line above the prompt shows the code, your colour, and any connection
problem.

If a connection drops (Wi-Fi blip, laptop lid closed, page reloaded), the page reconnects by
itself and catches up; the other player sees "opponent disconnected" until it's back. A move
made while disconnected is sent once the connection returns, and is never played twice.
**Leave game** ends the game for both players. Games are only kept while the server is
running: stopping it ends them.

For a friend outside your network, the server would need to be reachable from the internet
(for example hosted somewhere, or through a tunnel). It has no accounts, and anyone with a
code can join a game that is still waiting for its second player.

## How it fits together

```
src/engine/    the rules: pure JavaScript, no page code. Used by the page AND the server.
src/client/    the page. controller.js runs the click flow; *-view.js draw it.
               session.js       LocalSession: a game played on this screen
               socket-session.js SocketSession: a game played through the server
src/shared/    protocol.js: the messages between page and server
server/        server.js: serves the files and the websocket (/ws)
               rooms.js:  the referee. Checks every move with the engine.
               store.js:  where games are kept (in memory)
               codes.js:  join codes
```

Only moves cross the network, never game states. The server replays each accepted move with
the same engine and sends it to both players, along with a fingerprint of the resulting
position so a page whose copy has drifted can ask for the whole game again.

### Adding a database

Everything the server keeps about a game is a plain JSON record (its code, the two seats'
tokens and the list of moves), and it is only stored through `server/store.js`. To keep games
across restarts, write another class with the same four async methods (`get`, `save`,
`delete`, `has`) backed by a database, and pass it in: `new GameServer({ store })` (or
`startServer({ store })`). The server already rebuilds a game from its moves when it isn't
in memory.

## Tests

```
npm test
```

runs the command-line tests:

- every example game in `example_games/` replayed through the engine, checked against
  `tests/snapshots.json` after every move
- the same games played through the real server by two scripted players, one colour each
- the multiplayer edge cases: out-of-turn and illegal moves, bad codes, a full game, dropped
  connections, resent moves, a second tab taking over a seat, leaving, and abandoned games
- the page's SocketSession against the real server, including reconnects and lost messages

`start_test.bat` opens the browser test page (press **Run tests**). It replays the example
games through the real page and checks what it shows, and has two copies of the page play a
multiplayer game against each other, with one reloading part-way through.

`serve.ps1` is the old PowerShell file server. It still works for single player without
Node.js, but not for multiplayer.
