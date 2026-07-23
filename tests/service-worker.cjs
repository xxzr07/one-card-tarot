const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const SCOPE = "https://example.test/one-card-tarot/";
const listeners = new Map();
const stored = new Map();
const deletedCaches = [];

function keyOf(request) {
  return typeof request === "string" ? request : request.url;
}

async function localFetch(request) {
  const url = new URL(keyOf(request), SCOPE);
  let relative = url.pathname.replace(/^\/one-card-tarot\/?/, "");
  if (!relative) relative = "index.html";
  const file = path.join(ROOT, relative);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    return new Response("not found", { status: 404 });
  }
  return new Response(fs.readFileSync(file), { status: 200 });
}

const cache = {
  async addAll(requests) {
    for (const request of requests) {
      const response = await localFetch(request);
      if (!response.ok) throw new Error(`Cache target failed: ${keyOf(request)}`);
      stored.set(keyOf(request), response.clone());
    }
  },
  async put(request, response) {
    stored.set(keyOf(request), response);
  },
  async match(request) {
    return stored.get(keyOf(request));
  }
};

const sandbox = {
  URL,
  Response,
  fetch: localFetch,
  caches: {
    open: async () => cache,
    keys: async () => ["one-card-matte-ui-v12", "one-card-content-v13"],
    delete: async name => {
      deletedCaches.push(name);
      return true;
    },
    match: request => cache.match(request)
  },
  self: {
    registration: { scope: SCOPE },
    clients: { claim: async () => {} },
    skipWaiting: () => {},
    addEventListener(type, listener) {
      listeners.set(type, listener);
    }
  }
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8"), sandbox, {
  filename: "service-worker.js"
});

async function dispatchWaitable(type, data) {
  let pending;
  listeners.get(type)({
    data,
    waitUntil(promise) {
      pending = promise;
    }
  });
  await pending;
}

(async () => {
  await dispatchWaitable("install");
  await dispatchWaitable("activate");
  const expectedDeckAssets = [
    `${SCOPE}decks/index.json`,
    `${SCOPE}decks/deck-01/deck.json`,
    `${SCOPE}decks/deck-01/back.png`,
    ...Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, "decks/deck-01/deck.json"), "utf8")).cards)
      .map(cardId => `${SCOPE}decks/deck-01/cards/${cardId}.png`)
  ];
  const missing = expectedDeckAssets.filter(url => !stored.has(url));
  if (missing.length) throw new Error(`Dynamic deck precache is missing ${missing.length} assets`);
  if (![...stored.keys()].every(url => url.startsWith(SCOPE))) {
    throw new Error("A cache URL escaped the GitHub Pages project scope");
  }
  if (!deletedCaches.includes("one-card-matte-ui-v12")) {
    throw new Error("The previous cache was not removed before warming the moved deck assets");
  }

  await dispatchWaitable("message", { type: "CACHE_DECKS" });
  console.log(`Service Worker cached ${stored.size} project-scoped resources, including Deck 01 manifest, back, and 78 faces.`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
