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

const major = rwsCards.find(item => item.cardId === "major-09");
const majorDeckCard = deck.cards[major.cardId];
majorDeckCard.upright = {
  ...majorDeckCard.upright,
  ...overrides.cards[major.cardId].upright
};
const majorContent = resolveCardContent(major, deck, "upright");
if (JSON.stringify(majorContent.keywords) !== JSON.stringify(overrides.cards[major.cardId].upright.keywords)) {
  throw new Error("Major keywordsがDeck固有コンテンツから解決されていません");
}
if (majorContent.meaning !== overrides.cards[major.cardId].upright.meaning) {
  throw new Error("Major meaningがDeck固有コンテンツから解決されていません");
}
if (majorContent.question !== overrides.cards[major.cardId].upright.question) {
  throw new Error("Major questionがDeck固有コンテンツから解決されていません");
}

const minor = rwsCards.find(item => item.cardId === "wands-ace");
const minorContent = resolveCardContent(minor, deck, "upright");
if (JSON.stringify(minorContent.keywords) !== JSON.stringify(minor.upright.keywords)) {
  throw new Error("未移行Minor keywordsがRWS fallbackから解決されていません");
}
if (minorContent.meaning !== minor.upright.meaning) {
  throw new Error("未移行Minor meaningがRWS fallbackから解決されていません");
}
if (minorContent.question !== deck.cards[minor.cardId].upright.question) {
  throw new Error("未移行Minor questionがDeck固有データから解決されていません");
}

const snapshot = createSnapshot(major, deck, "upright");
if (
  snapshot.meaning !== majorContent.meaning ||
  snapshot.question !== majorContent.question ||
  JSON.stringify(snapshot.keywords) !== JSON.stringify(majorContent.keywords)
) {
  throw new Error("snapshotが実際に解決されたDeck固有コンテンツを保存していません");
}

console.log("Deck-specific Major content wins; unmigrated Minor content falls back to shared RWS data; snapshot preserves resolved copy.");
