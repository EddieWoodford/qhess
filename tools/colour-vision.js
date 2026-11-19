"use strict";

// Colour vision deficiency ("colour blindness") for tools/theme-generator.html: how a colour looks to someone with
// each of the three standard types, and how far apart two colours look.
// A classic script (so the generator still works opened from file://), putting ColourVision on globalThis; the
// Node tests import it the same way (tests/node/colour-vision.test.js).
//
// The simulation is Machado, Oliveira & Fernandes (2009) at full severity, applied in linear RGB, as browsers'
// developer tools emulate it. Full severity (dichromacy) is the strongest form of each type, so colours that stay
// apart for it also stay apart for the milder, more common forms (protanomaly, deuteranomaly, tritanomaly).

(function () {
	const KINDS = [
		{ id: "protanopia", name: "Protanopia", note: "no red cones: reds look dark, red and green alike (about 1% of men)" },
		{ id: "deuteranopia", name: "Deuteranopia", note: "no green cones: red and green alike (about 1% of men; the milder form about 5%)" },
		{ id: "tritanopia", name: "Tritanopia", note: "no blue cones: blue and green alike, yellow and pink alike (rare)" },
	];

	// Row-major 3 x 3 matrices on linear RGB
	const MATRICES = {
		protanopia: [
			0.152286, 1.052583, -0.204868,
			0.114503, 0.786281, 0.099216,
			-0.003882, -0.048116, 1.051998,
		],
		deuteranopia: [
			0.367322, 0.860646, -0.227968,
			0.280085, 0.672501, 0.047413,
			-0.011820, 0.042940, 0.968881,
		],
		tritanopia: [
			1.255528, -0.076749, -0.178779,
			-0.078411, 0.930809, 0.147602,
			0.004733, 0.691367, 0.303900,
		],
	};

	const clamp01 = v => Math.min(1, Math.max(0, v));
	const toLinear = v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
	const toSrgb = v => v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;

	function linearRgb(hex) {
		const h = hex.replace("#", "");
		return [0, 2, 4].map(i => toLinear(parseInt(h.slice(i, i + 2), 16) / 255));
	}

	function hexFromLinear(rgb) {
		return "#" + rgb.map(v => Math.round(toSrgb(clamp01(v)) * 255).toString(16).padStart(2, "0")).join("");
	}

	// The generator asks about the same colours many times over: remember the answers (by colour, then kind)
	const memo = fn => {
		const cache = new Map();
		return (hex, kind = "") => {
			const key = kind + hex;
			let value = cache.get(key);
			if (value === undefined) {
				if (cache.size > 100000) { cache.clear(); }
				value = fn(hex, kind);
				cache.set(key, value);
			}
			return value;
		};
	};

	// How the colour (#rrggbb) looks with this kind (an id from KINDS), as #rrggbb. Any other kind: unchanged.
	const simulate = memo((hex, kind) => {
		const m = MATRICES[kind];
		if (!m) { return hex; }
		const [r, g, b] = linearRgb(hex);
		return hexFromLinear([
			m[0] * r + m[1] * g + m[2] * b,
			m[3] * r + m[4] * g + m[5] * b,
			m[6] * r + m[7] * g + m[8] * b,
		]);
	});

	// OKLab (Björn Ottosson, 2020): a colour space where distance matches how different colours look
	const oklab = memo(hex => {
		const [r, g, b] = linearRgb(hex);
		const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
		const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
		const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
		return [
			0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
			1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
			0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
		];
	});

	// How different two colours look, on a 0-100 scale: about 2 is just noticeable, 10 clearly different
	function deltaE(a, b) {
		const p = oklab(a), q = oklab(b);
		return 100 * Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
	}

	// The matrix as an SVG feColorMatrix's values (4 x 5, row-major), for showing a whole page as this kind sees it
	function svgMatrix(kind) {
		const m = MATRICES[kind];
		return [0, 3, 6].map(i => [m[i], m[i + 1], m[i + 2], 0, 0].join(" ")).join("  ") + "  0 0 0 1 0";
	}

	globalThis.ColourVision = { KINDS, MATRICES, simulate, deltaE, svgMatrix };
})();
