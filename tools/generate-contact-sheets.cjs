const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { minorCards } = require("./minor-specs.cjs");

const ROOT = path.resolve(__dirname, "..");
const ASSETS = path.join(ROOT, "decks", "deck-01", "cards");
const TESTS = path.join(ROOT, "tests");
const MANIFEST = path.join(ROOT, "decks", "deck-01", "minor-build-manifest.json");
const sha256 = buffer => crypto.createHash("sha256").update(buffer).digest("hex");

const major = Array.from({ length: 22 }, (_, index) =>
  path.join(ASSETS, `major-${String(index).padStart(2, "0")}.png`)
);
const minor = minorCards.map(card => path.join(ASSETS, `${card.id}.png`));

if (!fs.existsSync(MANIFEST)) {
  throw new Error("Minor build manifest is missing. Run tools/generate-minor.cjs first.");
}
const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
if (manifest.count !== 56 || manifest.files.length !== 56) {
  throw new Error(`Expected a 56-card build manifest, found ${manifest.files.length}`);
}
for (const record of manifest.files) {
  const absolutePath = path.join(ROOT, record.path);
  const actualHash = sha256(fs.readFileSync(absolutePath));
  if (actualHash !== record.sha256) {
    throw new Error(`${record.path}: does not match the latest build manifest`);
  }
}

function montage(files, output, columns) {
  execFileSync("montage", [
    ...files,
    "-thumbnail", "184x362",
    "-tile", `${columns}x`,
    "-geometry", "+22+24",
    "-background", "#f4f0e8",
    output
  ], { stdio: "inherit" });
}

const version = manifest.minorSetSha256.slice(0, 12);
const minorStable = path.join(TESTS, "deck-01-minor-arcana.jpg");
const completeStable = path.join(TESTS, "deck-01-complete-78.jpg");
const minorVersioned = path.join(TESTS, `deck-01-minor-arcana-${version}.jpg`);
const completeVersioned = path.join(TESTS, `deck-01-complete-78-${version}.jpg`);

// Stable aliases remain convenient inside the project. Versioned copies have
// content-derived names so browsers and attachment viewers cannot reuse an old
// confirmation sheet for a newer 56-card build.
montage(minor, minorStable, 7);
montage([...major, ...minor], completeStable, 7);
fs.copyFileSync(minorStable, minorVersioned);
fs.copyFileSync(completeStable, completeVersioned);

const describe = file => {
  const stat = fs.statSync(file);
  return {
    path: path.relative(ROOT, file).replaceAll(path.sep, "/"),
    size: stat.size,
    mtime: stat.mtime.toISOString(),
    sha256: sha256(fs.readFileSync(file))
  };
};
fs.writeFileSync(path.join(TESTS, `minor-source-audit-${version}.json`), JSON.stringify({
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  canonicalCardDirectory: "decks/deck-01/cards",
  contactSheetGenerator: "tools/generate-contact-sheets.cjs",
  minorSetSha256: manifest.minorSetSha256,
  sourceFiles: manifest.files,
  representativeCards: manifest.files.filter(file => [
    "wands-ace", "cups-03", "swords-08", "pentacles-07"
  ].includes(file.id)),
  outputs: [minorStable, completeStable, minorVersioned, completeVersioned].map(describe)
}, null, 2) + "\n");

console.log(`Updated contact sheets from ${ASSETS}.`);
console.log(`Versioned Minor Arcana sheet: ${minorVersioned}`);
console.log(`Versioned complete-deck sheet: ${completeVersioned}`);
