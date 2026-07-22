const CACHE_NAME = "one-card-matte-ui-v12";
const MINOR_ARCANA = ["wands", "cups", "swords", "pentacles"].flatMap(suit =>
  ["ace", "02", "03", "04", "05", "06", "07", "08", "09", "10", "page", "knight", "queen", "king"]
    .map(rank => `./assets/deck-01/${suit}-${rank}.png`)
);
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./data/cards.js",
  "./data/minor-cards.js",
  "./decks/deck-01.js",
  "./decks/deck-01-minor.js",
  "./assets/fonts/HakkouMincho.ttf",
  "./assets/brand/prism-star-transparent.png",
  "./assets/deck-01/card-back.png",
  "./assets/deck-01/major-00.png",
  "./assets/deck-01/major-01.png",
  "./assets/deck-01/major-02.png",
  "./assets/deck-01/major-03.png",
  "./assets/deck-01/major-04.png",
  "./assets/deck-01/major-05.png",
  "./assets/deck-01/major-06.png",
  "./assets/deck-01/major-07.png",
  "./assets/deck-01/major-08.png",
  "./assets/deck-01/major-09.png",
  "./assets/deck-01/major-10.png",
  "./assets/deck-01/major-11.png",
  "./assets/deck-01/major-12.png",
  "./assets/deck-01/major-13.png",
  "./assets/deck-01/major-14.png",
  "./assets/deck-01/major-15.png",
  "./assets/deck-01/major-16.png",
  "./assets/deck-01/major-17.png",
  "./assets/deck-01/major-18.png",
  "./assets/deck-01/major-19.png",
  "./assets/deck-01/major-20.png",
  "./assets/deck-01/major-21.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/icons/apple-touch-icon.png",
  ...MINOR_ARCANA
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.pathname.includes("/assets/deck-01/")) {
    event.respondWith(
      fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match("./index.html")))
  );
});
