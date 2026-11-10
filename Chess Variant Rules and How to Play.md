# Chess Variant: Rules and How to Play

*A player's guide to chess with undecided pieces*

## The idea in one minute

The game is played on a normal chessboard with the normal starting squares, but **nobody knows what any piece is**. Each of your 16 pieces starts as a "wave": a cloud of everything it could still turn out to be (king, queen, rook, bishop, knight or pawn). A piece may make any move that **at least one** of its remaining possibilities could make. Once you choose a move, every possibility that could *not* have made that move is ruled out. That is called **collapsing**.

Pieces also constrain each other. You only have one queen, two rooks, eight pawns and so on, so as some pieces are pinned down, others lose possibilities too. Nothing is secret: both players can always see every piece's remaining possibilities. The identities are not hidden, they are genuinely undecided until moves, captures and the army-size limits force them.

**Goal:** checkmate the opponent's king, as in ordinary chess. Because the king is itself undecided, there are two kinds of check (see "Check" below).

## Setup

- The board and starting squares are the same as chess. Squares are named as usual: files a to h from left to right, ranks 1 to 8 from White's side. White starts on ranks 1 and 2 and moves up the board; Black starts on ranks 7 and 8 and moves down.
- Each side owns the usual army: **8 pawns, 2 rooks, 2 knights, 1 dark-squared bishop, 1 light-squared bishop, 1 queen and 1 king.** But which of your 16 pieces is which has not been decided.
- Bishops stay on their colour. A piece that starts on a light square can never be the dark-squared bishop, and vice versa.
- White makes the first real move, but Black gets a preliminary "Move 0" (see below).

## Reading the board

Each piece shows a small grid of the types it could still be:

- Top row: **K Q R**
- Bottom row: **B N P**

A blank slot means that type has been ruled out. When only one possibility is left, the piece is drawn as a single large symbol, which means it has fully collapsed. Each piece type has its own colour, and the symbols differ for the two sides. (To colour each side's pieces in a single colour instead, switch off **Colour pieces by type** in the menu's Settings tab.)

Other things on screen:

- **Hover** over one of your pieces to preview every square it could move to, using all of its remaining possibilities combined.
- **Find buttons (K, Q, R, N, B, P)** highlight every piece on the board that could still be that type. Click the same button again to turn the highlight off.
- **Captured lists** ("White Captured" and "Black Captured") show each captured piece with the turn it was taken and the possibilities it still has. Captured pieces are often never fully revealed.
- **Flip board** turns the board around.

## The army-size rule (how pieces collapse each other)

At all times, each side's 16 pieces, **including captured ones**, must be able to form a complete, legal army. The game continually removes any possibility that could not be part of such an army. For example:

- Once one of your pieces is pinned down to being the queen, none of your other pieces can be the queen.
- Once two of your pieces are known to be rooks, no other piece of yours can be a rook.
- If only two of your pieces could still possibly be knights, then those two *must* be your knights, and everything else they could have been disappears.
- A piece that has ever moved more than one square (or in a knight's hop) can no longer be the king, which steadily shrinks the list of king candidates.

These collapses happen automatically after every move, capture, and check declaration, and they can affect pieces far from the action.

## Taking a turn

1. **Click one of your pieces.** Its possible destinations are highlighted.
2. **Click a destination.** The move is shown on the board but is not final yet. The piece's possibilities are narrowed to the ones that could make that move, and any knock-on collapses are applied.
3. **Optional:** if you can attack a piece that might be the enemy king, an **Add PC** button appears so you can declare a Potential Check (see below).
4. Press **Submit** to end your turn.

If you change your mind before submitting, click off to deselect. If a move is illegal because it leaves you in check, the prompt says "Invalid - moved into check" and you press **Cancel**, which undoes that unsubmitted move.

### How each possibility moves

- **King:** one square in any direction, onto an empty square or an enemy piece. There is no castling.
- **Queen:** any distance in a straight line or diagonal, stopping at the first piece it meets (it may capture an enemy piece there, but cannot pass through anything).
- **Rook:** any distance along ranks and files, same blocking rules.
- **Bishop:** any distance diagonally, same blocking rules.
- **Knight:** the usual L-shaped jump, landing on an empty square or an enemy piece.
- **Pawn:** one square forward onto an empty square; two squares forward if the piece has not moved yet and both squares ahead are empty; one square diagonally forward only to capture (or to take en passant). Any unmoved piece that could still be a pawn can use the two-square advance, including a back-rank piece once the square in front of it is empty.

A piece can use **any** move from **any** of its remaining possibilities. For instance, a piece that could still be a queen, rook or pawn may slide up a file like a rook, or step forward like a pawn.

### Example: White's first move

On White's first move, the piece on e2 could be anything, so it can go to many squares. Suppose you play it to e4. Only a queen, a rook or a pawn (using its two-square first move) could make that jump, so the piece collapses from all six types down to Q, R and P. The move would appear in the history as:

`1w. (KQBNRP)e2e4(QRP)`

## Captures

You capture by moving onto an enemy piece, if one of your piece's remaining possibilities could make that capture. Pawns capture diagonally only.

A captured piece is removed from the board and listed in the captured area, with the possibilities it still had. **Kings are never captured**, so capturing a piece also proves it was *not* the king (the king possibility is removed from it). That can force the king onto another piece. A captured piece still counts toward the army-size rule.

## Special moves

### En passant

When a piece that could be a pawn advances two squares, the square it skipped becomes an en passant square for the opponent's very next turn. An enemy piece that could be a pawn may move diagonally onto that square.

- If the capturing piece could *only* be a pawn, the capture is made.
- If it could be other things too, the game asks **"En passant?"**. Choose yes and the capturing piece collapses to a pawn and captures the skipped piece, which also collapses to a pawn. Choose no and the piece simply lands on the square as a non-pawn (its pawn possibility is removed) and nothing is captured.

### Promotion

When a piece that could be a pawn reaches the far rank:

- If it could only be a pawn, it promotes automatically.
- If it could be other things too, the game asks **"Promote Pawn?"**. Choose yes and it collapses to a pawn and promotes. Choose no and its pawn possibility is removed.

A newly promoted piece is itself undecided: it shows as Q, R, B or N (written `=(QRNB)` in the history) and narrows as it moves. Promoted pieces are not limited by the normal army sizes, so you may end up with several queens, but a promoted piece still counts as one of your eight pawns for the army-size rule.

## Check

There are two kinds of check, depending on whether the king has been pinned down yet.

### Moving into check is never allowed

You may not end your turn leaving your own king in check, whichever kind it is. The game will show "Invalid - moved into check" and you must cancel and choose something else.

### Automatic check

When your king has collapsed to a single piece (that piece can only be a king), it is in **automatic check** if any enemy piece could attack it, meaning at least one of that enemy piece's remaining possibilities could capture on the king's square. The prompt shows "Check" and the king and its attackers are outlined. On your turn you must make a move after which no enemy piece could attack the king. Moves that give automatic check are marked with `+`.

### Potential check

While the king could still be several different pieces, you can attack one of them. This is a **Potential Check (PC)**. Declaring one works like this:

1. Make your move as normal, but do not submit yet. If any enemy piece that could still be the king is under attack by one of your pieces, press **Add PC**.
2. Click the enemy piece you are attacking (the candidates are highlighted).
3. Click each of your pieces that is attacking it. If only one of your pieces can attack, it is chosen for you. Each chosen attacker **collapses** to the possibilities that really can attack that square, so you commit your own pieces too.
4. Press **Submit**. If choosing your attackers would collapse one of your own pieces into a king that is itself in check, the move is invalid.

On the defender's turn the prompt shows "Potential Check", and the defender must deal with it before ending the turn. There are three ways:

- **Declare 'Not a King':** press that button. The threatened piece permanently loses its king possibility. This is allowed, but it costs something: with one fewer king candidate, the king may be forced onto another piece, which could already be under attack. The declaration appears in the history in square brackets, and then you still make a normal move.
- **End the threat with a move:** capture an attacker, block the line, or otherwise leave the declared piece no longer certainly attacked.
- **Move the threatened piece away:** if it moves in a way a king could not, it also stops being a possible king.

If the potential check is still standing after your move, the move is invalid.

Potential check is how you squeeze the opponent's king: every time they decline to run, they lose king candidates, until the king collapses onto one piece and automatic check takes over.

## Move 0

Black has a preliminary turn called **Move 0**. Black cannot move a piece. Black may press **Add PC** to declare a Potential Check against one of White's pieces, or may simply press **Pass to white**. White's first move is then move 1.

**Learning without Potential Check:** switching off **Potential Check** in the menu's Settings tab leaves Potential Check out of the game. The **Add PC** button never appears, and Black's Move 0 is passed automatically. It is easier to start learning this way. Multiplayer games always use Potential Check.

## Winning and ending the game

You win by **checkmate**: your opponent is in check (automatic or potential) and has no move or declaration that gets out of it. The program does not detect checkmate, stalemate or draws for you, so the players decide together when the game is over and agree in advance how to handle draws.

## Move history, replay and saving

Every submitted move is added to the move history, one line per side per turn. Reading a line:

- `1w.` or `1b.`: the turn number and whose move it is.
- `(KQBNRP)e2e4(QRP)`: the piece's possibilities before the move, the start square, the destination, and its possibilities after the move.
- `x` between the squares: a capture (for example `e2xe7`).
- `+` after the move: automatic check was given.
- `<e8+ d1 h5>`: a Potential Check was declared. The first square is the potential king; the rest are the attackers.
- `[e8]`: the player declared that piece "Not a King" at the start of their turn.
- `e.p.`: an en passant capture.
- `=(QRNB)`: a promotion.

Tools for the history:

- **Step back and forward** through the game with the replay buttons. While replaying, the board is view-only.
- **Resume from here** continues the game from the position you are viewing. Later moves are discarded.
- **Copy and paste** the full history, copy just the last move, or paste a history to restore a game. You can also paste a single move line to add it to the current game, which makes it easy to play by message.

## Quick reference: buttons and prompts

- **Add PC:** declare a Potential Check (after making a move, or at Move 0).
- **Declare 'Not a King':** shown when you are in potential check.
- **Submit:** end your turn.
- **Pass to white:** end Black's Move 0.
- **Cancel:** shown when your move was invalid. It undoes the unsubmitted move.
- **Resume from here:** shown while replaying.
