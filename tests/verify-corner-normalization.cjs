const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const sharp = require("sharp");
const {
  CARD_WIDTH,
  CARD_HEIGHT
} = require("../tools/card-output.cjs");
const {
  CORNER_EXTENT,
  TARGETS,
  fitCornerPlanes,
  mapCorner,
  predictedChannel
} = require("../tools/normalize-raster-card-corners.cjs");

const ROOT = path.resolve(__dirname, "..");
const BASE_COMMIT = "5745ed4993237465531cf5cd1c9e648302b261fe";
const AUDIT_PATH = path.join(ROOT, "tests", "card-corner-normalization-audit.json");
const sha256 = value => crypto.createHash("sha256").update(value).digest("hex");

async function raw(input) {
  return sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

function beforeBuffer(relativePath) {
  return execFileSync(
    "git",
    ["show", `${BASE_COMMIT}:${relativePath.replaceAll(path.sep, "/")}`],
    { cwd: ROOT, maxBuffer: 16 * 1024 * 1024 }
  );
}

function isAllowedCorner(x, y) {
  return (
    Math.min(x, CARD_WIDTH - 1 - x) <= CORNER_EXTENT &&
    Math.min(y, CARD_HEIGHT - 1 - y) <= CORNER_EXTENT
  );
}

async function canonicalAlpha() {
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}">
      <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="30" ry="30" fill="#fff"/>
    </svg>`
  );
  const { data } = await sharp(mask).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alpha = Buffer.alloc(CARD_WIDTH * CARD_HEIGHT);
  for (let pixel = 0; pixel < alpha.length; pixel += 1) {
    alpha[pixel] = data[pixel * 4 + 3];
  }
  return alpha;
}

function regionStats(data) {
  const stats = {
    transparent: { pixels: 0, rgbMin: [255, 255, 255], rgbMax: [0, 0, 0] },
    antialiased: { pixels: 0, rgbMin: [255, 255, 255], rgbMax: [0, 0, 0], alphaMin: 255, alphaMax: 0 },
    opaque: { pixels: 0, rgbMin: [255, 255, 255], rgbMax: [0, 0, 0] }
  };
  for (let y = 0; y <= CORNER_EXTENT; y += 1) {
    for (let x = 0; x <= CORNER_EXTENT; x += 1) {
      const offset = (y * CARD_WIDTH + x) * 4;
      const alpha = data[offset + 3];
      const region = alpha === 0
        ? stats.transparent
        : alpha === 255
          ? stats.opaque
          : stats.antialiased;
      region.pixels += 1;
      for (let channel = 0; channel < 3; channel += 1) {
        region.rgbMin[channel] = Math.min(region.rgbMin[channel], data[offset + channel]);
        region.rgbMax[channel] = Math.max(region.rgbMax[channel], data[offset + channel]);
      }
      if (region === stats.antialiased) {
        region.alphaMin = Math.min(region.alphaMin, alpha);
        region.alphaMax = Math.max(region.alphaMax, alpha);
      }
    }
  }
  return stats;
}

async function main() {
  const expectedAlpha = await canonicalAlpha();
  const audit = {
    schemaVersion: 1,
    baseCommit: BASE_COMMIT,
    dimensions: `${CARD_WIDTH}x${CARD_HEIGHT}`,
    finalCornerRadius: 30,
    reconstructionCornerExtent: CORNER_EXTENT,
    targetCount: TARGETS.length,
    targets: {}
  };

  for (const relativePath of TARGETS) {
    const absolutePath = path.join(ROOT, relativePath);
    const [before, after] = await Promise.all([
      raw(beforeBuffer(relativePath)),
      raw(absolutePath)
    ]);
    if (
      after.info.width !== CARD_WIDTH ||
      after.info.height !== CARD_HEIGHT ||
      after.info.channels !== 4
    ) {
      throw new Error(`${relativePath}: output contract changed`);
    }

    const planes = fitCornerPlanes(after.data);
    let rgbChanged = 0;
    let alphaChanged = 0;
    let changedOutsideCorners = 0;
    let centerPixelsChanged = 0;
    let alphaMismatch = 0;
    let antialiasPlaneError = 0;
    const bounds = {
      minX: CARD_WIDTH,
      minY: CARD_HEIGHT,
      maxX: -1,
      maxY: -1
    };

    for (let y = 0; y < CARD_HEIGHT; y += 1) {
      for (let x = 0; x < CARD_WIDTH; x += 1) {
        const pixel = y * CARD_WIDTH + x;
        const offset = pixel * 4;
        const rgbDiff =
          before.data[offset] !== after.data[offset] ||
          before.data[offset + 1] !== after.data[offset + 1] ||
          before.data[offset + 2] !== after.data[offset + 2];
        const alphaDiff = before.data[offset + 3] !== after.data[offset + 3];
        if (rgbDiff) rgbChanged += 1;
        if (alphaDiff) alphaChanged += 1;
        if (rgbDiff || alphaDiff) {
          bounds.minX = Math.min(bounds.minX, x);
          bounds.minY = Math.min(bounds.minY, y);
          bounds.maxX = Math.max(bounds.maxX, x);
          bounds.maxY = Math.max(bounds.maxY, y);
          if (!isAllowedCorner(x, y)) changedOutsideCorners += 1;
          if (
            x >= CORNER_EXTENT + 1 &&
            x < CARD_WIDTH - CORNER_EXTENT - 1 &&
            y >= CORNER_EXTENT + 1 &&
            y < CARD_HEIGHT - CORNER_EXTENT - 1
          ) {
            centerPixelsChanged += 1;
          }
        }
        if (after.data[offset + 3] !== expectedAlpha[pixel]) alphaMismatch += 1;
      }
    }

    for (let corner = 0; corner < 4; corner += 1) {
      for (let localY = 0; localY <= 30; localY += 1) {
        for (let localX = 0; localX <= 30; localX += 1) {
          const [x, y] = mapCorner(localX, localY, corner);
          const offset = (y * CARD_WIDTH + x) * 4;
          const alpha = after.data[offset + 3];
          if (alpha === 0 || alpha === 255) continue;
          for (let channel = 0; channel < 3; channel += 1) {
            const predicted = Math.round(predictedChannel(
              planes[corner][channel],
              localX,
              localY
            ));
            antialiasPlaneError = Math.max(
              antialiasPlaneError,
              Math.abs(after.data[offset + channel] - predicted)
            );
          }
        }
      }
    }

    if (changedOutsideCorners) {
      throw new Error(`${relativePath}: ${changedOutsideCorners} changed pixels escaped the corner extent`);
    }
    if (centerPixelsChanged) {
      throw new Error(`${relativePath}: ${centerPixelsChanged} center pixels changed`);
    }
    if (alphaMismatch) {
      throw new Error(`${relativePath}: ${alphaMismatch} pixels differ from the one-pass canonical alpha`);
    }
    if (antialiasPlaneError > 1) {
      throw new Error(`${relativePath}: antialias RGB is not derived from the reconstructed card face`);
    }

    audit.targets[relativePath.replaceAll(path.sep, "/")] = {
      sha256: sha256(fs.readFileSync(absolutePath)),
      rgbPixelsChanged: rgbChanged,
      alphaPixelsChanged: alphaChanged,
      changedBounds: bounds,
      changedOutsideCorners,
      centerPixelsChanged,
      alphaMismatch,
      antialiasPlaneMaxRgbError: antialiasPlaneError,
      topLeftCornerRegions: regionStats(after.data)
    };
  }

  const minorPaths = fs.readdirSync(path.join(ROOT, "decks", "deck-01", "cards"))
    .filter(file => !file.startsWith("major-") && file.endsWith(".png"))
    .sort()
    .map(file => path.join("decks", "deck-01", "cards", file));
  if (minorPaths.length !== 56) throw new Error(`Expected 56 Minor Arcana, found ${minorPaths.length}`);
  for (const relativePath of minorPaths) {
    const current = fs.readFileSync(path.join(ROOT, relativePath));
    const original = beforeBuffer(relativePath);
    if (!current.equals(original)) throw new Error(`${relativePath}: Minor Arcana changed`);
  }
  audit.minorArcana = {
    filesChecked: minorPaths.length,
    unchangedFromBaseCommit: true
  };

  if (process.argv.includes("--write-audit")) {
    fs.writeFileSync(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
  }
  console.log(JSON.stringify(audit, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
