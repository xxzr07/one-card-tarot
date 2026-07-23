const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const sharp = require("sharp");
const {
  CARD_WIDTH,
  CARD_HEIGHT,
  CARD_RADIUS
} = require("./card-output.cjs");

const ROOT = path.resolve(__dirname, "..");
const BASE_COMMIT = "5745ed4993237465531cf5cd1c9e648302b261fe";
const CORNER_EXTENT = 60;
const RECONSTRUCTION_START = 40;
const RECONSTRUCTION_END = 48;
const SAMPLE_NEAR = 10;
const SAMPLE_FAR = 22;
const SAMPLE_RUN_START = 70;
const SAMPLE_RUN_END = 160;

const TARGETS = [
  path.join("decks", "deck-01", "back.png"),
  ...Array.from(
    { length: 22 },
    (_, index) => path.join(
      "decks",
      "deck-01",
      "cards",
      `major-${String(index).padStart(2, "0")}.png`
    )
  )
];

function roundedCardMask() {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
      <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="${CARD_RADIUS}" ry="${CARD_RADIUS}" fill="#fff"/>
    </svg>`
  );
}

function mapCorner(localX, localY, corner) {
  return [
    corner & 1 ? CARD_WIDTH - 1 - localX : localX,
    corner & 2 ? CARD_HEIGHT - 1 - localY : localY
  ];
}

function solve3(matrix, values) {
  const a = matrix.map(row => [...row]);
  const b = [...values];

  for (let column = 0; column < 3; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < 3; row += 1) {
      if (Math.abs(a[row][column]) > Math.abs(a[pivot][column])) pivot = row;
    }
    [a[column], a[pivot]] = [a[pivot], a[column]];
    [b[column], b[pivot]] = [b[pivot], b[column]];

    const divisor = a[column][column];
    if (Math.abs(divisor) < 1e-9) throw new Error("Corner color fit is singular");
    for (let index = column; index < 3; index += 1) a[column][index] /= divisor;
    b[column] /= divisor;

    for (let row = 0; row < 3; row += 1) {
      if (row === column) continue;
      const factor = a[row][column];
      for (let index = column; index < 3; index += 1) {
        a[row][index] -= factor * a[column][index];
      }
      b[row] -= factor * b[column];
    }
  }

  return b;
}

function fitChannel(data, corner, channel) {
  const matrix = Array.from({ length: 3 }, () => [0, 0, 0]);
  const values = [0, 0, 0];

  const addSample = (localX, localY) => {
    const [x, y] = mapCorner(localX, localY, corner);
    const value = data[(y * CARD_WIDTH + x) * 4 + channel];
    const factors = [1, localX / 100, localY / 100];
    for (let row = 0; row < 3; row += 1) {
      values[row] += factors[row] * value;
      for (let column = 0; column < 3; column += 1) {
        matrix[row][column] += factors[row] * factors[column];
      }
    }
  };

  for (let localY = SAMPLE_NEAR; localY <= SAMPLE_FAR; localY += 1) {
    for (let localX = SAMPLE_RUN_START; localX <= SAMPLE_RUN_END; localX += 1) {
      addSample(localX, localY);
    }
  }
  for (let localX = SAMPLE_NEAR; localX <= SAMPLE_FAR; localX += 1) {
    for (let localY = SAMPLE_RUN_START; localY <= SAMPLE_RUN_END; localY += 1) {
      addSample(localX, localY);
    }
  }

  return solve3(matrix, values);
}

function fitCornerPlanes(data) {
  return Array.from(
    { length: 4 },
    (_, corner) => Array.from({ length: 3 }, (_, channel) => fitChannel(data, corner, channel))
  );
}

function predictedChannel(coefficients, localX, localY) {
  return Math.max(
    0,
    Math.min(
      255,
      coefficients[0] + coefficients[1] * (localX / 100) + coefficients[2] * (localY / 100)
    )
  );
}

function reconstructionWeight(localX, localY) {
  const distance = Math.hypot(
    CORNER_EXTENT - localX,
    CORNER_EXTENT - localY
  );
  if (distance <= RECONSTRUCTION_START) return 0;
  return Math.min(
    1,
    (distance - RECONSTRUCTION_START) /
      (RECONSTRUCTION_END - RECONSTRUCTION_START)
  );
}

function reconstructCornerRgb(source, planes) {
  const output = Buffer.from(source);

  for (let corner = 0; corner < 4; corner += 1) {
    for (let localY = 0; localY <= CORNER_EXTENT; localY += 1) {
      for (let localX = 0; localX <= CORNER_EXTENT; localX += 1) {
        const weight = reconstructionWeight(localX, localY);
        if (weight === 0) continue;

        const [x, y] = mapCorner(localX, localY, corner);
        const offset = (y * CARD_WIDTH + x) * 4;
        for (let channel = 0; channel < 3; channel += 1) {
          const predicted = predictedChannel(
            planes[corner][channel],
            localX,
            localY
          );
          output[offset + channel] = Math.round(
            source[offset + channel] * (1 - weight) + predicted * weight
          );
        }
      }
    }
  }

  for (let offset = 3; offset < output.length; offset += 4) {
    output[offset] = 255;
  }
  return output;
}

async function normalizeBuffer(input) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (
    info.width !== CARD_WIDTH ||
    info.height !== CARD_HEIGHT ||
    info.channels !== 4
  ) {
    throw new Error(
      `Expected ${CARD_WIDTH}x${CARD_HEIGHT} RGBA input, got ` +
      `${info.width}x${info.height} with ${info.channels} channels`
    );
  }

  const planes = fitCornerPlanes(data);
  const reconstructed = reconstructCornerRgb(data, planes);
  return sharp(reconstructed, {
    raw: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      channels: 4
    }
  })
    .composite([{ input: roundedCardMask(), blend: "dest-in" }])
    .png()
    .toBuffer();
}

async function main() {
  for (const relativePath of TARGETS) {
    const absolutePath = path.join(ROOT, relativePath);
    const source = execFileSync(
      "git",
      ["show", `${BASE_COMMIT}:${relativePath.replaceAll(path.sep, "/")}`],
      { cwd: ROOT, maxBuffer: 16 * 1024 * 1024 }
    );
    const normalized = await normalizeBuffer(source);
    const temporaryPath = `${absolutePath}.next`;
    fs.writeFileSync(temporaryPath, normalized);
    fs.renameSync(temporaryPath, absolutePath);
    console.log(`Normalized ${relativePath}`);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  BASE_COMMIT,
  CORNER_EXTENT,
  RECONSTRUCTION_START,
  RECONSTRUCTION_END,
  TARGETS,
  fitCornerPlanes,
  mapCorner,
  normalizeBuffer,
  predictedChannel,
  reconstructionWeight
};
