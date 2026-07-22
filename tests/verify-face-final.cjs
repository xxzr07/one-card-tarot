const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const sharp = require("sharp");
const { CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS } = require("../tools/card-output.cjs");

const ROOT = path.resolve(__dirname, "..");
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ["data/cards.js", "data/minor-cards.js"]) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), sandbox, { filename: file });
}

const cards = sandbox.window.CARD_DATA;
const normalMajorIds = [0, 1, 2, 3, 5, 8, 10, 12, 14, 16, 19, 20, 21]
  .map(index => `major-${String(index).padStart(2, "0")}`);
const darkMinorIds = new Set(["swords-09", "swords-10", "pentacles-05"]);
const normalMinorIds = cards
  .filter(card => card.suit !== "major" && !darkMinorIds.has(card.id))
  .map(card => card.id);

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

async function pixels(id) {
  const file = path.join(ROOT, "assets", "deck-01", `${id}.png`);
  const result = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (result.info.width !== CARD_WIDTH || result.info.height !== CARD_HEIGHT || result.info.channels !== 4) {
    throw new Error(`${id}: expected ${CARD_WIDTH}x${CARD_HEIGHT} RGBA output`);
  }
  return result.data;
}

function alphaAt(data, x, y) {
  return data[(y * CARD_WIDTH + x) * 4 + 3];
}

function baseLuminance(data) {
  const values = [];
  for (let y = 1140; y < 1165; y += 1) {
    for (let x = 80; x < 532; x += 1) {
      const offset = (y * CARD_WIDTH + x) * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      values.push(0.2126 * r + 0.7152 * g + 0.0722 * b);
    }
  }
  return median(values);
}

async function main() {
  if (cards.length !== 78) throw new Error(`Expected 78 cards, found ${cards.length}`);
  const cardPixels = new Map();
  for (const card of cards) {
    const data = await pixels(card.id);
    cardPixels.set(card.id, data);
    const corners = [[0, 0], [CARD_WIDTH - 1, 0], [0, CARD_HEIGHT - 1], [CARD_WIDTH - 1, CARD_HEIGHT - 1]];
    if (corners.some(([x, y]) => alphaAt(data, x, y) !== 0)) {
      throw new Error(`${card.id}: a non-transparent outer corner remains`);
    }
  }

  const majorLuminance = median(normalMajorIds.map(id => baseLuminance(cardPixels.get(id))));
  const minorLuminance = median(normalMinorIds.map(id => baseLuminance(cardPixels.get(id))));
  const difference = Math.abs(majorLuminance - minorLuminance);
  if (difference > 1) {
    throw new Error(`Normal card bases differ by ${difference.toFixed(2)} luminance levels`);
  }

  console.log(JSON.stringify({
    cardsChecked: cards.length,
    sharedCornerRadius: CARD_RADIUS,
    transparentOuterCorners: true,
    normalMajorBaseLuminance: Number(majorLuminance.toFixed(2)),
    normalMinorBaseLuminance: Number(minorLuminance.toFixed(2)),
    luminanceDifference: Number(difference.toFixed(2))
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
