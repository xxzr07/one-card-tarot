const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "styles.css"), "utf8");
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const serviceWorker = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(!/<p class="section-label">DECK<\/p>/.test(html), "Standalone DECK label still exists");
assert(!/一日に一枚。同じ日は引き直せません/.test(html), "Pre-draw quiet note still exists");
assert(
  html.includes("一日一枚のカードと、短い問いに触れるためのアプリ。"),
  "About description was not updated"
);
assert(/\.draw-button\s*\{[^}]*font-family:\s*var\(--mincho\)/s.test(css), "Draw button does not use Hakkou Mincho");

const sharedRadius = css.match(/--card-corner-radius:\s*([^;]+);/)?.[1]?.trim();
assert(sharedRadius, "Shared card corner radius is missing");
assert(
  new RegExp(`\\.card-face\\s*\\{[^}]*border-radius:\\s*var\\(--card-corner-radius\\)`, "s").test(css),
  "Flip faces do not use the shared card radius"
);
assert(
  new RegExp(`\\.tarot-card\\s*\\{[^}]*border-radius:\\s*var\\(--card-corner-radius\\)`, "s").test(css),
  "Reading cards do not use the shared card radius"
);
assert(
  /\.card-face\s*\{[^}]*overflow:\s*hidden/s.test(css) &&
    /\.tarot-card\s*\{[^}]*overflow:\s*hidden/s.test(css),
  "Card faces are not clipped"
);
assert(!/#e9e2d9/.test(css), "Light card underlay can still show through transparent corners");

assert(/\.meaning\s*\{[^}]*line-break:\s*strict/s.test(css), "Meaning text lacks strict Japanese line breaking");
assert(/\.meaning\s*\{[^}]*text-wrap:\s*pretty/s.test(css), "Meaning text lacks pretty wrapping");
assert(app.includes("function renderMeaning(text)"), "Meaning punctuation break opportunities are missing");
assert(app.includes("function fitQuestionLine()"), "Question one-line fitting is missing");
assert(app.includes("const minSize = rootSize * .88;"), "Question fitting lacks a readable minimum size");
assert(/\.question\s*\{[^}]*letter-spacing:\s*\.01em/s.test(css), "Question tracking was not tightened");

assert(app.includes('dayNumber.className = "calendar-day-number"'), "Calendar day number wrapper is missing");
assert(/\.calendar-day\.is-today \.calendar-day-number\s*\{[^}]*border-color:/s.test(css), "Today ring is not attached to the date number");
assert(app.includes('drawMarker.className = "calendar-day-marker"'), "Calendar draw marker is missing");
assert(/\.calendar-day-marker\s*\{[^}]*grid-row:\s*2/s.test(css), "Draw marker is not placed below the date number");
assert(serviceWorker.includes('one-card-content-v16'), "Service worker cache was not advanced for the corner image update");

console.log(JSON.stringify({
  sharedRadius,
  checks: 19,
  result: "UI polish structure passed"
}, null, 2));
