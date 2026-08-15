const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const initCall = appSource.lastIndexOf("\n  init().catch");
if (initCall < 0) throw new Error("app.jsのテスト用読込位置を特定できません");

const testSource = `${appSource.slice(0, initCall)}
  globalThis.__CONTENT_TEST_HOOKS = { resolveCardContent, createSnapshot };
})();`;
const sandbox = {
  console,
  document: {
    querySelector: () => ({}),
    querySelectorAll: () => []
  },
  window: {}
};
vm.createContext(sandbox);
vm.runInContext(testSource, sandbox, { filename: "app.js" });

const rwsCards = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "rws-cards.json"), "utf8"));
const deck = JSON.parse(fs.readFileSync(path.join(ROOT, "decks", "deck-01", "deck.json"), "utf8"));
const overrides = JSON.parse(fs.readFileSync(path.join(ROOT, "decks", "deck-01", "content.json"), "utf8"));
const { resolveCardContent, createSnapshot } = sandbox.__CONTENT_TEST_HOOKS;

function mergedDeckFor(cardId, orientation) {
  const copy = JSON.parse(JSON.stringify(deck));
  copy.cards[cardId][orientation] = {
    ...copy.cards[cardId][orientation],
    ...overrides.cards[cardId][orientation]
  };
  return copy;
}

for (const cardId of ["major-09", "wands-ace", "cups-05", "swords-10", "pentacles-09"]) {
  const card = rwsCards.find(item => item.cardId === cardId);
  const mergedDeck = mergedDeckFor(cardId, "upright");
  const resolved = resolveCardContent(card, mergedDeck, "upright");
  const expected = overrides.cards[cardId].upright;
  if (JSON.stringify(resolved.keywords) !== JSON.stringify(expected.keywords)) {
    throw new Error(`${cardId}: keywordsがDeck固有コンテンツから解決されていません`);
  }
  if (resolved.meaning !== expected.meaning) {
    throw new Error(`${cardId}: meaningがDeck固有コンテンツから解決されていません`);
  }
  if (resolved.question !== deck.cards[cardId].upright.question) {
    throw new Error(`${cardId}: questionがdeck.jsonの既存データから解決されていません`);
  }
}

const fallbackCard = rwsCards.find(item => item.cardId === "wands-ace");
const fallbackContent = resolveCardContent(fallbackCard, deck, "upright");
if (JSON.stringify(fallbackContent.keywords) !== JSON.stringify(fallbackCard.upright.keywords)) {
  throw new Error("fallback keywordsが共有RWSデータから解決されていません");
}
if (fallbackContent.meaning !== fallbackCard.upright.meaning) {
  throw new Error("fallback meaningが共有RWSデータから解決されていません");
}
if (fallbackContent.question !== deck.cards[fallbackCard.cardId].upright.question) {
  throw new Error("fallback questionがDeck固有データから解決されていません");
}

const snapshotCard = rwsCards.find(item => item.cardId === "pentacles-09");
const snapshotDeck = mergedDeckFor(snapshotCard.cardId, "upright");
const snapshotContent = resolveCardContent(snapshotCard, snapshotDeck, "upright");
const snapshot = createSnapshot(snapshotCard, snapshotDeck, "upright");
if (
  snapshot.meaning !== snapshotContent.meaning ||
  snapshot.question !== snapshotContent.question ||
  JSON.stringify(snapshot.keywords) !== JSON.stringify(snapshotContent.keywords)
) {
  throw new Error("snapshotが実際に解決されたDeck固有コンテンツを保存していません");
}

if (Object.keys(overrides.cards).length !== 78) {
  throw new Error(`Deck 01 content overrideは78枚必要です（現在${Object.keys(overrides.cards).length}枚）`);
}

console.log("Deck-specific content resolves for Major and all Minor suits; fallback remains supported; questions stay in deck.json; snapshot preserves resolved copy.");
