# Qhess: Rules and How to Play

Qhess is chess where you don't know which piece is which. At the start, every piece could be
any piece. Each time a piece moves, the types that couldn't have made that move are ruled out.
By the end of the game, each side's pieces have settled into a normal chess army.

Everything not covered here works as in ordinary chess.

<!-- The game page shows these rules too (the Rules button in the Info tab): the rules modal in
     index.html has the same text. Change both together. -->

## 1. The pieces

Each side has 16 pieces, set up on the usual two ranks. Every piece starts out able to be any of
the six types: **K**ing, **Q**ueen, **B**ishop, k**N**ight, **R**ook or **P**awn. Each piece on
the board shows the letters of the types it could still be.

There is one exception from the start: a piece can only be the bishop for the colour of square
it starts on. Each side has one dark-squared and one light-squared bishop.

### The army must always add up

Each side must always be able to be shared out as a normal army: 8 pawns, 2 rooks, 2 knights,
a dark-squared bishop, a light-squared bishop, 1 queen and 1 king. Captured pieces still count
towards this.

So ruling out one piece's types can settle others. If the queen is known to be one particular
piece, no other piece can be the queen. If only one piece is left that could be the king, it
*is* the king. The game works all of this out for you after every move.

## 2. Moving

On your turn, move one of your pieces to any square that **at least one** of its possible types
could reach, using that type's normal moves (blocked by pieces in the way, as usual).

Afterwards, the piece keeps only the types that could have made that move. For example, a
piece that could be anything and moves one square diagonally forward onto an empty square
could be a king, queen or bishop, but not a rook, knight or pawn.

Some things to know about how each type moves:

- **Pawns** move forward one square onto an empty square, or two on their first move if both
  squares are empty. They capture one square diagonally forward. Since any piece might be a
  pawn, this applies to pieces on the back rank too: an unmoved back-rank piece can step two
  squares forward as a pawn.
- **Knights** jump, as usual. Since any piece might be a knight, any piece can jump out from
  behind its own pawns on the first move.
- **Bishops** stay on their own colour of square. A piece that moves onto a square of the
  other colour can't be a bishop any more.

### Capturing

You capture by moving onto an opponent's piece, as in chess. **You can never capture the
king**: a piece that is captured is shown not to have been the king, so it loses its K.
(Capturing it may therefore tell you which piece *is* the king.) A piece that is certainly
the king can't be captured, because the check rules stop that happening.

## 3. Choices during a move

Sometimes a move could mean two different things. When it does, the game asks you which you
meant:

- **En passant.** When a piece that could be a pawn moves two squares forward, an opponent's
  piece that could be a pawn may capture it en passant on the very next move, as in chess. If
  the capturing piece could also be something else, you're asked "En passant?". Saying yes
  makes both pieces pawns and removes the captured one. Saying no means the moving piece is
  not a pawn, and it just moves to the empty square.
- **Promotion.** When a piece that could be a pawn reaches the far rank, you're asked "Promote
  Pawn?" (unless it can only be a pawn, when it promotes anyway). Saying yes shows it was a
  pawn, and it becomes a new piece that could be a queen, rook, knight or bishop (a bishop of
  the colour of square it promoted on). Like any piece, its possible types narrow down as it
  moves. Saying no means it was not a pawn.
- **Castling.** See below. If a move could be either a castle or an ordinary move, you're
  asked "Castle?".

## 4. Castling

A piece that could be the king and has never moved can castle:

- It moves two squares sideways along its rank. The square it passes over and the square it
  lands on must be empty.
- The rook is the first piece beyond where the king lands, either right next to that square or
  one further along with an empty square between (like queenside castling in chess). It must
  be the same colour, never have moved, and be able to be a rook. It jumps to the square the
  king passed over.
- Castling makes the one piece the king and the other a rook. That must still leave a complete
  army (section 1).
- You can't castle out of check, through check, or into check, judged as though the piece
  were already the king.

Because any piece could be the king, castling isn't tied to the usual squares: any pair of
unmoved pieces with the right space between them can castle, on either of a side's two
starting ranks.

## 5. Check

There are two kinds of check.

### Check (when the king is known)

Once a side's king is known (only one piece left that could be the king), the normal check
rule applies, made stricter by the uncertainty: **the king is in check if any opponent piece
could capture it as any of its possible types.** A piece that might be a rook counts as
attacking along its rook lines, even if it might turn out to be a knight.

You must never end your move with your known king in check. If your king is in check, your
move must get it out.

### Potential check (when the king is not yet known)

While the king could still be one of several pieces, you can't simply be in check. Instead,
the attacker can **declare a potential check**:

1. After making your move, press **Add Potential Check**.
2. Choose an opponent piece that could be the king and that one of your pieces could capture.
3. Choose one or more of your pieces that could capture it. Each of those attackers keeps
   only the types that could make that capture. (This must not leave your own king in check.)
4. Submit.

On their next turn, the defender must deal with it in one of these ways:

- **Make a move that ends the threat**, as with any check: move the threatened piece out of the
  way, block the attack, or capture the attacker. The threat is over when no attacker could
  still certainly capture the threatened piece.
- **Declare "Not a King"** on the threatened piece. It is then shown not to be the king, and the
  defender must still make a move afterwards. Ruling it out may show that another piece is the
  king, and if that king is in check, the move must get it out of check. You can't declare
  "Not a King" on a piece that must be the king.

A potential check lasts for that one reply only. Then it is gone.

### Black's move 0

White makes the first move. Before that, Black has a **move 0**: Black doesn't move a piece,
but may declare a potential check (for example, a piece on Black's second rank that might be a
rook or queen attacking straight down the open file). Otherwise Black just presses **Pass to
white**.

## 6. How the game ends

The game ends when the side to move has no legal turn: no move that leaves their king out of
check (counting declaring "Not a King" first, when they are in potential check).

- **Checkmate**: they are in check or in potential check. The other side wins.
- **Stalemate**: they are not in check. The game is drawn.

The board then locks. There are no other draw rules (no 50-move rule or repetition).

## 7. Learning mode

The **Potential Check** switch in the Settings tab can be turned off while learning. You then
can't declare potential checks, and Black's move 0 is skipped. Multiplayer games always use
potential check.

## 8. Reading the move history

Each line of the History tab is one move, for example:

```
12w. [d2](KQRP)e2xe4(QR)+<e8+ e4 h5>
```

| Part | Meaning |
|---|---|
| `12w.` | Move number and side (`w` White, `b` Black) |
| `[d2]` | "Not a King" declared on the piece on d2 |
| `(KQRP)e2` | The piece's possible types before moving, and where it started |
| `x` | A capture |
| `e4(QR)` | Where it landed, and its possible types afterwards |
| `=(QRNB)` | Promotion |
| `e.p.` | En passant |
| `O-O` / `O-O-O` | Castled towards the h-file / the a-file |
| `+` | Check |
| `<e8+ e4 h5>` | Potential check on the piece on e8, by the pieces on e4 and h5 |
