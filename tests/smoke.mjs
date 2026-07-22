import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");

const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {})
});
const context = await browser.newContext({ ...devices["iPhone 13"] });
const page = await context.newPage();
const errors = [];
page.on("console", message => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", error => errors.push(error.message));

await page.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });
await page.screenshot({ path: "tests/today-before.png", fullPage: true });
if (!(await page.locator("#pre-draw").isVisible())) throw new Error("Draw screen is not visible");
const back = page.locator("#draw-stage .card-back");
const backStyle = await back.evaluate(element => ({
  backgroundImage: getComputedStyle(element).backgroundImage,
  transform: getComputedStyle(element).transform
}));
if (!backStyle.backgroundImage.includes("card-back.png")) throw new Error("Selected deck back is not displayed");
if (backStyle.transform !== "none") throw new Error("Pre-draw deck back must always be upright");

await page.locator("#draw-card").click();
await page.locator("#reading:not([hidden])").waitFor({ timeout: 5000 });
await page.screenshot({ path: "tests/today-after.png", fullPage: true });
const cardName = await page.locator("#reading-name").textContent();
const question = await page.locator("#reading-question").textContent();
if (!cardName || !question) throw new Error("Reading content is missing");
const orientation = await page.locator("#reading-orientation").textContent();
const readingTransform = await page.locator("#reading-card .tarot-card").evaluate(element => getComputedStyle(element).transform);
if (orientation?.includes("REVERSED") && readingTransform === "none") throw new Error("Reversed face is not rotated after drawing");
if (orientation?.includes("UPRIGHT") && readingTransform !== "none") throw new Error("Upright face was rotated after drawing");

await page.reload({ waitUntil: "networkidle" });
if (!(await page.locator("#reading:not([hidden])").isVisible())) throw new Error("Daily reading was not persisted");

await page.locator('[data-view="history-view"]').click();
if ((await page.locator(".calendar-day.has-reading").count()) !== 1) throw new Error("History day was not rendered");

await page.locator('[data-view="settings-view"]').click();
if (!(await page.locator("#export-data").isVisible())) throw new Error("Settings screen is not visible");

console.log(JSON.stringify({ cardName, question, orientation, backStyle, errors }, null, 2));
await browser.close();
