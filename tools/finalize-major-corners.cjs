const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
const { clipCardPng } = require("./card-output.cjs");

const ROOT = path.resolve(__dirname, "..");
const ASSETS = path.join(ROOT, "decks", "deck-01", "cards");

async function main() {
  let updated = 0;
  for (let index = 0; index < 22; index += 1) {
    const file = path.join(ASSETS, `major-${String(index).padStart(2, "0")}.png`);
    if (!fs.existsSync(file)) throw new Error(`Missing Major Arcana image: ${file}`);
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const cornerOffsets = [
      3,
      (info.width - 1) * 4 + 3,
      ((info.height - 1) * info.width) * 4 + 3,
      ((info.height * info.width) - 1) * 4 + 3
    ];
    if (cornerOffsets.every(offset => data[offset] === 0)) continue;
    const clipped = await clipCardPng(file);
    const next = `${file}.next`;
    fs.writeFileSync(next, clipped);
    fs.renameSync(next, file);
    updated += 1;
  }
  console.log(`Major Arcana corner pass complete: ${updated} updated, ${22 - updated} already finalized.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
