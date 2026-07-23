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
const card = rwsCards.find(item => item.cardId === "major-09");
const deckCard = deck.cards[card.cardId];
deckCard.upright.keywords = ["デッキ側の誤った値"];
deckCard.upright.meaning = "デッキ側の誤った値";

const { resolveCardContent, createSnapshot } = sandbox.__CONTENT_TEST_HOOKS;
const content = resolveCardContent(card, deck, "upright");
if (JSON.stringify(content.keywords) !== JSON.stringify(card.upright.keywords)) {
  throw new Error("keywordsがRWS共通データから解決されていません");
}
if (content.meaning !== card.upright.meaning) {
  throw new Error("meaningがRWS共通データから解決されていません");
}
if (content.question !== deckCard.upright.question) {
  throw new Error("questionがデッキ固有データから解決されていません");
}

const snapshot = createSnapshot(card, deck, "upright");
if (
  snapshot.meaning !== card.upright.meaning ||
  snapshot.question !== deckCard.upright.question ||
  JSON.stringify(snapshot.keywords) !== JSON.stringify(card.upright.keywords)
) {
  throw new Error("snapshotが共通RWSとデッキ固有コンテンツを正しく保存していません");
}

console.log("Resolved keywords / meaning from shared RWS data and question from Deck 01; snapshot responsibilities are preserved.");
