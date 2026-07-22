import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");

const BASE_URL = "http://127.0.0.1:4173";
const SCREENSHOTS = [
  ["major-19", "upright", "tests/app-iphone-upright-major.png"],
  ["wands-ace", "reversed", "tests/app-iphone-reversed-minor.png"],
  ["swords-10", "upright", "tests/app-iphone-upright-dark.png"],
  ["pentacles-05", "reversed", "tests/app-iphone-reversed-dark.png"],
  ["pentacles-knight", "upright", "tests/app-iphone-long-name.png"]
];

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined
});
const context = await browser.newContext({ ...devices["iPhone 13"] });
const page = await context.newPage();
const errors = [];
page.on("console", message => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", error => errors.push(error.message));

await page.goto(BASE_URL, { waitUntil: "networkidle" });

const assetAudit = await page.evaluate(async () => {
  const deck = window.DECKS[0];
  const results = [];
  for (const card of window.CARD_DATA) {
    const imagePath = deck.cards[card.id]?.image;
    const image = new Image();
    image.src = imagePath;
    try {
      await image.decode();
      results.push({
        id: card.id,
        ok: image.naturalWidth === 612 && image.naturalHeight === 1206,
        width: image.naturalWidth,
        height: image.naturalHeight
      });
    } catch {
      results.push({ id: card.id, ok: false, width: 0, height: 0 });
    }
  }
  return results;
});

const failedAssets = assetAudit.filter(result => !result.ok);
if (failedAssets.length) throw new Error(`Card assets failed to render: ${JSON.stringify(failedAssets)}`);

const cssAudit = await page.evaluate(() => {
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-10000px;top:0;width:292px";
  document.body.append(host);
  const deck = window.DECKS[0];
  const failures = [];
  for (const card of window.CARD_DATA) {
    for (const orientation of ["upright", "reversed"]) {
      const element = document.createElement("div");
      element.className = `tarot-card${orientation === "reversed" ? " is-reversed" : ""}`;
      element.style.setProperty("--card-image", `url('${deck.cards[card.id].image}')`);
      host.replaceChildren(element);
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const expectedHeight = box.width * 603 / 306;
      const reversed = orientation === "reversed";
      if (
        Math.abs(box.height - expectedHeight) > 1 ||
        style.backgroundSize !== "cover" ||
        !style.backgroundImage.includes(card.id) ||
        (reversed && style.transform === "none") ||
        (!reversed && style.transform !== "none")
      ) failures.push({ id: card.id, orientation, width: box.width, height: box.height, transform: style.transform });
    }
  }
  host.remove();
  return failures;
});

if (cssAudit.length) throw new Error(`Card CSS audit failed: ${JSON.stringify(cssAudit)}`);

async function seedReading(cardId, orientation) {
  await page.evaluate(async ({ cardId, orientation }) => {
    const date = new Date();
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("one-card-tarot", 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("readings")) request.result.createObjectStore("readings", { keyPath: "date" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction("readings", "readwrite");
      tx.objectStore("readings").put({
        version: 1,
        date: key,
        cardId,
        orientation,
        deckId: "deck-01",
        createdAt: new Date().toISOString()
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, { cardId, orientation });
}

for (const [cardId, orientation, screenshot] of SCREENSHOTS) {
  await seedReading(cardId, orientation);
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("#reading:not([hidden])").waitFor();
  const rendered = await page.locator("#reading-card .tarot-card");
  const box = await rendered.boundingBox();
  const navBox = await page.locator(".bottom-nav").boundingBox();
  const expectedName = await page.evaluate(id => window.CARD_DATA.find(card => card.id === id).name, cardId);
  const actualName = await page.locator("#reading-name").textContent();
  const transform = await rendered.evaluate(element => getComputedStyle(element).transform);
  if (!box || Math.abs(box.height - box.width * 603 / 306) > 1) throw new Error(`${cardId}: card ratio is incorrect`);
  if (!navBox || box.y + box.height > navBox.y + 1) throw new Error(`${cardId}: card is obscured by the bottom navigation`);
  if (actualName !== expectedName) throw new Error(`${cardId}: card name did not render`);
  if ((orientation === "reversed") !== (transform !== "none")) throw new Error(`${cardId}: orientation did not render`);
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (horizontalOverflow) throw new Error(`${cardId}: long content causes horizontal overflow`);
  await page.screenshot({ path: screenshot, fullPage: true });
}

if (errors.length) throw new Error(`Browser errors: ${errors.join(" | ")}`);
console.log(`Visual audit passed: ${assetAudit.length} assets, ${assetAudit.length * 2} orientation states, ${SCREENSHOTS.length} iPhone screenshots.`);
await browser.close();
