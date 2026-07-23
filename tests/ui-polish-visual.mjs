import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const sharp = require("sharp");

const BASE_URL = process.env.ONE_CARD_BASE_URL || "http://127.0.0.1:4173";
const requestedWidth = Number.parseInt(process.env.ONE_CARD_VIEWPORT_WIDTH || "", 10);
const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 430, height: 932 }
].filter(viewport => !requestedWidth || viewport.width === requestedWidth);
const deviceScaleFactor = Number.parseFloat(process.env.ONE_CARD_DPR || "1");

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined
});

const results = [];

const dateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

async function putReading(page, reading) {
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

async function assertDarkCornerImage(buffer, label) {
  const image = sharp(buffer);
  const { data, info } = await image.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const samples = [
    [0, 0],
    [info.width - 1, 0],
    [0, info.height - 1],
    [info.width - 1, info.height - 1]
  ].map(([x, y]) => {
    const offset = (y * info.width + x) * info.channels;
    return (data[offset] + data[offset + 1] + data[offset + 2]) / 3;
  });
  if (Math.max(...samples) > 80) {
    throw new Error(`${label}: a light outer corner is visible (${samples.join(", ")})`);
  }
  return samples.map(value => Math.round(value));
}

async function assertDarkCorners(locator, label) {
  return assertDarkCornerImage(await locator.screenshot(), label);
}

async function assertMovingDarkCorners(page, locator, label) {
  const box = await locator.boundingBox();
  if (!box || box.width < 1 || box.height < 1) throw new Error(`${label}: moving card is not visible`);
  const clip = {
    x: Math.max(0, box.x),
    y: Math.max(0, box.y),
    width: Math.min(box.width, page.viewportSize().width - Math.max(0, box.x)),
    height: Math.min(box.height, page.viewportSize().height - Math.max(0, box.y))
  };
  return assertDarkCornerImage(await page.screenshot({ clip }), label);
}

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor,
    timezoneId: "Asia/Tokyo",
    colorScheme: "dark"
  });
  const page = await context.newPage();
  const browserErrors = [];
  page.on("console", message => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", error => browserErrors.push(error.message));

  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);

  const preDraw = await page.evaluate(() => ({
    standaloneDeckLabels: [...document.querySelectorAll(".deck-picker > .section-label")]
      .filter(element => element.textContent.trim() === "DECK").length,
    quietNotes: document.querySelectorAll(".quiet-note").length,
    drawFont: getComputedStyle(document.querySelector("#draw-card")).fontFamily,
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1
  }));
  if (
    preDraw.standaloneDeckLabels ||
    preDraw.quietNotes ||
    !preDraw.drawFont.includes("Hakkou Mincho") ||
    preDraw.horizontalOverflow
  ) {
    throw new Error(`${viewport.width}: pre-draw UI validation failed`);
  }
  const backCorners = await assertDarkCorners(page.locator("#draw-stage .card-back"), `${viewport.width} back`);

  await page.locator('[data-view="history-view"]').click();
  const todayOnly = page.locator(".calendar-day.is-today");
  if (await todayOnly.locator(".calendar-day-marker").count()) {
    throw new Error(`${viewport.width}: today-only state incorrectly has a draw marker`);
  }
  const todayOnlyRing = await todayOnly.locator(".calendar-day-number").evaluate(element =>
    getComputedStyle(element).borderTopColor
  );
  if (todayOnlyRing === "rgba(0, 0, 0, 0)") {
    throw new Error(`${viewport.width}: today-only state has no date ring`);
  }

  await page.locator('[data-view="settings-view"]').click();
  const about = await page.locator(".about-description").evaluate(element => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    whiteSpace: getComputedStyle(element).whiteSpace
  }));
  if (about.scrollWidth > about.clientWidth + 1 || about.whiteSpace !== "nowrap") {
    throw new Error(`${viewport.width}: About description does not fit on one line`);
  }

  let flipState = null;
  if (viewport.width === 390) {
    await page.locator('[data-view="today-view"]').click();
    await page.locator("#draw-card").click();
    await page.waitForTimeout(410);
    flipState = await page.evaluate(() => {
      const flipper = document.querySelector(".card-flipper");
      const faces = [...document.querySelectorAll(".card-face")].map(element => {
        const style = getComputedStyle(element);
        return {
          backgroundColor: style.backgroundColor,
          borderRadius: style.borderRadius,
          overflow: style.overflow
        };
      });
      return { transform: getComputedStyle(flipper).transform, faces };
    });
    if (
      flipState.transform === "none" ||
      flipState.faces.some(face =>
        face.backgroundColor !== "rgb(20, 21, 26)" ||
        face.overflow !== "hidden" ||
        face.borderRadius !== flipState.faces[0].borderRadius
      )
    ) {
      throw new Error("390: flip transition does not preserve shared dark clipping");
    }
    flipState.frontCorners = await assertMovingDarkCorners(
      page,
      page.locator("#draw-stage .card-front .tarot-card"),
      "390 flip front"
    );
    await page.locator("#reading:not([hidden])").waitFor();
  }

  const today = new Date();
  const prior = new Date(today);
  prior.setDate(prior.getDate() - 2);
  const older = new Date(today);
  older.setDate(older.getDate() - 4);
  const olderMinor = new Date(today);
  olderMinor.setDate(olderMinor.getDate() - 6);
  await putReading(page, {
    version: 1,
    date: dateKey(today),
    cardId: "major-13",
    orientation: "upright",
    deckId: "deck-01",
    createdAt: new Date().toISOString()
  });
  await putReading(page, {
    version: 1,
    date: dateKey(prior),
    cardId: "cups-ace",
    orientation: "reversed",
    deckId: "deck-01",
    createdAt: new Date().toISOString()
  });
  await putReading(page, {
    version: 1,
    date: dateKey(older),
    cardId: "major-21",
    orientation: "reversed",
    deckId: "deck-01",
    createdAt: new Date().toISOString()
  });
  await putReading(page, {
    version: 1,
    date: dateKey(olderMinor),
    cardId: "wands-ace",
    orientation: "upright",
    deckId: "deck-01",
    createdAt: new Date().toISOString()
  });

  await page.reload({ waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const majorCorners = await assertDarkCorners(page.locator("#reading-card .tarot-card"), `${viewport.width} major upright`);

  const questionAudit = await page.evaluate(async () => {
    const target = document.querySelector("#reading-question");
    const questions = window.DECKS.flatMap(deck =>
      Object.values(deck.cards).flatMap(card => [card.upright.question, card.reversed.question])
    );
    const lineCount = element => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return new Set([...range.getClientRects()].map(rect => Math.round(rect.top * 2) / 2)).size;
    };
    let oneLine = 0;
    let minimumFontSize = Number.POSITIVE_INFINITY;
    for (const question of questions) {
      target.textContent = question;
      window.dispatchEvent(new Event("resize"));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (lineCount(target) === 1) oneLine += 1;
      minimumFontSize = Math.min(minimumFontSize, Number.parseFloat(getComputedStyle(target).fontSize));
    }
    return { total: questions.length, oneLine, minimumFontSize };
  });
  if (questionAudit.minimumFontSize < 14 || questionAudit.oneLine / questionAudit.total < .5) {
    throw new Error(`${viewport.width}: question fitting is too small or rarely one-line`);
  }

  await page.locator('[data-view="history-view"]').click();
  const todayDrawn = page.locator(".calendar-day.is-today.has-reading");
  const priorDrawn = page.locator(`.calendar-day[aria-label^="${dateKey(prior)}"]`);
  const neither = page.locator(".calendar-day:not(.is-empty):not(.is-today):not(.has-reading)").first();
  if (
    await neither.locator(".calendar-day-number").count() !== 1 ||
    await neither.locator(".calendar-day-marker").count() !== 0
  ) {
    throw new Error(`${viewport.width}: normal calendar day state is incorrect`);
  }
  const positions = await Promise.all([todayDrawn, priorDrawn].map(async cell => {
    const [cellBox, numberBox, markerBox] = await Promise.all([
      cell.boundingBox(),
      cell.locator(".calendar-day-number").boundingBox(),
      cell.locator(".calendar-day-marker").boundingBox()
    ]);
    return { cellBox, numberBox, markerBox };
  }));
  for (const { cellBox, numberBox, markerBox } of positions) {
    const cellCenter = cellBox.x + cellBox.width / 2;
    const numberCenter = numberBox.x + numberBox.width / 2;
    const markerCenter = markerBox.x + markerBox.width / 2;
    if (
      Math.abs(cellCenter - numberCenter) > .6 ||
      Math.abs(cellCenter - markerCenter) > .6 ||
      markerBox.y - (numberBox.y + numberBox.height) < 0
    ) {
      throw new Error(`${viewport.width}: calendar marker alignment failed`);
    }
  }

  await priorDrawn.click();
  const minorCorners = await assertDarkCorners(page.locator("#reading-card .tarot-card"), `${viewport.width} minor reversed`);
  await page.locator('[data-view="history-view"]').click();
  await page.locator(`.calendar-day[aria-label^="${dateKey(older)}"]`).click();
  const reversedMajorCorners = await assertDarkCorners(
    page.locator("#reading-card .tarot-card"),
    `${viewport.width} major reversed`
  );
  const meaningLines = await page.locator("#reading-meaning").evaluate(element => {
    const lines = new Map();
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = walker.currentNode;
      for (let index = 0; index < text.length; index += 1) {
        const range = document.createRange();
        range.setStart(text, index);
        range.setEnd(text, index + 1);
        const top = Math.round(range.getBoundingClientRect().top * 2) / 2;
        lines.set(top, `${lines.get(top) || ""}${text.data[index]}`);
      }
    }
    return [...lines.values()];
  });
  if (
    meaningLines.some(line => /^[。、，．）］】』」]/u.test(line)) ||
    [...meaningLines.at(-1)].length < 6 ||
    (meaningLines.length > 1 && !/[。、]$/u.test(meaningLines[0]))
  ) {
    throw new Error(`${viewport.width}: meaning text wraps unnaturally (${meaningLines.join(" / ")})`);
  }
  await page.locator('[data-view="history-view"]').click();
  await page.locator(`.calendar-day[aria-label^="${dateKey(olderMinor)}"]`).click();
  const uprightMinorCorners = await assertDarkCorners(
    page.locator("#reading-card .tarot-card"),
    `${viewport.width} minor upright`
  );

  const finalLayout = await page.evaluate(() => ({
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    navBottom: Math.round(document.querySelector(".bottom-nav").getBoundingClientRect().bottom),
    viewportBottom: innerHeight,
    offenders: [...document.querySelectorAll("body *")].flatMap(element => {
      const rect = element.getBoundingClientRect();
      return rect.left < -1 || rect.right > innerWidth + 1
        ? [{ element: element.className || element.id || element.tagName, left: rect.left, right: rect.right }]
        : [];
    }).slice(0, 8)
  }));
  if (finalLayout.horizontalOverflow || finalLayout.navBottom !== finalLayout.viewportBottom || browserErrors.length) {
    throw new Error(`${viewport.width}: final responsive layout failed (${JSON.stringify({ finalLayout, browserErrors })})`);
  }

  results.push({
    viewport,
    backCorners,
    majorCorners,
    reversedMajorCorners,
    minorCorners,
    uprightMinorCorners,
    questionAudit,
    meaningLines,
    about,
    flipState
  });
  await context.close();
}

console.log(JSON.stringify({ result: "UI polish visual audit passed", viewports: results }, null, 2));
await browser.close();
