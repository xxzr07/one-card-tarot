#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const CORE_PATH = path.join(ROOT, "data", "rws-cards.json");
const INDEX_PATH = path.join(ROOT, "decks", "index.json");
const ORIENTATIONS = ["upright", "reversed"];

function fail(message) {
  throw new Error(message);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(`${path.relative(ROOT, file)}: JSONを読み込めません (${error.message})`);
  }
}

function isFilledString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isFilledStringArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every(isFilledString);
}

function resolveInsideDeck(deckDirectory, relativePath, label) {
  if (!isFilledString(relativePath)) fail(`${label}: パスが空です`);
  const resolved = path.resolve(deckDirectory, relativePath);
  const relative = path.relative(deckDirectory, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    fail(`${label}: デッキフォルダ外を参照しています`);
  }
  if (!fs.existsSync(resolved)) fail(`${label}: ${relativePath} が存在しません`);
  return resolved;
}

function imageInfo(file, label) {
  const header = fs.readFileSync(file).subarray(0, 24);
  const signature = "89504e470d0a1a0a";
  if (header.length < 24 || header.subarray(0, 8).toString("hex") !== signature || header.subarray(12, 16).toString("ascii") !== "IHDR") {
    fail(`${label}: PNGとして読み込めません`);
  }
  return {
    format: "png",
    width: header.readUInt32BE(16),
    height: header.readUInt32BE(20)
  };
}

function expectedCardIds() {
  const majorIds = Array.from({ length: 22 }, (_, index) => `major-${String(index).padStart(2, "0")}`);
  const ranks = ["ace", "02", "03", "04", "05", "06", "07", "08", "09", "10", "page", "knight", "queen", "king"];
  const minorIds = ["wands", "cups", "swords", "pentacles"].flatMap(suit => ranks.map(rank => `${suit}-${rank}`));
  return [...majorIds, ...minorIds];
}

function validateCardCore(cards) {
  if (!Array.isArray(cards) || cards.length !== 78) fail("rws-cards.json: CARD COREは78件ちょうど必要です");
  const ids = cards.map(card => card.cardId);
  if (new Set(ids).size !== 78) fail("rws-cards.json: cardIdが重複しています");
  const expectedIds = expectedCardIds();
  if (ids.join(",") !== expectedIds.join(",")) fail("rws-cards.json: 78 IDの順序または内容が標準一覧と一致しません");

  for (const card of cards) {
    for (const field of ["cardId", "number", "nameEn", "suit", "rank"]) {
      if (!isFilledString(card[field])) fail(`${card.cardId || "unknown"}: CARD CORE ${field} が空です`);
    }
    for (const orientation of ORIENTATIONS) {
      const core = card[orientation];
      if (!core) fail(`${card.cardId}/${orientation}: CARD COREデータがありません`);
      if (!isFilledStringArray(core.themes)) fail(`${card.cardId}/${orientation}: themesが不完全です`);
      if (Object.prototype.hasOwnProperty.call(core, "keywords") || Object.prototype.hasOwnProperty.call(core, "meaning")) {
        fail(`${card.cardId}/${orientation}: CARD COREにユーザー表示用keywords/meaningを置かないでください`);
      }
    }
  }
  return expectedIds;
}

function readCompleteDeckContent(deckDirectory, deckId, expectedIds) {
  const file = path.join(deckDirectory, "content.json");
  if (!fs.existsSync(file)) fail(`${deckId}: content.jsonが必要です。表示用keywords/meaningはDeckが78枚すべて所有してください`);
  const contentFile = readJson(file);
  if (contentFile.schemaVersion !== 1) fail(`${deckId}/content.json: schemaVersionは1にしてください`);
  if (!/^\d+\.\d+\.\d+$/.test(contentFile.contentVersion || "")) {
    fail(`${deckId}/content.json: contentVersionは1.0.0形式にしてください`);
  }
  if (!contentFile.cards || typeof contentFile.cards !== "object" || Array.isArray(contentFile.cards)) {
    fail(`${deckId}/content.json: cardsがありません`);
  }

  const ids = Object.keys(contentFile.cards);
  const missing = expectedIds.filter(cardId => !ids.includes(cardId));
  const extra = ids.filter(cardId => !expectedIds.includes(cardId));
  if (missing.length || extra.length || ids.length !== 78) {
    fail(`${deckId}/content.json: 78枚すべてのDeck固有文章が必要です missing=[${missing}] extra=[${extra}]`);
  }

  for (const cardId of expectedIds) {
    const card = contentFile.cards[cardId];
    for (const orientation of ORIENTATIONS) {
      const content = card?.[orientation];
      if (!content) fail(`${deckId}/content.json/${cardId}/${orientation}: データがありません`);
      if (!isFilledStringArray(content.keywords)) fail(`${deckId}/content.json/${cardId}/${orientation}: keywordsが不完全です`);
      if (!isFilledString(content.meaning)) fail(`${deckId}/content.json/${cardId}/${orientation}: meaningが空です`);
      if (Object.prototype.hasOwnProperty.call(content, "question") && !isFilledString(content.question)) {
        fail(`${deckId}/content.json/${cardId}/${orientation}: questionを指定する場合は空にできません`);
      }
    }
  }
  return contentFile;
}

function validateDeck(deckId, expectedIds, index) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(deckId)) fail(`${deckId}: Deck IDの形式が不正です`);
  const registration = index.decks.find(entry => entry.id === deckId);
  const manifestPath = registration
    ? path.resolve(path.dirname(INDEX_PATH), registration.manifest)
    : path.join(ROOT, "decks", deckId, "deck.json");
  if (!fs.existsSync(manifestPath)) fail(`${deckId}: deck.jsonが見つかりません`);

  const deckDirectory = path.dirname(manifestPath);
  const deck = readJson(manifestPath);
  if (deck.schemaVersion !== 2) fail(`${deckId}: schemaVersionは2にしてください`);
  if (deck.id !== deckId) fail(`${deckId}: deck.json内のIDが一致しません`);
  if (!/^\d+\.\d+\.\d+$/.test(deck.contentVersion || "")) fail(`${deckId}: contentVersionは1.0.0形式にしてください`);
  for (const field of ["name", "subtitle", "description", "previewCardId", "backImage"]) {
    if (!isFilledString(deck[field])) fail(`${deckId}: ${field}が空です`);
  }
  if (!expectedIds.includes(deck.previewCardId)) fail(`${deckId}: previewCardIdがCARD CORE 78 IDに含まれません`);
  if (!deck.imageSpec || !Number.isInteger(deck.imageSpec.width) || !Number.isInteger(deck.imageSpec.height) || deck.imageSpec.format !== "png") {
    fail(`${deckId}: imageSpecはwidth / height / format: pngを指定してください`);
  }

  const deckIds = Object.keys(deck.cards || {});
  const missingDeckIds = expectedIds.filter(cardId => !deckIds.includes(cardId));
  const extraDeckIds = deckIds.filter(cardId => !expectedIds.includes(cardId));
  if (deckIds.length !== 78 || missingDeckIds.length || extraDeckIds.length) {
    fail(`${deckId}: cardsはCARD CORE 78 IDと完全一致させてください missing=[${missingDeckIds}] extra=[${extraDeckIds}]`);
  }

  const contentFile = readCompleteDeckContent(deckDirectory, deckId, expectedIds);
  const contentCards = contentFile.cards;

  const backPath = resolveInsideDeck(deckDirectory, deck.backImage, `${deckId}/backImage`);
  const back = imageInfo(backPath, `${deckId}/backImage`);
  if (back.format !== "png" || back.width !== deck.imageSpec.width || back.height !== deck.imageSpec.height) {
    fail(`${deckId}/backImage: ${deck.imageSpec.width}x${deck.imageSpec.height} PNGではありません`);
  }

  const resolvedImages = new Set();
  for (const cardId of expectedIds) {
    const card = deck.cards[cardId];
    if (!isFilledString(card.visualMotif)) fail(`${deckId}/${cardId}: visualMotifが空です`);
    const imagePath = resolveInsideDeck(deckDirectory, card.image, `${deckId}/${cardId}/image`);
    if (path.basename(imagePath) !== `${cardId}.png`) fail(`${deckId}/${cardId}: cardIdと画像ファイル名が一致しません`);
    if (resolvedImages.has(imagePath)) fail(`${deckId}/${cardId}: 同じ画像が重複して参照されています`);
    resolvedImages.add(imagePath);
    const image = imageInfo(imagePath, `${deckId}/${cardId}/image`);
    if (image.format !== "png" || image.width !== deck.imageSpec.width || image.height !== deck.imageSpec.height) {
      fail(`${deckId}/${cardId}: ${deck.imageSpec.width}x${deck.imageSpec.height} PNGではありません`);
    }

    for (const orientation of ORIENTATIONS) {
      const baseContent = card[orientation];
      if (!baseContent || !isFilledString(baseContent.question)) {
        fail(`${deckId}/${cardId}/${orientation}: deck.jsonのquestionが空です`);
      }
      const displayContent = contentCards[cardId][orientation];
      const question = displayContent.question || baseContent.question;
      if (!isFilledStringArray(displayContent.keywords)) fail(`${deckId}/${cardId}/${orientation}: Deck固有keywordsが不完全です`);
      if (!isFilledString(displayContent.meaning)) fail(`${deckId}/${cardId}/${orientation}: Deck固有meaningが空です`);
      if (!isFilledString(question)) fail(`${deckId}/${cardId}/${orientation}: questionが空です`);
    }
  }

  const cardsDirectory = path.join(deckDirectory, "cards");
  if (!fs.existsSync(cardsDirectory)) fail(`${deckId}: cards/がありません`);
  const pngFiles = fs.readdirSync(cardsDirectory).filter(file => file.toLowerCase().endsWith(".png"));
  if (pngFiles.length !== 78) fail(`${deckId}: cards/内のPNGは78枚必要です（現在${pngFiles.length}枚）`);
  if (resolvedImages.size !== 78) fail(`${deckId}: 78枚すべてが一意に参照されていません`);

  console.log(`✓ ${deckId}: 78 cards + back.png (${contentFile.contentVersion}; complete deck-owned content)`);
}

const cardCore = readJson(CORE_PATH);
const expectedIds = validateCardCore(cardCore);
const index = readJson(INDEX_PATH);
if (!Array.isArray(index.decks) || !index.decks.length) fail("decks/index.json: decksが空です");
const registeredIds = index.decks.map(entry => entry.id);
if (new Set(registeredIds).size !== registeredIds.length) fail("decks/index.json: Deck IDが重複しています");
if (!registeredIds.includes(index.defaultDeckId)) fail("decks/index.json: defaultDeckIdが登録されていません");

const requestedDeckId = process.argv[2];
const targets = requestedDeckId
  ? [requestedDeckId]
  : index.decks.filter(entry => entry.enabled !== false).map(entry => entry.id);
for (const deckId of targets) validateDeck(deckId, expectedIds, index);
console.log(`Validated ${targets.length} deck(s) against the 78-card core with complete deck-owned display content.`);
