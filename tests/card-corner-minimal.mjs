import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const sharp = require("sharp");

const BASE_URL = process.env.ONE_CARD_BASE_URL || "http://127.0.0.1:4173";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined
});
const context = await browser.newContext({
  viewport: { width: 1024, height: 2200 },
  deviceScaleFactor: 2,
  colorScheme: "dark"
});
const page = await context.newPage();
await page.goto(`${BASE_URL}/tests/card-corner-minimal.html`, { waitUntil: "networkidle" });

async function auditSample(name) {
  const buffer = await page.locator(`[data-sample="${name}"]`).screenshot();
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let maximumCornerLuminance = 0;
  const size = 50;
  for (const [originX, originY] of [
    [0, 0],
    [info.width - size, 0],
    [0, info.height - size],
    [info.width - size, info.height - size]
  ]) {
    for (let y = originY; y < originY + size; y += 1) {
      for (let x = originX; x < originX + size; x += 1) {
        const offset = (y * info.width + x) * info.channels;
        const luminance =
          0.2126 * data[offset] +
          0.7152 * data[offset + 1] +
          0.0722 * data[offset + 2];
        maximumCornerLuminance = Math.max(maximumCornerLuminance, luminance);
      }
    }
  }
  if (maximumCornerLuminance > 225) {
    throw new Error(`${name}: white corner pixel remains (${maximumCornerLuminance.toFixed(2)})`);
  }
  return Number(maximumCornerLuminance.toFixed(2));
}

const results = {};
for (const name of [
  "background-back",
  "background-major",
  "background-minor",
  "img-back",
  "img-major",
  "img-minor",
  "flip-back",
  "flip-major",
  "flip-minor"
]) {
  results[name] = await auditSample(name);
}

await browser.close();
console.log(JSON.stringify({
  cssConditions: {
    backgroundSize: "cover",
    borderRadius: "4.902% / 2.488%",
    overflow: "hidden",
    background: "#14151a",
    perspective: "1200px",
    backfaceVisibility: "hidden"
  },
  results
}, null, 2));
