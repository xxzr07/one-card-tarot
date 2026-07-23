import fs from "node:fs";
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
const registry = await page.evaluate(() => ({
  cards: window.CARD_DATA?.length,
  decks: window.DECKS?.length,
  deckId: window.DECKS?.[0]?.id
}));
if (registry.cards !== 78 || registry.decks !== 1 || registry.deckId !== "deck-01") {
  throw new Error(`Content registry did not load: ${JSON.stringify(registry)}`);
}

await page.screenshot({ path: "tests/today-before.png", fullPage: true });
if (!(await page.locator("#pre-draw").isVisible())) throw new Error("Draw screen is not visible");
const back = page.locator("#draw-stage .card-back");
const backStyle = await back.evaluate(element => ({
  backgroundImage: getComputedStyle(element).backgroundImage,
  transform: getComputedStyle(element).transform
}));
if (!backStyle.backgroundImage.includes("/decks/deck-01/back.png")) throw new Error("Selected deck back is not displayed");
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

const todayReading = await page.evaluate(() => new Promise((resolve, reject) => {
  const request = indexedDB.open("one-card-tarot", 1);
  request.onerror = () => reject(request.error);
  request.onsuccess = () => {
    const getAll = request.result.transaction("readings").objectStore("readings").getAll();
    getAll.onerror = () => reject(getAll.error);
    getAll.onsuccess = () => resolve(getAll.result[0]);
  };
}));
if (
  todayReading.version !== 2 ||
  todayReading.deckContentVersion !== "1.0.0" ||
  !todayReading.snapshot?.question ||
  !todayReading.snapshot?.keywords?.length
) {
  throw new Error("New draw was not saved as a complete version 2 snapshot");
}

await page.reload({ waitUntil: "networkidle" });
if (!(await page.locator("#reading:not([hidden])").isVisible())) throw new Error("Daily reading was not persisted");

const dates = await page.evaluate(() => {
  const now = new Date();
  const dateKey = day => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const candidates = [1, 2, 3].filter(day => day !== now.getDate());
  return { legacy: dateKey(candidates[0]), snapshot: dateKey(candidates[1]) };
});
const importPayload = {
  app: "one-card-tarot",
  schemaVersion: 2,
  readings: [
    {
      version: 1,
      date: dates.legacy,
      cardId: "major-09",
      orientation: "reversed",
      deckId: "deck-01",
      createdAt: new Date().toISOString()
    },
    {
      version: 2,
      date: dates.snapshot,
      cardId: "major-00",
      orientation: "upright",
      deckId: "deck-01",
      deckContentVersion: "0.9.0",
      snapshot: {
        deckName: "DECK 01 SNAPSHOT",
        cardNumber: "0",
        cardName: "THE FOOL SNAPSHOT",
        keywords: ["保存済み"],
        meaning: "保存時点の解説。",
        question: "保存時点の問い。"
      },
      createdAt: new Date().toISOString()
    }
  ]
};

await page.locator('[data-view="settings-view"]').click();
await page.locator("#import-data").setInputFiles({
  name: "compatibility.json",
  mimeType: "application/json",
  buffer: Buffer.from(JSON.stringify(importPayload))
});
await page.locator("#settings-status").filter({ hasText: "2件の記録を読み込みました" }).waitFor();

const downloadPromise = page.waitForEvent("download");
await page.locator("#export-data").click();
const download = await downloadPromise;
const exported = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
if (exported.schemaVersion !== 2 || exported.readings.length !== 3) {
  throw new Error("Export did not preserve mixed version 1/version 2 history");
}

await page.locator('[data-view="history-view"]').click();
if ((await page.locator(".calendar-day.has-reading").count()) !== 3) throw new Error("History days were not rendered");

await page.locator(`.calendar-day[aria-label^="${dates.legacy}"]`).click();
const legacyQuestion = await page.locator("#reading-question").textContent();
if (!legacyQuestion || legacyQuestion === "保存時点の問い。") {
  throw new Error("Version 1 history was not restored from current Deck 01 data");
}

await page.locator('[data-view="history-view"]').click();
await page.locator(`.calendar-day[aria-label^="${dates.snapshot}"]`).click();
if ((await page.locator("#reading-question").textContent()) !== "保存時点の問い。") {
  throw new Error("Version 2 history did not prefer its saved snapshot");
}
if ((await page.locator("#reading-name").textContent()) !== "THE FOOL SNAPSHOT") {
  throw new Error("Version 2 card name snapshot was not preserved");
}

await page.locator('[data-view="settings-view"]').click();
if (!(await page.locator("#export-data").isVisible())) throw new Error("Settings screen is not visible");
if (errors.length) throw new Error(`Browser errors: ${errors.join(" | ")}`);

console.log(JSON.stringify({
  registry,
  cardName,
  question,
  orientation,
  backStyle,
  savedVersion: todayReading.version,
  importedVersions: exported.readings.map(reading => reading.version),
  errors
}, null, 2));
await browser.close();
