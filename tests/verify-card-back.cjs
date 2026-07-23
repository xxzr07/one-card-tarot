const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const sharp = require("sharp");
const { CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS } = require("../tools/card-output.cjs");

const ROOT = path.resolve(__dirname, "..");
const sha256 = buffer => crypto.createHash("sha256").update(buffer).digest("hex");

async function main() {
  const deck = JSON.parse(fs.readFileSync(path.join(ROOT, "decks", "deck-01", "deck.json"), "utf8"));
  const relativePath = path.join("decks", "deck-01", deck.backImage).replaceAll(path.sep, "/");
  const absolutePath = path.resolve(ROOT, "decks", "deck-01", deck.backImage);
  const { data, info } = await sharp(absolutePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== CARD_WIDTH || info.height !== CARD_HEIGHT || info.channels !== 4) {
    throw new Error(`Back image must be ${CARD_WIDTH}x${CARD_HEIGHT} RGBA`);
  }

  const alphaAt = (x, y) => data[(y * info.width + x) * 4 + 3];
  const outerCorners = [[0, 0], [CARD_WIDTH - 1, 0], [0, CARD_HEIGHT - 1], [CARD_WIDTH - 1, CARD_HEIGHT - 1]];
  if (outerCorners.some(([x, y]) => alphaAt(x, y) !== 0)) {
    throw new Error("Back image has non-transparent pixels outside the shared rounded corners");
  }
  const antialiasSamples = [
    [23, 0],
    [CARD_WIDTH - 24, 0],
    [23, CARD_HEIGHT - 1],
    [CARD_WIDTH - 24, CARD_HEIGHT - 1],
    [0, 23],
    [CARD_WIDTH - 1, 23],
    [0, CARD_HEIGHT - 24],
    [CARD_WIDTH - 1, CARD_HEIGHT - 24]
  ].map(([x, y]) => alphaAt(x, y));
  if (Math.min(...antialiasSamples) <= 0 || Math.max(...antialiasSamples) >= 255) {
    throw new Error(`Back image lacks a one-pass antialiased corner edge (${antialiasSamples.join(", ")})`);
  }
  if (Object.keys(deck.cards).length !== 78) throw new Error("Deck 01 must use one back for all 78 cards");

  const appSource = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
  const styles = fs.readFileSync(path.join(ROOT, "styles.css"), "utf8");
  if (!appSource.includes("deck.backImage")) throw new Error("Deck picker does not apply the selected deck back");
  if (/card-back[^}]*transform\s*:\s*rotate\(180deg\)/s.test(styles)) throw new Error("The pre-draw back has a reverse transform");

  const audit = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    deckId: deck.id,
    backImage: relativePath,
    backImageSha256: sha256(fs.readFileSync(absolutePath)),
    dimensions: `${CARD_WIDTH}x${CARD_HEIGHT}`,
    sharedCornerRadius: CARD_RADIUS,
    transparentOuterCorners: true,
    onePassAntialiasEdge: true,
    cardsUsingThisBack: Object.keys(deck.cards).length,
    preDrawOrientation: "always-upright",
    faceOrientationAfterDraw: "reading-orientation"
  };
  fs.writeFileSync(path.join(ROOT, "tests", "card-back-audit.json"), JSON.stringify(audit, null, 2) + "\n");
  console.log(JSON.stringify(audit, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
