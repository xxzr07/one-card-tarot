const sharp = require("sharp");

const CARD_WIDTH = 612;
const CARD_HEIGHT = 1206;
const CARD_RADIUS = 30;

function roundedCardMask() {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
    <rect x="0" y="0" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="${CARD_RADIUS}" ry="${CARD_RADIUS}" fill="#fff"/>
  </svg>`);
}

async function clipCardPng(input) {
  return sharp(input)
    .ensureAlpha()
    .composite([{ input: roundedCardMask(), blend: "dest-in" }])
    .png()
    .toBuffer();
}

module.exports = {
  CARD_WIDTH,
  CARD_HEIGHT,
  CARD_RADIUS,
  clipCardPng
};
