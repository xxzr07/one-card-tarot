const CACHE_NAME = "one-card-content-v16";
const scopeUrl = self.registration.scope;
const deckIndexUrl = new URL("./decks/index.json", scopeUrl).href;
const indexUrl = new URL("./index.html", scopeUrl).href;
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./data/rws-cards.json",
  "./assets/fonts/HakkouMincho.ttf",
  "./assets/brand/prism-star-transparent.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/icons/apple-touch-icon.png"
].map(path => new URL(path, scopeUrl).href);

async function cacheRegisteredDecks(cache, includeCardFaces = true) {
  const indexResponse = await fetch(deckIndexUrl, { cache: "no-store" });
  if (!indexResponse.ok) throw new Error("Deck index could not be cached");
  await cache.put(deckIndexUrl, indexResponse.clone());
  const deckIndex = await indexResponse.json();

  for (const entry of deckIndex.decks.filter(item => item.enabled !== false)) {
    const manifestUrl = new URL(entry.manifest, deckIndexUrl).href;
    const manifestResponse = await fetch(manifestUrl, { cache: "no-store" });
    if (!manifestResponse.ok) throw new Error(`${entry.id}: deck manifest could not be cached`);
    await cache.put(manifestUrl, manifestResponse.clone());
    const deck = await manifestResponse.json();
    const assets = [
      new URL(deck.backImage, manifestUrl).href,
      ...(includeCardFaces ? Object.values(deck.cards).map(card => new URL(card.image, manifestUrl).href) : [])
    ];
    await cache.addAll(assets);
  }
}

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await cache.addAll(APP_SHELL);
      await cacheRegisteredDecks(cache, false);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(async keys => {
      await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
      await cacheRegisteredDecks(await caches.open(CACHE_NAME));
      await self.clients.claim();
    })
  );
});

self.addEventListener("message", event => {
  if (event.data?.type !== "CACHE_DECKS") return;
  event.waitUntil(caches.open(CACHE_NAME).then(cacheRegisteredDecks));
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const isDeckContent = url.href === deckIndexUrl || url.pathname.includes("/decks/");

  if (isDeckContent) {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)));
        }
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)));
      }
      return response;
    }).catch(() => caches.match(indexUrl)))
  );
});
