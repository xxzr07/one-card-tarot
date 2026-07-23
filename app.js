(() => {
  "use strict";

  const DB_NAME = "one-card-tarot";
  const DB_VERSION = 1;
  const STORE_NAME = "readings";

  const state = {
    selectedDeckIndex: 0,
    viewingDeckId: null,
    activeReading: null,
    calendarDate: new Date(),
    history: [],
    lastDateKey: null
  };

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];

  const els = {
    todayLabel: $("#today-label"),
    preDraw: $("#pre-draw"),
    deckPreview: $("#deck-preview"),
    deckPrev: $("#deck-prev"),
    deckNext: $("#deck-next"),
    drawStage: $("#draw-stage"),
    drawCard: $("#draw-card"),
    drawBack: $("#draw-stage .card-back"),
    drawFront: $("#draw-stage .card-front"),
    reading: $("#reading"),
    readingCard: $("#reading-card"),
    readingDeck: $("#reading-deck"),
    readingNumber: $("#reading-number"),
    readingName: $("#reading-name"),
    readingOrientation: $("#reading-orientation"),
    readingKeywords: $("#reading-keywords"),
    readingMeaning: $("#reading-meaning"),
    readingQuestion: $("#reading-question"),
    alternateControls: $("#alternate-deck-controls"),
    returnToday: $("#return-today"),
    calendarTitle: $("#calendar-title"),
    calendarGrid: $("#calendar-grid"),
    historyEmpty: $("#history-empty"),
    exportData: $("#export-data"),
    importData: $("#import-data"),
    settingsStatus: $("#settings-status"),
    deckSummary: $("#deck-summary")
  };

  async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) throw new Error(`${url} を読み込めませんでした`);
    return response.json();
  }

  async function loadContent() {
    const deckIndexUrl = new URL("./decks/index.json", window.location.href);
    const [cards, deckIndex] = await Promise.all([
      fetchJson(new URL("./data/rws-cards.json", window.location.href)),
      fetchJson(deckIndexUrl)
    ]);
    const registrations = deckIndex.decks.filter(entry => entry.enabled !== false);
    const decks = await Promise.all(registrations.map(async entry => {
      const manifestUrl = new URL(entry.manifest, deckIndexUrl);
      const deck = await fetchJson(manifestUrl);
      if (deck.id !== entry.id) throw new Error(`${entry.id} のDeck IDが一致しません`);
      return {
        ...deck,
        backImage: new URL(deck.backImage, manifestUrl).href,
        cards: Object.fromEntries(Object.entries(deck.cards).map(([cardId, card]) => [
          cardId,
          { ...card, image: new URL(card.image, manifestUrl).href }
        ]))
      };
    }));
    if (!cards.length || !decks.length) throw new Error("利用できるカードまたはデッキがありません");

    window.CARD_DATA = cards;
    window.DECKS = decks;
    const defaultIndex = decks.findIndex(deck => deck.id === deckIndex.defaultDeckId);
    state.selectedDeckIndex = defaultIndex >= 0 ? defaultIndex : 0;
  }

  function localDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatToday() {
    return new Intl.DateTimeFormat("ja-JP", {
      month: "long",
      day: "numeric",
      weekday: "short"
    }).format(new Date());
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "date" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function dbGet(date) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(date);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async function dbGetAll() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result.sort((a, b) => a.date.localeCompare(b.date)));
      request.onerror = () => reject(request.error);
    });
  }

  async function dbPut(reading) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(reading);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  function currentDeck() {
    return window.DECKS[state.selectedDeckIndex];
  }

  function getDeck(deckId) {
    return window.DECKS.find(deck => deck.id === deckId);
  }

  function getCard(cardId) {
    return window.CARD_DATA.find(card => card.cardId === cardId);
  }

  function renderDeckPicker() {
    const deck = currentDeck();
    const name = document.createElement("h3");
    const subtitle = document.createElement("p");
    name.textContent = deck.name;
    subtitle.textContent = deck.subtitle;
    els.deckPreview.replaceChildren(name, subtitle);
    els.drawBack.style.setProperty("--card-back-image", `url('${deck.backImage}')`);
    els.drawBack.setAttribute("aria-label", `${deck.name}のカード裏面`);
    els.drawStage.setAttribute("aria-label", `${deck.name}のカード裏面`);
    const hasMultiple = window.DECKS.length > 1;
    els.deckPrev.disabled = !hasMultiple;
    els.deckNext.disabled = !hasMultiple;
    els.deckSummary.textContent = `${deck.name} · COMPLETE DECK · ${Object.keys(deck.cards).length} CARDS`;
  }

  function shiftDeck(direction) {
    const total = window.DECKS.length;
    state.selectedDeckIndex = (state.selectedDeckIndex + direction + total) % total;
    renderDeckPicker();
  }

  function randomItem(items) {
    if (window.crypto?.getRandomValues) {
      const values = new Uint32Array(1);
      window.crypto.getRandomValues(values);
      return items[values[0] % items.length];
    }
    return items[Math.floor(Math.random() * items.length)];
  }

  function randomOrientation() {
    if (window.crypto?.getRandomValues) {
      const values = new Uint8Array(1);
      window.crypto.getRandomValues(values);
      return values[0] % 2 === 0 ? "upright" : "reversed";
    }
    return Math.random() < .5 ? "upright" : "reversed";
  }

  function cardElement(cardId, deckId, orientation) {
    const deck = getDeck(deckId);
    const image = deck?.cards?.[cardId]?.image;
    if (!image) {
      const missing = document.createElement("div");
      missing.className = "tarot-card";
      missing.setAttribute("aria-label", "カード画像は準備中です");
      return missing;
    }
    const element = document.createElement("div");
    element.className = `tarot-card${orientation === "reversed" ? " is-reversed" : ""}`;
    element.style.setProperty("--card-image", `url('${image}')`);
    element.setAttribute("role", "img");
    element.setAttribute("aria-label", `${getCard(cardId).nameEn} ${orientation === "upright" ? "正位置" : "逆位置"}`);
    return element;
  }

  function createSnapshot(card, deck, orientation) {
    const content = deck.cards[card.cardId][orientation];
    return {
      deckName: deck.name,
      cardNumber: card.number,
      cardName: card.nameEn,
      keywords: [...content.keywords],
      meaning: content.meaning,
      question: content.question
    };
  }

  async function drawToday() {
    els.drawCard.disabled = true;
    const date = localDateKey();
    const existing = await dbGet(date);
    if (existing) {
      showReading(existing);
      return;
    }

    const deck = currentDeck();
    const availableCards = window.CARD_DATA.filter(card => deck.cards[card.cardId]);
    const card = randomItem(availableCards);
    const orientation = randomOrientation();
    const reading = {
      version: 2,
      date,
      cardId: card.cardId,
      orientation,
      deckId: deck.id,
      deckContentVersion: deck.contentVersion,
      snapshot: createSnapshot(card, deck, orientation),
      createdAt: new Date().toISOString()
    };

    els.drawFront.replaceChildren(cardElement(reading.cardId, reading.deckId, reading.orientation));
    els.drawStage.classList.add("is-flipped");
    await dbPut(reading);
    state.history = await dbGetAll();
    setTimeout(() => showReading(reading), 900);
  }

  function showReading(reading, viewingDeckId = reading.deckId, fromHistory = false) {
    const card = getCard(reading.cardId);
    const deck = getDeck(viewingDeckId) || getDeck(reading.deckId);
    const deckCard = deck.cards[reading.cardId];
    const useSnapshot = reading.version === 2 && deck.id === reading.deckId && reading.snapshot;
    const orientationData = useSnapshot ? reading.snapshot : deckCard[reading.orientation];
    const deckName = useSnapshot ? reading.snapshot.deckName : deck.name;
    const cardNumber = useSnapshot ? reading.snapshot.cardNumber : card.number;
    const cardName = useSnapshot ? reading.snapshot.cardName : card.nameEn;

    state.activeReading = reading;
    state.viewingDeckId = deck.id;
    els.preDraw.hidden = true;
    els.reading.hidden = false;
    els.readingCard.replaceChildren(cardElement(reading.cardId, deck.id, reading.orientation));
    els.readingDeck.textContent = `${reading.date} · ${deckName}${deck.id !== reading.deckId ? " · ALTERNATE VIEW" : ""}`;
    els.readingNumber.textContent = cardNumber;
    els.readingName.textContent = cardName;
    els.readingOrientation.textContent = reading.orientation === "upright" ? "正位置 · UPRIGHT" : "逆位置 · REVERSED";
    els.readingKeywords.innerHTML = orientationData.keywords.map(word => `<span class="keyword">${word}</span>`).join("");
    els.readingMeaning.textContent = orientationData.meaning;
    els.readingQuestion.textContent = orientationData.question;
    renderAlternateDecks(reading, deck.id);
    els.returnToday.hidden = !fromHistory;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderAlternateDecks(reading, viewingDeckId) {
    const alternatives = window.DECKS.filter(deck => deck.cards[reading.cardId]);
    els.alternateControls.replaceChildren();
    if (alternatives.length < 2) return;

    const label = document.createElement("p");
    label.className = "section-label";
    label.textContent = "VIEW THROUGH ANOTHER DECK";
    els.alternateControls.append(label);

    alternatives.forEach(deck => {
      const button = document.createElement("button");
      button.className = deck.id === viewingDeckId ? "primary-button" : "secondary-button";
      button.textContent = deck.name;
      button.disabled = deck.id === viewingDeckId;
      button.addEventListener("click", () => showReading(reading, deck.id, els.returnToday.hidden === false));
      els.alternateControls.append(button);
    });
  }

  function switchView(viewId, refreshToday = true) {
    $$(".view").forEach(view => view.classList.toggle("is-active", view.id === viewId));
    $$(".nav-button").forEach(button => button.classList.toggle("is-active", button.dataset.view === viewId));
    if (viewId === "history-view") renderCalendar();
    if (viewId === "today-view" && refreshToday) showTodayState();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function showTodayState() {
    const todayReading = await dbGet(localDateKey());
    els.drawStage.classList.remove("is-flipped");
    els.drawCard.disabled = false;
    els.returnToday.hidden = true;
    if (todayReading) {
      showReading(todayReading);
    } else {
      state.activeReading = null;
      els.preDraw.hidden = false;
      els.reading.hidden = true;
    }
  }

  function renderCalendar() {
    const year = state.calendarDate.getFullYear();
    const month = state.calendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const historyMap = new Map(state.history.map(item => [item.date, item]));
    const today = localDateKey();

    els.calendarTitle.textContent = `${year}年 ${month + 1}月`;
    els.calendarGrid.replaceChildren();
    for (let i = 0; i < firstDay; i += 1) {
      const empty = document.createElement("span");
      empty.className = "calendar-day is-empty";
      els.calendarGrid.append(empty);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const reading = historyMap.get(date);
      const button = document.createElement("button");
      button.className = `calendar-day${reading ? " has-reading" : ""}${date === today ? " is-today" : ""}`;
      button.textContent = day;
      button.disabled = !reading;
      if (reading) {
        const card = getCard(reading.cardId);
        button.setAttribute("aria-label", `${date} ${card?.nameEn || reading.cardId}`);
        button.addEventListener("click", () => {
          switchView("today-view", false);
          showReading(reading, reading.deckId, true);
        });
      }
      els.calendarGrid.append(button);
    }
    els.historyEmpty.hidden = state.history.length > 0;
  }

  function changeMonth(offset) {
    state.calendarDate = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() + offset, 1);
    renderCalendar();
  }

  async function exportData() {
    const readings = await dbGetAll();
    const payload = {
      app: "one-card-tarot",
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      dateBoundary: "device-local-midnight",
      timezoneAtExport: Intl.DateTimeFormat().resolvedOptions().timeZone || "device-local",
      readings
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `one-card-backup-${localDateKey()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    els.settingsStatus.textContent = "バックアップを書き出しました。";
  }

  async function importData(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      if (payload.app !== "one-card-tarot" || !Array.isArray(payload.readings)) {
        throw new Error("形式が一致しません");
      }
      for (const reading of payload.readings) validateReading(reading);
      for (const reading of payload.readings) await dbPut(reading);
      state.history = await dbGetAll();
      els.settingsStatus.textContent = `${payload.readings.length}件の記録を読み込みました。`;
      await showTodayState();
    } catch (error) {
      els.settingsStatus.textContent = `読み込めませんでした：${error.message}`;
    } finally {
      event.target.value = "";
    }
  }

  function validateReading(reading) {
    const validBase = reading &&
      /^\d{4}-\d{2}-\d{2}$/.test(reading.date) &&
      getCard(reading.cardId) &&
      getDeck(reading.deckId) &&
      ["upright", "reversed"].includes(reading.orientation);
    if (!validBase || ![1, 2].includes(reading.version)) {
      throw new Error("読み込めない記録が含まれています");
    }
    if (reading.version === 1) return;

    const snapshot = reading.snapshot;
    const validSnapshot = typeof reading.deckContentVersion === "string" &&
      reading.deckContentVersion.length > 0 &&
      snapshot &&
      ["deckName", "cardName", "meaning", "question"].every(key =>
        typeof snapshot[key] === "string" && snapshot[key].length > 0
      ) &&
      Array.isArray(snapshot.keywords) &&
      snapshot.keywords.length > 0 &&
      snapshot.keywords.every(word => typeof word === "string" && word.length > 0);
    if (!validSnapshot) throw new Error("snapshotが不完全な記録が含まれています");
  }

  function bindEvents() {
    els.deckPrev.addEventListener("click", () => shiftDeck(-1));
    els.deckNext.addEventListener("click", () => shiftDeck(1));
    els.drawCard.addEventListener("click", drawToday);
    $$(".nav-button").forEach(button => button.addEventListener("click", () => switchView(button.dataset.view)));
    $("#calendar-prev").addEventListener("click", () => changeMonth(-1));
    $("#calendar-next").addEventListener("click", () => changeMonth(1));
    els.exportData.addEventListener("click", exportData);
    els.importData.addEventListener("change", importData);
    els.returnToday.addEventListener("click", () => showTodayState());
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        els.todayLabel.textContent = formatToday();
        showTodayState();
      }
    });
  }

  async function init() {
    await loadContent();
    state.lastDateKey = localDateKey();
    els.todayLabel.textContent = formatToday();
    renderDeckPicker();
    bindEvents();
    state.history = await dbGetAll();
    await showTodayState();
    window.setInterval(async () => {
      const nextDateKey = localDateKey();
      if (nextDateKey !== state.lastDateKey) {
        state.lastDateKey = nextDateKey;
        els.todayLabel.textContent = formatToday();
        state.history = await dbGetAll();
        await showTodayState();
      }
    }, 30000);
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", async () => {
        const registration = await navigator.serviceWorker.register("./service-worker.js");
        const worker = registration.active || registration.waiting || registration.installing;
        worker?.postMessage({ type: "CACHE_DECKS" });
      });
    }
  }

  init().catch(error => {
    console.error(error);
    document.body.insertAdjacentHTML("afterbegin", `<p style="padding:16px;color:#7a3434">アプリを読み込めませんでした。ページを再読み込みしてください。</p>`);
  });
})();
