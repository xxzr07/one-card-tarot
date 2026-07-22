const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ["data/cards.js", "data/minor-cards.js", "decks/deck-01.js", "decks/deck-01-minor.js"]) {
  vm.runInContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
}

const cards = sandbox.window.CARD_DATA;
const decks = sandbox.window.DECKS;
if (!Array.isArray(cards) || cards.length !== 78) throw new Error("Deck 01 must contain exactly 78 cards");
if (!Array.isArray(decks) || decks.length < 1) throw new Error("At least one deck is required");

const expectedIds = Array.from({ length: 22 }, (_, index) => `major-${String(index).padStart(2, "0")}`);
if (cards.slice(0, 22).map(card => card.id).join(",") !== expectedIds.join(",")) {
  throw new Error("Major Arcana IDs must run continuously from major-00 to major-21");
}
if (new Set(cards.map(card => card.id)).size !== 78) throw new Error("Card IDs must be unique");
for (const suit of ["wands", "cups", "swords", "pentacles"]) {
  if (cards.filter(card => card.suit === suit).length !== 14) throw new Error(`${suit}: expected 14 cards`);
}

const minorSvgDirectory = path.join("tools", ".minor-tmp");
const minorSvgFiles = fs.readdirSync(minorSvgDirectory).filter(file => file.endsWith(".svg")).sort();
if (minorSvgFiles.length !== 56) throw new Error(`Expected 56 generated Minor Arcana SVGs, found ${minorSvgFiles.length}`);
const darkMinorSvgFiles = new Set(["swords-09.svg", "swords-10.svg", "pentacles-05.svg"]);
for (const file of minorSvgFiles) {
  const svg = fs.readFileSync(path.join(minorSvgDirectory, file), "utf8");
  if (!/<text x="306" y="1080"[^>]*>[^<]+<\/text>/.test(svg)) throw new Error(`${file}: direct card-name text is missing`);
  if (!/<clipPath id="artworkClip"><rect x="32" y="32" width="548" height="1142" rx="23"\/><\/clipPath>/.test(svg)) {
    throw new Error(`${file}: shared artwork clip does not match the inside of the gold frame`);
  }
  if (!/<clipPath id="cardClip"><rect x="0" y="0" width="612" height="1206" rx="30"\/><\/clipPath>/.test(svg)) {
    throw new Error(`${file}: shared outer card clip is missing`);
  }
  if (!/<g id="artwork" data-layer="artwork" clip-path="url\(#artworkClip\)">/.test(svg)) {
    throw new Error(`${file}: artwork is not contained by the shared artwork clip`);
  }
  const expectedBase = darkMinorSvgFiles.has(file) ? "url(#nightPaper)" : "#f2eee6";
  if (!svg.includes(`<rect x="0" y="0" width="612" height="1206" rx="30" fill="${expectedBase}"/>`)) {
    throw new Error(`${file}: the full-card base does not use the expected background`);
  }
  const artworkStart = svg.indexOf('<g id="artwork"');
  const artworkEnd = svg.indexOf('<rect id="gold-frame"', artworkStart);
  const artworkMarkup = svg.slice(artworkStart, artworkEnd);
  if (artworkMarkup.includes('fill="url(#nightPaper)"') || artworkMarkup.includes('fill="#f2eee6"')) {
    throw new Error(`${file}: a card background remains inside the artwork layer`);
  }
  if (/<rect\b/.test(artworkMarkup) || /background(?:-color)?\s*[:=]/i.test(artworkMarkup)) {
    throw new Error(`${file}: an independent artwork background surface remains`);
  }
  if (artworkMarkup.includes('M 5 260 Q 180 175 330 250') || artworkMarkup.includes('M 10 600 Q 170 520 325 590')) {
    throw new Error(`${file}: a legacy scene-tint background path remains in the artwork layer`);
  }
  const baseIndex = svg.indexOf('<g id="card-base"');
  const artworkIndex = svg.indexOf('<g id="artwork"');
  const frameIndex = svg.indexOf('<rect id="gold-frame"');
  const copyIndex = svg.indexOf('<g id="card-copy"');
  if (!(baseIndex < artworkIndex && artworkIndex < frameIndex && frameIndex < copyIndex)) {
    throw new Error(`${file}: card layers are not ordered base → artwork → frame → copy`);
  }
  const titleAreaPanels = [...svg.matchAll(/<rect\b([^>]*)\/?\s*>/g)].filter(match => {
    const attrs = match[1];
    const readNumber = name => Number((attrs.match(new RegExp(`\\b${name}="([\\d.]+)"`)) || [])[1] || 0);
    const x = readNumber("x");
    const y = readNumber("y");
    const width = readNumber("width");
    const height = readNumber("height");
    const spansTitle = x <= 31 && width >= 550 && y < 1080 && y + height > 1080;
    const allowedBase = attrs.includes('data-layer="card-base"') || attrs.includes('fill="#f2eee6"') || attrs.includes('fill="url(#nightPaper)"');
    const allowedTexture = attrs.includes('filter="url(#grain)"');
    const allowedClip = !attrs.includes("fill=") && !attrs.includes("filter=") &&
      (attrs.includes('rx="23"') || attrs.includes('rx="30"'));
    const allowedBorder = attrs.includes('fill="none"');
    return spansTitle && !(allowedBase || allowedTexture || allowedClip || allowedBorder);
  });
  if (titleAreaPanels.length) throw new Error(`${file}: a separate title-area rectangle remains`);
}

const manifestPath = path.join("assets", "deck-01", "minor-build-manifest.json");
if (!fs.existsSync(manifestPath)) throw new Error("Minor Arcana build manifest is missing");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
if (manifest.count !== 56 || manifest.files.length !== 56) throw new Error("Minor Arcana build manifest must contain 56 files");
for (const record of manifest.files) {
  const actual = crypto.createHash("sha256").update(fs.readFileSync(record.path)).digest("hex");
  if (actual !== record.sha256) throw new Error(`${record.path}: hash differs from the current build manifest`);
}

for (const card of cards) {
  for (const orientation of ["upright", "reversed"]) {
    if (!Array.isArray(card[orientation].keywords) || card[orientation].keywords.length < 3) {
      throw new Error(`${card.id}: keywords are missing`);
    }
    if (!card[orientation].meaning) throw new Error(`${card.id}: meaning is missing`);
  }
  for (const deck of decks) {
    const deckCard = deck.cards[card.id];
    if (!deckCard) throw new Error(`${deck.id}/${card.id}: deck data is missing`);
    if (!deckCard.uprightQuestion || !deckCard.reversedQuestion) throw new Error(`${deck.id}/${card.id}: question is missing`);
    if (deckCard.uprightQuestion === deckCard.reversedQuestion) throw new Error(`${deck.id}/${card.id}: questions must differ`);
    const imagePath = path.join(process.cwd(), deckCard.image.replace(/^\.\//, ""));
    if (!fs.existsSync(imagePath)) throw new Error(`${deck.id}/${card.id}: image not found`);
    const dimensions = execFileSync("identify", ["-format", "%wx%h", imagePath], { encoding: "utf8" });
    if (dimensions !== "612x1206") throw new Error(`${deck.id}/${card.id}: expected 612x1206, got ${dimensions}`);
  }
}

for (const deck of decks) {
  if (!deck.backImage) throw new Error(`${deck.id}: deck-level back image is missing`);
  const backImagePath = path.join(process.cwd(), deck.backImage.replace(/^\.\//, ""));
  if (!fs.existsSync(backImagePath)) throw new Error(`${deck.id}: back image not found`);
  const dimensions = execFileSync("identify", ["-format", "%wx%h", backImagePath], { encoding: "utf8" });
  if (dimensions !== "612x1206") throw new Error(`${deck.id}: back image must be 612x1206, got ${dimensions}`);
}

for (const required of ["index.html", "styles.css", "app.js", "service-worker.js", "manifest.webmanifest"]) {
  if (!fs.existsSync(required)) throw new Error(`${required}: required PWA file is missing`);
}

const appSource = fs.readFileSync("app.js", "utf8");
if (appSource.includes("Asia/Tokyo") || appSource.includes("TOKYO_TZ")) {
  throw new Error("The daily boundary must use the device's local date, not a fixed timezone");
}
if (!appSource.includes('deck.backImage') || appSource.includes('drawBack.classList.add("is-reversed")')) {
  throw new Error("The pre-draw card back must come from the selected deck and remain upright");
}

for (const icon of ["icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"]) {
  if (!fs.existsSync(path.join("assets/icons", icon))) throw new Error(`${icon}: app icon is missing`);
}

const serviceWorkerSource = fs.readFileSync("service-worker.js", "utf8");
const cachedPaths = [...serviceWorkerSource.matchAll(/"\.\/(.+?)"/g)].map(match => match[1]);
for (const cachedPath of cachedPaths.filter(item => !item.includes("${"))) {
  if (!fs.existsSync(cachedPath)) throw new Error(`${cachedPath}: offline cache target is missing`);
}
for (const deck of decks) {
  const backImagePath = deck.backImage.replace(/^\.\//, "");
  if (!cachedPaths.includes(backImagePath)) throw new Error(`${backImagePath}: deck back is missing from the offline cache`);
  for (const deckCard of Object.values(deck.cards)) {
    const imagePath = deckCard.image.replace(/^\.\//, "");
    const isMinorGenerated = /assets\/deck-01\/(wands|cups|swords|pentacles)-/.test(imagePath) && serviceWorkerSource.includes("...MINOR_ARCANA");
    if (!cachedPaths.includes(imagePath) && !isMinorGenerated) throw new Error(`${imagePath}: deck image is missing from the offline cache`);
  }
}

console.log(`Validated ${cards.length} cards across ${decks.length} complete deck(s), including all 56 Minor Arcana title areas.`);
