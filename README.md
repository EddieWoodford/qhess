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

1. Open the menu (☰, top left) and the **Multiplayer** tab (🌐).
2. Choose White, Black or Random, and press **Create game**. You get a code like `TIGER-42`.
3. Your friend can join in any of three ways:
   - **The code**: read it out or send it. They open the game from the server's address, go to the
     Multiplayer tab, type the code (case and spacing don't matter) and press **Join**.
   - **The link**: **Copy link** (or **Share…** on a phone) and send it. Opening it joins the game.
   - **The QR code**: they scan it with their phone's camera, which opens the link.

   On a page opened as `localhost` (start.bat), the link and QR code use this computer's network
   address instead, which the server gives the page (`/network-address`).

Your own side is always at the bottom of the board. The board is locked while it's your
opponent's turn. The line above the prompt shows the code, your colour, and any connection
problem.

If a connection drops (Wi-Fi blip, laptop lid closed, page reloaded), the page reconnects by
itself and catches up; the other player sees "opponent disconnected" until it's back. A move
made while disconnected is sent once the connection returns, and is never played twice.
**Leave game** ends the game for both players. Games are only kept while the server is
running: stopping it ends them.

The server has no accounts, and anyone with a code can join a game that is still waiting for
its second player.

## Online

The page is hosted on GitHub Pages, and the multiplayer server on Render
(https://qhess.onrender.com). Both update by themselves when `main` is pushed to GitHub.

- Single player runs entirely in the browser, so it works straight away.
- A page opened from GitHub Pages uses the Render server for multiplayer
  (`src/client/server-address.js`), and wakes it as soon as the page loads. Render's free
  server sleeps after about 15 minutes unused and takes up to a minute to start; until it
  has, the Multiplayer tab says the server is starting. Games in progress are lost when it
  sleeps or restarts.
- `.nojekyll` tells GitHub Pages to serve the files as they are.

## How it fits together

```
src/engine/    the rules: pure JavaScript, no page code. Used by the page AND the server.
src/client/    the page. controller.js runs the click flow; *-view.js draw it.
               session.js       LocalSession: a game played on this screen
               socket-session.js SocketSession: a game played through the server
               server-address.js which server multiplayer uses
               join-link.js     join links and their QR codes (vendor/qrcode.js draws them)
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
- the rules the example games don't reach: en passant, promotion, potential check, castling,
  checkmate and stalemate, and moves that aren't moves at all (as a network or a pasted
  history could send)
- the army collapse, checked against trying every assignment by brute force
- reading the move history, including text typed or pasted by hand
- the same games played through the real server by two scripted players, one colour each
- the multiplayer edge cases: out-of-turn and illegal moves, bad codes, a full game, dropped
  connections, resent moves, a second tab taking over a seat, leaving, and abandoned games
- the page's SocketSession against the real server, including reconnects and lost messages
- join links: made, read back from the address, and their QR codes read with a real QR reader

`start_test.bat` opens the browser test page (press **Run tests**). It replays the example
games through the real page and checks what it shows, and has two copies of the page play a
multiplayer game against each other, with one reloading part-way through. It also checks a game
with the Potential Check switch off, reloading a saved game, and that Edit / Import refuses moves
that can't be played without losing the game. It starts the game page with the Settings tab's switches at
their defaults, which also resets any your browser had remembered for that server.

`serve.ps1` is the old PowerShell file server. It still works for single player without
Node.js, but not for multiplayer.
