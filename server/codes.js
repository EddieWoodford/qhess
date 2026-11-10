// Join codes: a short, distinct word and two digits, e.g. "TIGER-42" (see src/shared/protocol.js normalizeCode).
// Words are picked to be easy to say and spell, and not easily confused with each other.

const WORDS = [
	"APPLE", "ARROW", "BADGE", "BEACH", "BEAR", "BELL", "BIRCH", "BLAZE", "BOAT", "BRICK",
	"CABIN", "CAMEL", "CANDY", "CEDAR", "CHALK", "CLOUD", "COMET", "CORAL", "CRANE", "DAISY",
	"DELTA", "DRUM", "EAGLE", "EMBER", "FERN", "FLAME", "FORGE", "FROST", "GHOST", "GLOBE",
	"GRAPE", "HAWK", "HONEY", "IGLOO", "IVORY", "JADE", "JELLY", "KAYAK", "KITE", "KOALA",
	"LEMON", "LILAC", "LLAMA", "LOTUS", "MANGO", "MAPLE", "MARS", "MOOSE", "NOVA", "OCEAN",
	"OLIVE", "OPAL", "ORBIT", "OTTER", "PANDA", "PEARL", "PIANO", "PILOT", "PLUM", "POLAR",
	"QUAIL", "RADAR", "RAVEN", "RIVER", "ROBIN", "ROCKET", "SALSA", "SHELL", "SOLAR", "SPARK",
	"STORM", "SUGAR", "TIGER", "TOAST", "TULIP", "VELVET", "VIOLA", "WAFFLE", "WALRUS", "WHALE",
	"YETI", "ZEBRA",
];

// A random code (the caller checks it isn't already in use)
function randomCode(random = Math.random) {
	const word = WORDS[Math.floor(random() * WORDS.length)];
	const number = 10 + Math.floor(random() * 90);
	return word + "-" + number;
}

export { WORDS, randomCode };
