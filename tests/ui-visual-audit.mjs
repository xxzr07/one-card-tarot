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
const context = await browser.newContext({
  ...devices["iPhone 13"],
  timezoneId: "Asia/Tokyo",
  colorScheme: "dark"
});
const page = await context.newPage();
const errors = [];
page.on("console", message => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", error => errors.push(error.message));

const dateKey = date => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

async function putReading(reading) {
  await page.evaluate(value => new Promise((resolve, reject) => {
    const request = indexedDB.open("one-card-tarot", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("readings")) {
        request.result.createObjectStore("readings", { keyPath: "date" });
      }
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const transaction = request.result.transaction("readings", "readwrite");
      transaction.objectStore("readings").put(value);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    };
  }), reading);
}

async function waitForFonts() {
  await page.evaluate(() => document.fonts.ready);
}

async function capture(path) {
  await page.waitForTimeout(400);
  const isLongPage = await page.evaluate(() => document.documentElement.scrollHeight > innerHeight + 20);
  const screenshotStyle = await page.addStyleTag({
    content: isLongPage ? ".bottom-nav{display:none !important}" : "/* screenshot: nav stays fixed */"
  });
  await page.screenshot({ path, fullPage: true });
  await screenshotStyle.evaluate(element => element.remove());
}

await page.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });
await waitForFonts();
await capture("tests/ui-today-before.png");

const today = new Date();
const prior = new Date(today);
prior.setDate(prior.getDate() - 2);
const older = new Date(today);
older.setDate(older.getDate() - 5);

await putReading({ version: 1, date: dateKey(today), cardId: "major-00", orientation: "upright", deckId: "deck-01", createdAt: new Date().toISOString() });
await putReading({ version: 1, date: dateKey(prior), cardId: "major-09", orientation: "reversed", deckId: "deck-01", createdAt: new Date().toISOString() });
await putReading({ version: 1, date: dateKey(older), cardId: "swords-09", orientation: "upright", deckId: "deck-01", createdAt: new Date().toISOString() });

await page.reload({ waitUntil: "networkidle" });
await waitForFonts();
await page.locator("#reading:not([hidden])").waitFor();
await capture("tests/ui-today-after-light-upright.png");
const lightCard = await page.locator("#reading-card .tarot-card").evaluate(element => ({
  backgroundImage: getComputedStyle(element).backgroundImage,
  transform: getComputedStyle(element).transform
}));

await page.locator('[data-view="history-view"]').click();
await page.locator("#history-view.is-active").waitFor();
await capture("tests/ui-history-month.png");
const historyMarkers = await page.locator(".calendar-day.has-reading").count();

await page.locator(`.calendar-day[aria-label^="${dateKey(prior)}"]`).click();
await page.locator("#reading:not([hidden])").waitFor();
await capture("tests/ui-history-detail.png");
const historyDetailDate = await page.locator("#reading-deck").textContent();

await page.locator('[data-view="settings-view"]').click();
await page.locator("#settings-view.is-active").waitFor();
await capture("tests/ui-settings.png");

await putReading({ version: 1, date: dateKey(today), cardId: "swords-09", orientation: "reversed", deckId: "deck-01", createdAt: new Date().toISOString() });
await page.reload({ waitUntil: "networkidle" });
await waitForFonts();
await page.locator("#reading:not([hidden])").waitFor();
await capture("tests/ui-today-after-dark-reversed.png");
const darkCard = await page.locator("#reading-card .tarot-card").evaluate(element => ({
  backgroundImage: getComputedStyle(element).backgroundImage,
  transform: getComputedStyle(element).transform
}));

const layout = await page.evaluate(() => {
  const nav = document.querySelector(".bottom-nav");
  const navStyle = getComputedStyle(nav);
  const bodyStyle = getComputedStyle(document.body);
  const activeTargets = [...document.querySelectorAll(".nav-button")].map(element => {
    const rect = element.getBoundingClientRect();
    return { width: Math.round(rect.width), height: Math.round(rect.height) };
  });
  return {
    viewport: { width: innerWidth, height: innerHeight },
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    backgroundColor: bodyStyle.backgroundColor,
    navigationBackground: navStyle.backgroundColor,
    navigationBackdropFilter: navStyle.backdropFilter,
    minNavigationTargetHeight: Math.min(...activeTargets.map(target => target.height)),
    hakkouLoaded: document.fonts.check('16px "Hakkou Mincho"')
  };
});

if (!lightCard.backgroundImage.includes("major-00.png") || lightCard.transform !== "none") {
  throw new Error("Light upright card state failed");
}
if (!darkCard.backgroundImage.includes("swords-09.png") || darkCard.transform === "none") {
  throw new Error("Dark reversed card state failed");
}
if (historyMarkers !== 3 || !historyDetailDate?.startsWith(dateKey(prior))) {
  throw new Error("History month/detail state failed");
}
if (layout.horizontalOverflow || layout.minNavigationTargetHeight < 44 || !layout.hakkouLoaded) {
  throw new Error("Responsive layout or local font validation failed");
}
if (errors.length) throw new Error(`Browser errors: ${errors.join(" | ")}`);

const audit = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  referenceDirection: "A. pure MATTE only",
  viewport: layout.viewport,
  screensChecked: [
    "TODAY before draw",
    "TODAY after draw — light/upright",
    "TODAY after draw — dark/reversed",
    "HISTORY month",
    "HISTORY past detail",
    "SETTINGS"
  ],
  lightCard,
  darkCard,
  historyMarkers,
  historyDetailDate,
  layout,
  browserErrors: errors
};
fs.writeFileSync("tests/matte-ui-audit.json", `${JSON.stringify(audit, null, 2)}\n`);
console.log(JSON.stringify(audit, null, 2));
await browser.close();
