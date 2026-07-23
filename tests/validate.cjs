const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const readJson = relativePath => JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
const sha256 = value => crypto.createHash("sha256").update(value).digest("hex");

execFileSync(process.execPath, [path.join(ROOT, "tools", "validate-deck.cjs")], {
  cwd: ROOT,
  stdio: "inherit"
});

const rwsCards = readJson("data/rws-cards.json");
const deck = readJson("decks/deck-01/deck.json");
const baseline = readJson("tests/deck-01-migration-baseline.json");
const template = readJson("decks/_template/deck.json");

const canonicalContent = rwsCards.map(card => ({
  ...card,
  visualMotif: deck.cards[card.cardId].visualMotif,
  upright: deck.cards[card.cardId].upright,
  reversed: deck.cards[card.cardId].reversed
}));
if (sha256(JSON.stringify(canonicalContent)) !== baseline.contentSha256) {
  throw new Error("Deck 01の文章またはRWS識別情報が移行時の正本から変わっています");
}

for (const [file, expectedHash] of Object.entries(baseline.images)) {
  const relativePath = file === "card-back.png"
    ? "decks/deck-01/back.png"
    : `decks/deck-01/cards/${file}`;
  const actualHash = sha256(fs.readFileSync(path.join(ROOT, relativePath)));
  if (actualHash !== expectedHash) throw new Error(`${relativePath}: Deck 01画像が正本から変わっています`);
}

for (const [file, expectedHash] of Object.entries(baseline.unchangedAssets)) {
  const actualHash = sha256(fs.readFileSync(path.join(ROOT, file)));
  if (actualHash !== expectedHash) throw new Error(`${file}: UIまたは共通アセットが意図せず変わっています`);
}

const expectedIds = rwsCards.map(card => card.cardId);
if (Object.keys(template.cards).join(",") !== expectedIds.join(",")) {
  throw new Error("_template/deck.jsonにRWS 78 IDが揃っていません");
}

for (const required of [
  "index.html",
  "styles.css",
  "app.js",
  "service-worker.js",
  "manifest.webmanifest",
  "data/rws-cards.json",
  "decks/index.json"
]) {
  if (!fs.existsSync(path.join(ROOT, required))) throw new Error(`${required}: 必須ファイルがありません`);
}

const indexSource = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
if (/src="\/|href="\//.test(indexSource)) throw new Error("index.htmlにGitHub Pages非互換の絶対パスがあります");
if (/data\/cards\.js|data\/minor-cards\.js|deck-01(?:-minor)?\.js/.test(indexSource)) {
  throw new Error("index.htmlに旧Deck 01専用scriptが残っています");
}

const appSource = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
if (appSource.includes("Asia/Tokyo") || appSource.includes("TOKYO_TZ")) {
  throw new Error("日付境界は固定タイムゾーンではなく端末現地時間を使う必要があります");
}
if (!appSource.includes('const DB_VERSION = 1;')) throw new Error("既存IndexedDBのDB versionが変わっています");
for (const requiredFragment of [
  '"./data/rws-cards.json"',
  '"./decks/index.json"',
  "deckContentVersion",
  "snapshot: createSnapshot",
  "version: 2"
]) {
  if (!appSource.includes(requiredFragment)) throw new Error(`app.jsに ${requiredFragment} がありません`);
}
if (/uprightQuestion|reversedQuestion/.test(appSource)) {
  throw new Error("app.jsが旧Deck 01固有question形式を参照しています");
}

const serviceWorkerSource = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
if (!serviceWorkerSource.includes("cacheRegisteredDecks") || !serviceWorkerSource.includes("./decks/index.json")) {
  throw new Error("Service Workerが登録デッキを動的にキャッシュしません");
}
if (serviceWorkerSource.includes("deck-01")) {
  throw new Error("Service WorkerにDeck 01の直書きが残っています");
}

console.log("Validated Deck 01 migration, UI asset integrity, JSON loading, history v1/v2 compatibility hooks, and dynamic PWA caching.");
