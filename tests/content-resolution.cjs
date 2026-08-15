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

const cardCore = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "rws-cards.json"), "utf8"));
const deck = JSON.parse(fs.readFileSync(path.join(ROOT, "decks", "deck-01", "deck.json"), "utf8"));
const content = JSON.parse(fs.readFileSync(path.join(ROOT, "decks", "deck-01", "content.json"), "utf8"));
const { resolveCardContent, createSnapshot } = sandbox.__CONTENT_TEST_HOOKS;

function mergedDeckFor(cardId, orientation) {
  const copy = JSON.parse(JSON.stringify(deck));
  copy.cards[cardId][orientation] = {
    ...copy.cards[cardId][orientation],
    ...content.cards[cardId][orientation]
  };
  return copy;
}

if (cardCore.length !== 78) throw new Error(`CARD COREは78枚必要です（現在${cardCore.length}枚）`);
if (Object.keys(content.cards).length !== 78) throw new Error(`Deck 01 contentは78枚必要です（現在${Object.keys(content.cards).length}枚）`);

for (const card of cardCore) {
  for (const orientation of ["upright", "reversed"]) {
    const core = card[orientation];
    if (!Array.isArray(core?.themes) || !core.themes.length) {
      throw new Error(`${card.cardId}/${orientation}: CARD CORE themesがありません`);
    }
    if (Object.prototype.hasOwnProperty.call(core, "keywords") || Object.prototype.hasOwnProperty.call(core, "meaning")) {
      throw new Error(`${card.cardId}/${orientation}: CARD COREに表示用keywords/meaningが残っています`);
    }
  }
}

for (const cardId of ["major-09", "wands-ace", "cups-05", "swords-10", "pentacles-09"]) {
  const card = cardCore.find(item => item.cardId === cardId);
  for (const orientation of ["upright", "reversed"]) {
    const mergedDeck = mergedDeckFor(cardId, orientation);
    const resolved = resolveCardContent(card, mergedDeck, orientation);
    const expected = content.cards[cardId][orientation];
    if (JSON.stringify(resolved.keywords) !== JSON.stringify(expected.keywords)) {
      throw new Error(`${cardId}/${orientation}: keywordsがDeck固有コンテンツから解決されていません`);
    }
    if (resolved.meaning !== expected.meaning) {
      throw new Error(`${cardId}/${orientation}: meaningがDeck固有コンテンツから解決されていません`);
    }
    const expectedQuestion = expected.question || deck.cards[cardId][orientation].question;
    if (resolved.question !== expectedQuestion) {
      throw new Error(`${cardId}/${orientation}: questionがDeck固有データから解決されていません`);
    }
  }
}

const incompleteCard = cardCore.find(item => item.cardId === "wands-ace");
let missingDisplayFailed = false;
try {
  resolveCardContent(incompleteCard, deck, "upright");
} catch (error) {
  missingDisplayFailed = /表示データが不完全/.test(error.message);
}
if (!missingDisplayFailed) {
  throw new Error("Deck固有keywords/meaningがない場合に共有CARD COREへfallbackしています");
}

const snapshotCard = cardCore.find(item => item.cardId === "pentacles-09");
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

console.log("Deck-specific content resolves for all suits; card core contains semantic themes only; missing deck display content fails; snapshot preserves resolved copy.");
