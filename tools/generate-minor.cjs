const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const sharp = require("sharp");
const { minorCards } = require("./minor-specs.cjs");
const { clipCardPng } = require("./card-output.cjs");

const ROOT = path.resolve(__dirname, "..");
const DECK_DIR = path.join(ROOT, "decks", "deck-01");
const OUT = path.join(DECK_DIR, "cards");
const TMP = path.join(ROOT, "tools", ".minor-tmp");
const BUILD = path.join(ROOT, "tools", ".minor-build");
const TEXTURE = path.join(DECK_DIR, "minor-paper-texture.png");
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });
fs.mkdirSync(BUILD, { recursive: true });

const C = { paper: "#f2eee6", paperShade: "#e6dfd7", charcoal: "#29292b", charcoalSoft: "#3b393d", mauve: "#a9a0ac", mauveDark: "#817986", deep: "#706875", gold: "#aa8846", pale: "#d9d2db", white: "#fbfaf6", green: "#78806a" };
const esc = value => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const line = (x1, y1, x2, y2, attrs = "") => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${attrs}/>`;
const circle = (cx, cy, r, attrs = "") => `<circle cx="${cx}" cy="${cy}" r="${r}" ${attrs}/>`;
const pathEl = (d, attrs = "") => `<path d="${d}" ${attrs}/>`;
const polygon = (points, attrs = "") => `<polygon points="${points}" ${attrs}/>`;
const g = (body, attrs = "") => `<g ${attrs}>${body}</g>`;

function pentagram(cx, cy, r, stroke = C.gold, sw = 2) {
  const outer = Array.from({ length: 5 }, (_, i) => {
    const a = -Math.PI / 2 + i * 2 * Math.PI / 5;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
  const order = [0, 2, 4, 1, 3, 0];
  return `<polyline points="${order.map(i => outer[i].join(",")).join(" ")}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;
}

function wand(x, y, length = 300, angle = 0, sprout = false, opacity = 1) {
  const body = `<path d="M ${x} ${y + length / 2} C ${x - 5} ${y + 80}, ${x + 4} ${y - 70}, ${x} ${y - length / 2}" fill="none" stroke="url(#wandStroke)" stroke-width="11" stroke-linecap="round" filter="url(#objectShadow)"/>` +
    line(x - 1, y + length / 2 - 5, x + 2, y - length / 2 + 8, `stroke="${C.gold}" stroke-width="1.2" opacity=".75"`) +
    (sprout ? pathEl(`M ${x} ${y - 45} C ${x + 28} ${y - 70}, ${x + 35} ${y - 90}, ${x + 38} ${y - 108} M ${x + 25} ${y - 79} C ${x + 10} ${y - 94}, ${x + 4} ${y - 111}, ${x + 7} ${y - 126}`, `fill="none" stroke="${C.green}" stroke-width="5" stroke-linecap="round"`) : "");
  return g(body, `transform="rotate(${angle} ${x} ${y})" opacity="${opacity}"`);
}

function cup(x, y, scale = 1, spilled = false) {
  const bowl = pathEl(`M ${x - 32 * scale} ${y - 30 * scale} Q ${x} ${y + 26 * scale} ${x + 32 * scale} ${y - 30 * scale} Z`, `fill="${spilled ? C.deep : "url(#charcoalMineral)"}" stroke="${C.gold}" stroke-width="1.5" filter="url(#objectShadow)"`);
  const stem = line(x, y + 12 * scale, x, y + 52 * scale, `stroke="${C.charcoal}" stroke-width="5"`);
  const base = line(x - 20 * scale, y + 54 * scale, x + 20 * scale, y + 54 * scale, `stroke="${C.gold}" stroke-width="3" stroke-linecap="round"`);
  return g(bowl + stem + base, spilled ? `transform="rotate(68 ${x} ${y})"` : "");
}

function sword(x, y, length = 330, angle = 0) {
  const body = polygon(`${x},${y - length / 2} ${x + 8},${y + length / 2 - 45} ${x - 8},${y + length / 2 - 45}`, `fill="url(#bladeFill)" stroke="${C.gold}" stroke-width="1" filter="url(#objectShadow)"`) +
    line(x - 34, y + length / 2 - 42, x + 34, y + length / 2 - 42, `stroke="${C.gold}" stroke-width="5" stroke-linecap="round"`) +
    circle(x, y + length / 2 - 22, 7, `fill="${C.gold}"`);
  return g(body, `transform="rotate(${angle} ${x} ${y})"`);
}

function coin(x, y, r = 36, fill = C.paper) {
  const coinFill = fill === C.paper ? "url(#coinFill)" : fill;
  return circle(x, y, r, `fill="${coinFill}" stroke="${C.gold}" stroke-width="4" filter="url(#objectShadow)"`) +
    circle(x - r * .18, y - r * .2, r * .48, `fill="none" stroke="${C.white}" stroke-width="1.2" opacity=".24"`) +
    pentagram(x, y, r * .7, C.gold, 2.2);
}

function hills() {
  // Keep the paper wash visible through the title area. These are landscape
  // shapes, not full-height footer fills: their lower edges remain organic and
  // finish above the card name so they cannot read as a pasted-on label.
  return pathEl("M 24 790 Q 115 690 215 755 T 392 735 T 588 780 Q 515 860 410 846 T 210 872 T 24 850 Z", `fill="url(#hillMist)" opacity=".62"`) +
    pathEl("M 24 845 Q 125 710 250 805 T 470 770 T 588 820 Q 514 925 408 902 T 214 938 T 24 910 Z", `fill="url(#hillBack)" opacity=".88" filter="url(#softDepth)"`) +
    pathEl("M 24 915 Q 145 790 295 875 T 588 835 Q 505 980 398 952 T 205 1000 T 24 970 Z", `fill="url(#hillFront)" opacity=".86"`) +
    pathEl("M 24 970 Q 170 845 315 930 T 588 890 Q 500 1008 390 988 T 198 1020 T 24 998 Z", `fill="${C.mauveDark}" opacity=".16"`) +
    pathEl("M 24 915 Q 145 790 295 875 T 588 835", `fill="none" stroke="${C.white}" stroke-width="2" opacity=".2"`);
}

function water(y = 780, h = 240) {
  const bottom = Math.min(y + h, 1018);
  const waveCount = Math.max(1, Math.min(10, Math.floor((bottom - y - 30) / 21)));
  let waves = pathEl(`M 24 ${y} Q 145 ${y - 18} 290 ${y + 16} T 588 ${y + 4} L 588 ${bottom - 24} Q 470 ${bottom + 2} 330 ${bottom - 18} T 24 ${bottom - 5} Z`, `fill="url(#waterFill)" opacity=".78"`) +
    pathEl(`M 24 ${y + 18} Q 145 ${y - 18} 290 ${y + 16} T 588 ${y + 4}`, `fill="none" stroke="${C.white}" stroke-width="9" opacity=".22"`);
  for (let i = 0; i < waveCount; i++) waves += pathEl(`M 45 ${y + 22 + i * 21} Q 140 ${y + 7 + i * 21} 230 ${y + 22 + i * 21} T 430 ${y + 22 + i * 21} T 575 ${y + 22 + i * 21}`, `fill="none" stroke="${i % 3 === 0 ? C.gold : C.deep}" stroke-width="${i % 3 === 0 ? 1.4 : 1}" opacity="${i % 3 === 0 ? .22 : .34}"`);
  return waves;
}

function courtBase(card) {
  const isKnight = card.rank === "knight";
  const isQueen = card.rank === "queen";
  const isKing = card.rank === "king";
  const isPage = card.rank === "page";
  let body = hills();
  if (isKnight) {
    body += pathEl("M 155 760 Q 215 650 320 680 Q 380 705 430 645 L 460 668 L 425 712 Q 405 760 455 820 L 405 835 L 350 770 L 275 790 L 225 875 L 180 865 L 212 785 Z", `fill="${C.charcoal}" opacity=".92"`);
  } else {
    const height = isKing ? 470 : isQueen ? 420 : 310;
    body += polygon(`190,920 215,${920 - height} 306,${850 - height} 397,${920 - height} 422,920`, `fill="${isPage ? "url(#figurePale)" : "url(#charcoalMineral)"}" stroke="${C.gold}" stroke-width="2" opacity=".96" filter="url(#objectShadow)"`);
    body += circle(306, 830 - height, isPage ? 24 : 32, `fill="${C.gold}" opacity=".85"`);
    if (isQueen || isKing) body += pathEl(`M 250 ${875 - height} L 278 ${825 - height} L 306 ${870 - height} L 334 ${825 - height} L 362 ${875 - height}`, `fill="none" stroke="${C.gold}" stroke-width="4"`);
  }
  return body;
}

function artWands(card) {
  const r = card.rank;
  if (r === "ace") return wand(306, 545, 610, 0, true) + hills() + pathEl("M 306 890 C 250 940 390 995 305 1040", `fill="none" stroke="${C.mauve}" stroke-width="16" opacity=".35"`);
  if (r === "02") return hills() + wand(170, 560, 500) + wand(442, 560, 500) + circle(306, 500, 66, `fill="${C.pale}" stroke="${C.gold}" stroke-width="3"`) + pathEl("M 24 830 H 588", `stroke="${C.deep}" stroke-width="2" opacity=".5"`);
  if (r === "03") return water(760, 260) + [190,306,422].map(x => wand(x, 590, 470)).join("") + pathEl("M 410 855 l 40 -18 l -8 28 z M 155 930 l 32 -14 l -7 22 z", `fill="${C.gold}" opacity=".8"`);
  if (r === "04") return hills() + [170,252,360,442].map(x => wand(x, 615, 520)).join("") + pathEl("M 170 405 Q 220 355 306 395 Q 392 355 442 405", `fill="none" stroke="${C.green}" stroke-width="16"`) + circle(210,390,8,`fill="${C.gold}"`) + circle(306,388,8,`fill="${C.gold}"`) + circle(404,390,8,`fill="${C.gold}"`);
  if (r === "05") return hills() + [[220,560,-28],[280,590,18],[340,560,-10],[390,620,32],[300,510,-42]].map(([x,y,a])=>wand(x,y,420,a)).join("") + circle(306,520,10,`fill="${C.gold}"`) + circle(270,570,5,`fill="${C.gold}"`) + circle(350,560,5,`fill="${C.gold}"`);
  if (r === "06") return hills() + [176,240,306,372,436].map(x=>wand(x,640,420)).join("") + wand(306,540,580,0,true) + circle(306,330,58,`fill="none" stroke="${C.gold}" stroke-width="8" stroke-dasharray="8 7"`);
  if (r === "07") return hills() + wand(306,540,520,0,true) + [150,210,270,342,402,462].map((x,i)=>wand(x,800,330,(x-306)/8)).join("");
  if (r === "08") return water(860,160) + Array.from({length:8},(_,i)=>wand(125+i*53,560,440,58)).join("");
  if (r === "09") return hills() + [110,164,218,272,326,380,434,488].map(x=>wand(x,620,500)).join("") + wand(306,555,600,0,true) + g([490,505,520].map(y=>line(285,y,327,y,`stroke="${C.gold}" stroke-width="7"`)).join(""));
  if (r === "10") return hills() + Array.from({length:10},(_,i)=>wand(230+i*17,615,560,-14+i*3)).join("") + pathEl("M 500 890 l 50 -55 l 38 55 z",`fill="${C.charcoal}" opacity=".8"`);
  let body = courtBase(card);
  if (r === "page") body += wand(350,560,520,0,true);
  if (r === "knight") body += wand(358,520,520,-28,true) + pathEl("M 395 500 l 36 -30 l 12 45 z",`fill="${C.gold}"`);
  if (r === "queen") body += wand(390,550,540,0,true) + circle(215,500,52,`fill="${C.gold}"`) + Array.from({length:12},(_,i)=>line(215,500,215+Math.cos(i*Math.PI/6)*78,500+Math.sin(i*Math.PI/6)*78,`stroke="${C.gold}" stroke-width="2"`)).join("") + pathEl("M 205 930 q 35 -45 70 0 q -35 28 -70 0",`fill="${C.charcoal}"`);
  if (r === "king") body += wand(390,520,600,0,true) + circle(205,700,58,`fill="none" stroke="${C.gold}" stroke-width="4"`) + pathEl("M 175 700 q 30 -40 60 0 q -30 40 -60 0",`fill="none" stroke="${C.gold}" stroke-width="3"`);
  return body;
}

function artCups(card) {
  const r = card.rank;
  if (r === "ace") return water(790,250) + cup(306,560,2.5) + [260,282,306,330,352].map((x,i)=>pathEl(`M ${x} 620 C ${x+(i-2)*8} 700 ${x+(i-2)*12} 770 ${x+(i-2)*15} 860`,`fill="none" stroke="${C.gold}" stroke-width="4"`)).join("") + pathEl("M 306 430 q -38 45 0 75 q 38 -30 0 -75",`fill="none" stroke="${C.gold}" stroke-width="3"`);
  if (r === "02") return water(830,190) + cup(210,650,1.5) + cup(402,650,1.5) + pathEl("M 225 585 C 270 520 342 520 387 585 M 245 570 C 280 610 332 610 367 570",`fill="none" stroke="${C.gold}" stroke-width="4"`) + polygon("306,470 330,510 306,545 282,510",`fill="${C.gold}"`);
  if (r === "03") return hills() + cup(210,650,1.45) + cup(306,560,1.45) + cup(402,650,1.45) + circle(306,710,50,`fill="${C.pale}" stroke="${C.gold}" stroke-width="2"`) + [0,120,240].map(a=>g(pathEl("M 306 710 q 30 -50 0 -75 q -30 25 0 75",`fill="none" stroke="${C.green}" stroke-width="4"`),`transform="rotate(${a} 306 710)"`)).join("");
  if (r === "04") return hills() + [235,306,377].map(x=>cup(x,780,1.1)).join("") + cup(455,540,1.25) + circle(475,480,80,`fill="${C.pale}" opacity=".35"`) + pathEl("M 120 830 Q 150 600 210 460 Q 260 370 300 400",`fill="none" stroke="${C.charcoal}" stroke-width="18" opacity=".7"`);
  if (r === "05") return water(790,240) + [210,306,402].map((x,i)=>g(cup(x,700,1.1,true),`transform="translate(0 ${i*12})"`)).join("") + cup(220,520,1.2) + cup(392,520,1.2) + pathEl("M 90 690 Q 306 520 522 690",`fill="none" stroke="${C.gold}" stroke-width="5" opacity=".55"`);
  if (r === "06") return hills() + [[190,520],[306,470],[422,520],[190,720],[306,690],[422,720]].map(([x,y])=>cup(x,y,1.05)+pathEl(`M ${x} ${y-30} q -22 -35 0 -60 q 22 25 0 60`, `fill="none" stroke="${C.green}" stroke-width="3"`)).join("") + pathEl("M 250 930 h112 v-160 h-112 z",`fill="none" stroke="${C.gold}" stroke-width="3"`);
  if (r === "07") { const symbols=["○","△","◇","♛","☾","∞","✦"]; return [150,228,306,384,462,208,404].map((x,i)=>{const y=i<5?620:790; return cup(x,y,.9)+`<text x="${x}" y="${y-60}" text-anchor="middle" font-size="32" fill="${i%2?C.deep:C.gold}">${symbols[i]}</text>`;}).join("")+pathEl("M 90 800 Q 306 580 522 800",`fill="none" stroke="${C.pale}" stroke-width="70" opacity=".5"`); }
  if (r === "08") return hills() + [210,280,350,420].map(x=>cup(x,760,.95)).join("") + [245,315,385,455].map(x=>cup(x,650,.95)).join("") + circle(420,340,58,`fill="${C.deep}" opacity=".75"`) + pathEl("M 510 920 C 460 840 490 700 430 590",`fill="none" stroke="${C.gold}" stroke-width="4"`);
  if (r === "09") return hills() + Array.from({length:9},(_,i)=>{const a=Math.PI+(i*Math.PI/8); return cup(306+Math.cos(a)*220,620+Math.sin(a)*120,.85);}).join("") + pathEl("M 120 650 Q 306 760 492 650",`fill="none" stroke="${C.deep}" stroke-width="34" opacity=".6"`);
  if (r === "10") return hills() + Array.from({length:10},(_,i)=>{const a=Math.PI+(i*Math.PI/9); return cup(306+Math.cos(a)*240,610+Math.sin(a)*170,.65);}).join("") + pathEl("M 245 900 h122 v-150 h-122 z",`fill="none" stroke="${C.gold}" stroke-width="3"`) + [180,235,377,432].map(x=>circle(x,900,20,`fill="${C.charcoal}"`)).join("");
  let body = courtBase(card) + water(850,170);
  if (r === "page") body += cup(380,570,1.45) + pathEl("M 380 500 q 28 -45 55 0 q -28 35 -55 0",`fill="${C.deep}"`);
  if (r === "knight") body += cup(360,530,1.4);
  if (r === "queen") body += cup(382,550,1.8) + pathEl("M 350 460 q 32 -65 64 0",`fill="none" stroke="${C.gold}" stroke-width="4"`);
  if (r === "king") body += cup(385,520,1.6) + pathEl("M 100 930 l 45 -18 l -8 28 z M 480 850 q 35 -45 70 0 q -35 30 -70 0",`fill="${C.gold}" opacity=".8"`);
  return body;
}

function artSwords(card) {
  const r = card.rank;
  if (r === "ace") return hills() + sword(306,590,700) + pathEl("M 190 360 Q 306 300 422 360 Q 390 400 306 390 Q 222 400 190 360",`fill="${C.pale}" stroke="${C.gold}" stroke-width="3"`) + pathEl("M 210 405 q -15 55 -35 75 M 402 405 q 15 55 35 75",`fill="none" stroke="${C.gold}" stroke-width="4"`);
  if (r === "02") return water(820,200) + sword(245,600,520,-43) + sword(367,600,520,43) + line(190,560,422,560,`stroke="${C.white}" stroke-width="18" opacity=".9"`) + circle(450,350,45,`fill="${C.deep}" opacity=".65"`);
  if (r === "03") return pathEl("M 306 360 C 190 270 115 470 306 720 C 497 470 422 270 306 360 Z",`fill="${C.pale}" stroke="${C.deep}" stroke-width="2"`) + sword(240,540,500,-18) + sword(306,520,560,0) + sword(372,540,500,18) + Array.from({length:9},(_,i)=>line(80+i*58,250,65+i*58,900,`stroke="${C.mauve}" stroke-width="2" opacity=".5"`)).join("");
  if (r === "04") return hills() + [220,306,392].map(x=>sword(x,470,370)).join("") + sword(306,820,430,90) + pathEl("M 180 580 h252 v180 h-252 z",`fill="${C.pale}" stroke="${C.gold}" stroke-width="2" opacity=".6"`);
  if (r === "05") return water(820,200) + [245,306,367].map((x,i)=>sword(x,570,500,-20+i*20)).join("") + sword(130,720,360,78) + sword(482,720,360,-78) + pathEl("M 24 300 Q 150 220 280 320 T 588 280",`fill="none" stroke="${C.deep}" stroke-width="55" opacity=".45"`);
  if (r === "06") return water(690,330) + pathEl("M 120 780 Q 306 900 492 780 L 445 920 Q 306 990 167 920 Z",`fill="${C.charcoal}"`) + [215,255,295,335,375,415].map(x=>sword(x,690,360)).join("");
  if (r === "07") return hills() + [220,260,300,340,380].map((x,i)=>sword(x,640,470,-18+i*9)).join("") + sword(120,760,400) + sword(492,760,400) + [120,492].map(x=>polygon(`${x-40},920 ${x},850 ${x+40},920`,`fill="${C.pale}" stroke="${C.gold}" stroke-width="2"`)).join("");
  if (r === "08") return hills() + [120,170,220,392,442,492,270,342].map((x,i)=>sword(x,i<6?650:720,500)).join("") + line(240,610,372,610,`stroke="${C.white}" stroke-width="20"`) + pathEl("M 245 880 h122 l-28 -260 h-66 z",`fill="${C.deep}" opacity=".55"`);
  if (r === "09") return pathEl("M 72 260 Q 306 190 540 260", `fill="none" stroke="${C.mauve}" stroke-width="36" opacity=".14"`) + Array.from({length:9},(_,i)=>sword(306,265+i*68,430,90)).join("") + circle(306,930,20,`fill="${C.gold}" filter="url(#objectShadow)"`) + pathEl("M 115 965 Q 306 900 497 965", `fill="none" stroke="${C.deep}" stroke-width="5" opacity=".45"`);
  if (r === "10") return pathEl("M 24 815 Q 150 760 282 815 T 588 785 L 588 948 Q 455 1008 306 982 Q 155 1008 24 948 Z", `fill="url(#darkDawn)" opacity=".86"`) + Array.from({length:10},(_,i)=>sword(105+i*45,680,480)).join("") + line(24,858,588,858,`stroke="${C.gold}" stroke-width="8" opacity=".78"`);
  let body = courtBase(card);
  if (r === "page") body += sword(380,560,560);
  if (r === "knight") body += sword(378,520,590,-38) + pathEl("M 30 260 Q 250 150 580 300",`fill="none" stroke="${C.deep}" stroke-width="45" opacity=".45"`);
  if (r === "queen") body += sword(390,530,610) + pathEl("M 120 340 q 80 -80 170 0",`fill="none" stroke="${C.pale}" stroke-width="34" opacity=".65"`) + pathEl("M 480 300 q 30 -25 60 0 q -30 20 -60 0",`fill="${C.charcoal}"`);
  if (r === "king") body += sword(306,510,650) + pathEl("M 160 420 q 146 -120 292 0",`fill="none" stroke="${C.pale}" stroke-width="45" opacity=".5"`) + [180,432].map(x=>pathEl(`M ${x} 500 q 25 -30 50 0 q -25 20 -50 0`,`fill="none" stroke="${C.gold}" stroke-width="3"`)).join("");
  return body;
}

function artPentacles(card) {
  const r = card.rank;
  if (r === "ace") return hills() + coin(306,480,105) + pathEl("M 120 760 Q 170 470 250 400 M 492 760 Q 442 470 362 400",`fill="none" stroke="${C.green}" stroke-width="7"`) + pathEl("M 240 1000 C 280 920 332 920 372 1000",`fill="none" stroke="${C.gold}" stroke-width="6"`);
  if (r === "02") return water(780,240) + coin(230,520,58) + coin(382,700,58) + pathEl("M 230 440 C 420 420 420 760 230 780 C 40 760 40 420 230 440",`fill="none" stroke="${C.gold}" stroke-width="7"`) + pathEl("M 120 880 l 40 -18 l -8 28 z M 430 930 l 45 -20 l -10 30 z",`fill="${C.charcoal}"`);
  if (r === "03") return hills() + pathEl("M 130 900 V430 Q 306 260 482 430 V900",`fill="none" stroke="${C.charcoal}" stroke-width="35"`) + [[230,430],[306,365],[382,430]].map(([x,y])=>coin(x,y,42)).join("") + line(220,700,392,520,`stroke="${C.gold}" stroke-width="3"`) + line(220,520,392,700,`stroke="${C.gold}" stroke-width="3"`);
  if (r === "04") return hills() + [[306,370],[190,610],[422,610],[306,820]].map(([x,y])=>coin(x,y,58)).join("") + pathEl("M 170 900 h272 v-420 h-272 z",`fill="none" stroke="${C.charcoal}" stroke-width="18"`);
  if (r === "05") return pathEl("M 55 560 Q 306 500 557 560", `fill="none" stroke="${C.mauve}" stroke-width="46" opacity=".1"`) + [[215,360],[306,310],[397,360],[250,450],[362,450]].map(([x,y])=>coin(x,y,45,C.deep)).join("") + Array.from({length:20},(_,i)=>circle(70+(i*83)%500,560+(i*47)%360,4,`fill="${C.white}" opacity=".72"`)).join("") + pathEl("M 120 930 C 200 780 230 780 300 930 M 290 930 C 360 760 410 760 492 930",`fill="none" stroke="${C.mauve}" stroke-width="16" filter="url(#softDepth)"`);
  if (r === "06") return hills() + [[160,480],[250,390],[362,390],[452,480],[220,720],[392,720]].map(([x,y])=>coin(x,y,40)).join("") + line(220,560,392,560,`stroke="${C.gold}" stroke-width="4"`) + pathEl("M 220 560 l-55 95 h110 z M 392 560 l-55 95 h110 z",`fill="none" stroke="${C.gold}" stroke-width="3"`);
  if (r === "07") return hills() + pathEl("M 180 880 C 210 700 160 590 250 470 C 310 390 360 560 430 420",`fill="none" stroke="${C.green}" stroke-width="14"`) + [[205,690],[245,560],[300,470],[355,590],[410,470],[290,720],[390,760]].map(([x,y])=>coin(x,y,34)).join("") + line(130,900,260,650,`stroke="${C.gold}" stroke-width="8"`);
  if (r === "08") return hills() + [0,1,2,3,4,5,6].map(i=>coin(470,350+i*82,34)).join("") + coin(270,820,44) + pathEl("M 130 900 h240 v-130 h-240 z",`fill="${C.charcoal}" opacity=".8"`) + line(220,770,290,820,`stroke="${C.gold}" stroke-width="7"`);
  if (r === "09") return hills() + pathEl("M 150 890 C 200 650 180 430 320 300 C 380 410 430 590 470 890",`fill="none" stroke="${C.green}" stroke-width="12"`) + [[180,760],[220,620],[270,500],[335,400],[390,520],[430,660],[280,720],[360,790],[445,820]].map(([x,y])=>coin(x,y,31)).join("") + pathEl("M 130 350 q 35 -35 70 0 q -35 28 -70 0",`fill="${C.charcoal}"`);
  if (r === "10") { const pts=[[306,300],[220,410],[392,410],[160,550],[306,540],[452,550],[210,700],[402,700],[270,840],[342,840]]; return hills()+pts.map(([x,y])=>coin(x,y,34)).join("")+pts.slice(0,-1).map(([x,y],i)=>line(x,y,pts[(i*3+2)%pts.length][0],pts[(i*3+2)%pts.length][1],`stroke="${C.gold}" stroke-width="1" opacity=".45"`)).join("")+pathEl("M 150 950 V720 Q 306 600 462 720 V950",`fill="none" stroke="${C.charcoal}" stroke-width="18"`); }
  let body = courtBase(card);
  if (r === "page") body += coin(388,510,64) + pathEl("M 200 930 q 40 -100 80 0",`fill="none" stroke="${C.green}" stroke-width="7"`);
  if (r === "knight") body += coin(375,525,62) + Array.from({length:7},(_,i)=>line(70+i*70,900,70+i*70,980,`stroke="${C.charcoal}" stroke-width="4"`)).join("");
  if (r === "queen") body += coin(385,545,72) + pathEl("M 100 420 Q 180 300 250 420 M 360 420 Q 445 300 520 420",`fill="none" stroke="${C.green}" stroke-width="9"`) + pathEl("M 150 930 q 35 -45 70 0 q -35 25 -70 0",`fill="${C.charcoal}"`);
  if (r === "king") body += coin(385,520,78) + pathEl("M 100 450 C 160 300 210 330 250 450 M 360 450 C 410 300 470 320 520 450",`fill="none" stroke="${C.green}" stroke-width="12"`) + pathEl("M 470 930 h90 v-150 h-90 z",`fill="${C.charcoal}" opacity=".65"`);
  return body;
}

function isDarkMinor(card) {
  return (card.suit === "swords" && ["09", "10"].includes(card.rank)) ||
    (card.suit === "pentacles" && card.rank === "05");
}

function renderCard(card) {
  const art = card.suit === "wands" ? artWands(card) : card.suit === "cups" ? artCups(card) : card.suit === "swords" ? artSwords(card) : artPentacles(card);
  const dark = isDarkMinor(card);
  const textColor = dark ? C.paper : C.charcoal;
  // Normal cards share the same canonical paper value used throughout the
  // deck/UI. Do not darken the Minor Arcana with a second raster overlay.
  const cardBaseFill = dark ? "url(#nightPaper)" : C.paper;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="612" height="1206" viewBox="0 0 612 1206">
  <defs>
    <linearGradient id="hillMist" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.white}"/><stop offset=".55" stop-color="${C.pale}"/><stop offset="1" stop-color="${C.mauve}"/></linearGradient>
    <linearGradient id="hillBack" x1="0" y1="0" x2="1" y2=".7"><stop offset="0" stop-color="${C.pale}"/><stop offset=".52" stop-color="${C.mauve}"/><stop offset="1" stop-color="${C.deep}"/></linearGradient>
    <linearGradient id="hillFront" x1=".1" y1="0" x2=".9" y2="1"><stop offset="0" stop-color="${C.mauve}"/><stop offset=".55" stop-color="${C.pale}"/><stop offset="1" stop-color="${C.mauveDark}"/></linearGradient>
    <linearGradient id="waterFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.pale}"/><stop offset=".55" stop-color="${C.mauve}"/><stop offset="1" stop-color="${C.deep}"/></linearGradient>
    <linearGradient id="charcoalMineral" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.charcoalSoft}"/><stop offset=".52" stop-color="${C.charcoal}"/><stop offset="1" stop-color="#17181a"/></linearGradient>
    <linearGradient id="bladeFill" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#18191b"/><stop offset=".52" stop-color="${C.charcoalSoft}"/><stop offset="1" stop-color="#111214"/></linearGradient>
    <linearGradient id="wandStroke" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#171719"/><stop offset=".48" stop-color="${C.charcoalSoft}"/><stop offset="1" stop-color="#111214"/></linearGradient>
    <radialGradient id="coinFill" cx="38%" cy="32%" r="72%"><stop offset="0" stop-color="${C.white}"/><stop offset=".58" stop-color="${C.paperShade}"/><stop offset="1" stop-color="${C.mauve}"/></radialGradient>
    <linearGradient id="figurePale" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.white}"/><stop offset=".5" stop-color="${C.pale}"/><stop offset="1" stop-color="${C.mauve}"/></linearGradient>
    <linearGradient id="darkDawn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.charcoal}"/><stop offset=".45" stop-color="${C.deep}"/><stop offset="1" stop-color="${C.pale}"/></linearGradient>
    <linearGradient id="nightPaper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#514b56" stop-opacity=".82"/><stop offset=".16" stop-color="#3e3a43"/><stop offset=".66" stop-color="#29292d"/><stop offset=".88" stop-color="#413c47"/><stop offset="1" stop-color="#625b68"/></linearGradient>
    <filter id="objectShadow" x="-25%" y="-25%" width="150%" height="150%"><feDropShadow dx="4" dy="7" stdDeviation="5" flood-color="#17171a" flood-opacity=".2"/><feDropShadow dx="-2" dy="-2" stdDeviation="2" flood-color="${C.white}" flood-opacity=".12"/></filter>
    <filter id="softDepth" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#29272c" flood-opacity=".18"/></filter>
    <filter id="grain" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".48" numOctaves="4" seed="${card.rankIndex * 17 + card.suit.length}"/><feColorMatrix values="0 0 0 0 .35 0 0 0 0 .31 0 0 0 0 .39 0 0 0 .12 0"/></filter>
    <!-- The artwork clip follows the inside edge of the gold frame. -->
    <clipPath id="artworkClip"><rect x="32" y="32" width="548" height="1142" rx="23"/></clipPath>
  </defs>

  <!-- A final, shared outer clip is applied to every layer. -->
  <clipPath id="cardClip"><rect x="0" y="0" width="612" height="1206" rx="30"/></clipPath>
  <g clip-path="url(#cardClip)">
  <!-- 1. One full-card base. Dark cards select a dark base here, not in the artwork. -->
  <g id="card-base" data-layer="card-base">
    <rect x="0" y="0" width="612" height="1206" rx="30" fill="${cardBaseFill}"/>
    <rect x="0" y="0" width="612" height="1206" rx="30" fill="transparent" filter="url(#grain)" opacity="${dark ? .64 : .58}"/>
  </g>

  <!-- 2. Every illustration element shares one clip inside the gold frame. -->
  <g id="artwork" data-layer="artwork" clip-path="url(#artworkClip)">
    <!-- No scene/background surface is drawn here. The single CARD BASE above
         remains visible through every transparent part of the illustration. -->
    ${dark ? `<path d="M 24 216 Q 165 174 306 194 Q 450 172 588 224" fill="none" stroke="${C.pale}" stroke-width="3" opacity=".1"/><path d="M 24 924 Q 158 982 306 956 Q 460 984 588 912" fill="none" stroke="${C.gold}" stroke-width="2" opacity=".12"/>` : ``}
    ${art}
  </g>

  <!-- 3. The frame is outside the artwork clip and always renders above it. -->
  <rect id="gold-frame" data-layer="gold-frame" x="31" y="31" width="550" height="1144" rx="24" fill="none" stroke="${C.gold}" stroke-width="1.6"/>

  <!-- 4–5. Rank and name are plain text directly on the card base. -->
  <g id="card-copy" data-layer="card-copy">
    <text x="306" y="91" text-anchor="middle" font-family="DejaVu Serif, serif" font-size="31" letter-spacing="5" fill="${textColor}">${esc(card.number)}</text>
    <text x="306" y="1080" text-anchor="middle" font-family="DejaVu Serif, serif" font-size="20" letter-spacing="5" fill="${textColor}">${esc(card.name)}</text>
    <text x="306" y="1122" text-anchor="middle" font-family="DejaVu Serif, serif" font-size="19" fill="${C.gold}">${card.suit === "wands" ? "✦" : card.suit === "cups" ? "▽" : card.suit === "swords" ? "△" : "○"}</text>
  </g>
  </g>
  </svg>`;
}

async function main() {
// Always render the complete 56-card set into a clean staging directory first.
// Nothing in decks/deck-01/cards is replaced until every new PNG has succeeded, so
// a failed build cannot leave a mixture of old and new Minor Arcana cards.
for (const entry of fs.readdirSync(BUILD)) {
  fs.rmSync(path.join(BUILD, entry), { recursive: true, force: true });
}
for (const entry of fs.readdirSync(TMP)) {
  if (/\.(?:svg|png)$/.test(entry)) fs.rmSync(path.join(TMP, entry), { force: true });
}

// Preserve the established treatment of the three dark cards. Normal cards
// use the same paper source at one tenth of that strength: enough to match the
// Major Arcana paper character without darkening their shared #f2eee6 base.
const textureMultiply = fs.existsSync(TEXTURE)
  ? await sharp(TEXTURE).resize(360, 360).removeAlpha().ensureAlpha(.2).png().toBuffer()
  : null;
const textureLight = fs.existsSync(TEXTURE)
  ? await sharp(TEXTURE).resize(260, 260).removeAlpha().ensureAlpha(.14).png().toBuffer()
  : null;
const normalTextureMultiply = fs.existsSync(TEXTURE)
  ? await sharp(TEXTURE).resize(360, 360).removeAlpha().ensureAlpha(.02).png().toBuffer()
  : null;
const normalTextureLight = fs.existsSync(TEXTURE)
  ? await sharp(TEXTURE).resize(260, 260).removeAlpha().ensureAlpha(.014).png().toBuffer()
  : null;
for (const card of minorCards) {
  const svgPath = path.join(TMP, `${card.id}.svg`);
  const pngPath = path.join(BUILD, `${card.id}.png`);
  const svg = renderCard(card);
  fs.writeFileSync(svgPath, svg);
  const image = sharp(Buffer.from(svg)).png();
  if (isDarkMinor(card) && textureMultiply && textureLight) image.composite([
    { input: textureMultiply, tile: true, blend: "multiply" },
    { input: textureLight, tile: true, blend: "soft-light" }
  ]);
  if (!isDarkMinor(card) && normalTextureMultiply && normalTextureLight) image.composite([
    { input: normalTextureMultiply, tile: true, blend: "multiply" },
    { input: normalTextureLight, tile: true, blend: "soft-light" }
  ]);
  const rendered = await image.toBuffer();
  const pngBuffer = await clipCardPng(rendered);
  fs.writeFileSync(pngPath, pngBuffer);
}

const expectedNames = new Set(minorCards.map(card => `${card.id}.png`));
const stagedNames = fs.readdirSync(BUILD).filter(file => file.endsWith(".png"));
if (stagedNames.length !== minorCards.length || stagedNames.some(file => !expectedNames.has(file))) {
  throw new Error(`Staged Minor Arcana set is incomplete or contains unexpected files: ${stagedNames.length}`);
}

// Remove obsolete Minor Arcana filenames only after the clean build succeeds.
for (const entry of fs.readdirSync(OUT)) {
  if (/^(?:wands|cups|swords|pentacles)-.+\.png$/.test(entry) && !expectedNames.has(entry)) {
    fs.rmSync(path.join(OUT, entry), { force: true });
  }
}

// Promote the complete staged set using per-file atomic renames.
for (const card of minorCards) {
  const source = path.join(BUILD, `${card.id}.png`);
  const destination = path.join(OUT, `${card.id}.png`);
  const next = `${destination}.next`;
  fs.copyFileSync(source, next);
  fs.renameSync(next, destination);
}

const sha256 = buffer => crypto.createHash("sha256").update(buffer).digest("hex");
const files = minorCards.map(card => {
  const relativePath = `decks/deck-01/cards/${card.id}.png`;
  const absolutePath = path.join(ROOT, relativePath);
  const stat = fs.statSync(absolutePath);
  return {
    id: card.id,
    path: relativePath,
    size: stat.size,
    mtime: stat.mtime.toISOString(),
    sha256: sha256(fs.readFileSync(absolutePath))
  };
});
const minorSetSha256 = sha256(Buffer.from(files.map(file => `${file.id}:${file.sha256}`).join("\n")));
fs.writeFileSync(path.join(DECK_DIR, "minor-build-manifest.json"), JSON.stringify({
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  canonicalSourceDirectory: "decks/deck-01/cards",
  generator: "tools/generate-minor.cjs",
  generatorSha256: sha256(fs.readFileSync(__filename)),
  minorSetSha256,
  count: files.length,
  files
}, null, 2) + "\n");

const rwsPath = path.join(ROOT, "data", "rws-cards.json");
const deckPath = path.join(DECK_DIR, "deck.json");
const rwsCards = JSON.parse(fs.readFileSync(rwsPath, "utf8"));
const deck = JSON.parse(fs.readFileSync(deckPath, "utf8"));
const rwsById = new Map(rwsCards.map(card => [card.cardId, card]));
for (const card of minorCards) {
  rwsById.set(card.id, {
    cardId: card.id,
    number: card.number,
    nameEn: card.name,
    suit: card.suit,
    rank: card.rank,
    rwsSymbols: card.rwsSymbols,
    upright: {
      keywords: card.upright.keywords,
      meaning: card.upright.meaning
    },
    reversed: {
      keywords: card.reversed.keywords,
      meaning: card.reversed.meaning
    }
  });
  deck.cards[card.id] = {
    image: `./cards/${card.id}.png`,
    visualMotif: card.visualMotif,
    upright: {
      question: card.uprightQuestion
    },
    reversed: {
      question: card.reversedQuestion
    }
  };
}
fs.writeFileSync(rwsPath, `${JSON.stringify([...rwsById.values()], null, 2)}\n`);
fs.writeFileSync(deckPath, `${JSON.stringify(deck, null, 2)}\n`);
console.log(`Generated ${minorCards.length} Minor Arcana cards from a clean staging directory.`);
console.log(`Minor set SHA-256: ${minorSetSha256}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
