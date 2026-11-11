// Where games are kept. For now only in memory: games are lost when the server stops.
//
// A game record is plain JSON, so a database can be swapped in later by writing another class with the same
// async methods (e.g. a SqliteGameStore or RedisGameStore) and passing it to new GameServer({ store }):
//   {
//     code:      "TIGER-42"
//     createdAt, updatedAt:   milliseconds since 1970
//     seats:     { w: { token } | null, b: { token } | null }   who holds each colour
//     joinedColor: "w" | "b" | null   the seat the second player joined (rooms.js retakableSeat)
//     moves:     [ move, ... ]   every accepted move, in order (see src/shared/protocol.js)
//   }
// The game position is never stored: it is rebuilt by replaying the moves through the engine.

class MemoryGameStore {
	constructor() {
		this.games = new Map();
	}

	async get(code) {
		const record = this.games.get(code);
		return record ? structuredClone(record) : null;
	}

	async save(record) {
		this.games.set(record.code, structuredClone(record));
	}

	async delete(code) {
		this.games.delete(code);
	}

	async has(code) {
		return this.games.has(code);
	}
}

export { MemoryGameStore };
