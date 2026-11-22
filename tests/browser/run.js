// Runs the browser regression tests (tests/test.html) headless, for CI and `npm run test:browser`: starts the
// Qhess server on a free port, opens the page in Chromium (Playwright), presses Run tests and waits for the
// result. Prints each test that didn't pass, and exits with 1 if any didn't (or the page threw).

import { chromium } from "playwright";
import { startServer } from "../../server/server.js";

const TIMEOUT_MS = 5 * 60 * 1000;

const server = await startServer({ port: 0, host: "127.0.0.1" });
const browser = await chromium.launch();
let failed = true;
try {
	const page = await browser.newPage();
	/** @type {string[]} */
	const pageErrors = [];
	page.on("pageerror", err => pageErrors.push(err.message));
	await page.goto("http://127.0.0.1:" + server.port + "/tests/test.html");
	await page.click("#run");
	await page.waitForFunction(() => "testResults" in window, null, { timeout: TIMEOUT_MS });
	const { passed, total } = await page.evaluate(() => /** @type {any} */ (window).testResults);
	// The rows of the results table that didn't pass (each row: name, plies, result, details)
	const problems = await page.$$eval("tr", rows => rows.slice(1)
		.map(row => [...row.querySelectorAll("td")].map(td => (td.textContent ?? "").trim()))
		.filter(cells => cells[2] != "PASS")
		.map(cells => cells.join(" | ")));
	for (const problem of problems) { console.log("FAIL  " + problem); }
	for (const message of pageErrors) { console.log("PAGE ERROR  " + message); }
	console.log(passed + " / " + total + " browser tests passed");
	failed = passed !== total || pageErrors.length > 0;
} finally {
	await browser.close();
	await server.close();
}
process.exit(failed ? 1 : 0);
