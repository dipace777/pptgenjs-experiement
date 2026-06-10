import { SLIDE_H, type Deck, type Slide, type SlideElement } from "../lib/slide-schema";

// A coffee deck that avoids the expected all-brown cafe look. The brand world
// is roast-dark, mint-bright, coral-lit, and editorial.
const ROAST = "211714";
const ESPRESSO = "3B211B";
const CREAM = "F7F0E2";
const FOAM = "FFF8EA";
const MINT = "87D8B7";
const CORAL = "F26B5E";
const SAFFRON = "F2B84B";
const PLUM = "35213D";
const INK = "211714";
const MUTED = "7A665D";
const LINE = "E4D8C4";
const WHITE = "FFFFFF";

const SANS = "Arial";
const SERIF = "Georgia";
const TOTAL = 8;

const HERO_CUP_SVG = `<svg viewBox="0 0 900 620" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="heroGlow" cx="52%" cy="42%" r="54%">
      <stop offset="0%" stop-color="#F2B84B" stop-opacity="0.55"/>
      <stop offset="48%" stop-color="#F26B5E" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#211714" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="cup" x1="0" x2="1">
      <stop offset="0%" stop-color="#FFF8EA"/>
      <stop offset="54%" stop-color="#F7F0E2"/>
      <stop offset="100%" stop-color="#C7AA84"/>
    </linearGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="7"/></filter>
  </defs>
  <rect width="900" height="620" fill="#211714"/>
  <circle cx="500" cy="295" r="290" fill="url(#heroGlow)"/>
  <g fill="none" stroke-linecap="round" opacity="0.95">
    <path d="M328 171 C262 98, 392 82, 327 28" stroke="#87D8B7" stroke-width="14"/>
    <path d="M430 160 C362 88, 498 74, 447 18" stroke="#F26B5E" stroke-width="12"/>
    <path d="M536 178 C478 118, 594 92, 554 48" stroke="#F2B84B" stroke-width="10"/>
  </g>
  <ellipse cx="446" cy="512" rx="255" ry="36" fill="#000" opacity="0.3" filter="url(#soft)"/>
  <path d="M228 244 H605 L562 512 H280 Z" fill="url(#cup)"/>
  <ellipse cx="416" cy="244" rx="188" ry="44" fill="#FFF8EA"/>
  <ellipse cx="416" cy="246" rx="142" ry="28" fill="#3B211B"/>
  <path d="M603 294 C725 278, 737 427, 574 420 L587 354 C659 365, 662 322, 596 326 Z" fill="none" stroke="#FFF8EA" stroke-width="34" stroke-linejoin="round"/>
  <path d="M303 352 C383 392, 466 388, 541 346" fill="none" stroke="#F26B5E" stroke-width="15" stroke-linecap="round"/>
  <g fill="#87D8B7">
    <circle cx="252" cy="211" r="12"/>
    <circle cx="636" cy="208" r="10"/>
    <circle cx="688" cy="462" r="14"/>
  </g>
</svg>`;

const BEAN_CONSTELLATION_SVG = `<svg viewBox="0 0 1000 562" xmlns="http://www.w3.org/2000/svg">
  <rect width="1000" height="562" fill="#F7F0E2"/>
  <g opacity="0.9">
    <path d="M0 416 C166 300, 288 500, 462 350 C637 198, 778 400, 1000 225" fill="none" stroke="#87D8B7" stroke-width="22" stroke-linecap="round"/>
    <path d="M0 342 C140 246, 280 438, 440 286 C628 111, 774 322, 1000 138" fill="none" stroke="#F26B5E" stroke-width="8" stroke-linecap="round" opacity="0.65"/>
  </g>
  <g fill="#3B211B" opacity="0.95">
    <ellipse cx="150" cy="332" rx="32" ry="45" transform="rotate(-24 150 332)"/>
    <ellipse cx="302" cy="417" rx="24" ry="35" transform="rotate(32 302 417)"/>
    <ellipse cx="470" cy="330" rx="35" ry="48" transform="rotate(-16 470 330)"/>
    <ellipse cx="640" cy="222" rx="26" ry="38" transform="rotate(28 640 222)"/>
    <ellipse cx="815" cy="292" rx="31" ry="44" transform="rotate(-32 815 292)"/>
  </g>
  <g fill="none" stroke="#F7F0E2" stroke-width="4" opacity="0.82">
    <path d="M139 294 C170 322, 171 353, 148 372"/>
    <path d="M290 390 C316 412, 316 436, 299 449"/>
    <path d="M459 291 C493 322, 493 354, 469 374"/>
    <path d="M628 191 C655 218, 655 244, 638 256"/>
    <path d="M801 253 C833 285, 834 316, 812 333"/>
  </g>
</svg>`;

const PACK_SYSTEM_SVG = `<svg viewBox="0 0 820 520" xmlns="http://www.w3.org/2000/svg">
  <rect width="820" height="520" rx="34" fill="#35213D"/>
  <g transform="translate(74 58)">
    <rect x="0" y="42" width="190" height="335" rx="20" fill="#F7F0E2"/>
    <path d="M24 42 L58 0 H132 L166 42 Z" fill="#87D8B7"/>
    <rect x="29" y="100" width="132" height="112" rx="18" fill="#211714"/>
    <circle cx="95" cy="156" r="38" fill="#F2B84B"/>
    <path d="M70 156 C92 118, 122 118, 140 156" fill="none" stroke="#F26B5E" stroke-width="10" stroke-linecap="round"/>
    <rect x="38" y="244" width="114" height="13" rx="6.5" fill="#3B211B"/>
    <rect x="56" y="272" width="78" height="9" rx="4.5" fill="#7A665D"/>
  </g>
  <g transform="translate(326 86)">
    <rect width="176" height="250" rx="24" fill="#87D8B7"/>
    <text x="32" y="76" fill="#211714" font-family="Arial" font-size="25" font-weight="700">MINT</text>
    <text x="32" y="112" fill="#211714" font-family="Georgia" font-size="42">Cold</text>
    <text x="32" y="158" fill="#211714" font-family="Georgia" font-size="42">Brew</text>
    <circle cx="132" cy="198" r="24" fill="#F26B5E"/>
  </g>
  <g transform="translate(552 132)">
    <rect width="170" height="218" rx="22" fill="#F26B5E"/>
    <text x="28" y="68" fill="#FFF8EA" font-family="Georgia" font-size="43">Glow</text>
    <text x="28" y="112" fill="#FFF8EA" font-family="Arial" font-size="18" font-weight="700">ESPRESSO</text>
    <path d="M40 156 C80 118, 114 118, 142 156" fill="none" stroke="#F2B84B" stroke-width="12" stroke-linecap="round"/>
  </g>
</svg>`;

const FLAVOR_WHEEL_SVG = `<svg viewBox="0 0 560 560" xmlns="http://www.w3.org/2000/svg">
  <rect width="560" height="560" rx="36" fill="#211714"/>
  <g transform="translate(280 280)">
    <path d="M0 0 L0 -212 A212 212 0 0 1 184 -106 Z" fill="#F26B5E"/>
    <path d="M0 0 L184 -106 A212 212 0 0 1 184 106 Z" fill="#F2B84B"/>
    <path d="M0 0 L184 106 A212 212 0 0 1 0 212 Z" fill="#87D8B7"/>
    <path d="M0 0 L0 212 A212 212 0 0 1 -184 106 Z" fill="#F7F0E2"/>
    <path d="M0 0 L-184 106 A212 212 0 0 1 -184 -106 Z" fill="#C7AA84"/>
    <path d="M0 0 L-184 -106 A212 212 0 0 1 0 -212 Z" fill="#7E4D3D"/>
    <circle r="118" fill="#211714"/>
    <circle r="64" fill="#FFF8EA"/>
    <text x="-40" y="10" fill="#211714" font-family="Georgia" font-size="28">Taste</text>
  </g>
</svg>`;

const CHANNELS_SVG = `<svg viewBox="0 0 960 300" xmlns="http://www.w3.org/2000/svg">
  <rect width="960" height="300" fill="#FFF8EA"/>
  <g fill="none" stroke="#211714" stroke-width="5" opacity="0.16">
    <path d="M85 146 H875"/>
    <path d="M242 146 C282 68, 352 68, 392 146"/>
    <path d="M568 146 C608 224, 678 224, 718 146"/>
  </g>
  <g>
    <circle cx="110" cy="146" r="54" fill="#F26B5E"/>
    <circle cx="296" cy="146" r="54" fill="#87D8B7"/>
    <circle cx="482" cy="146" r="54" fill="#F2B84B"/>
    <circle cx="668" cy="146" r="54" fill="#35213D"/>
    <circle cx="854" cy="146" r="54" fill="#3B211B"/>
  </g>
  <g fill="#FFF8EA" font-family="Arial" font-size="24" font-weight="700" text-anchor="middle">
    <text x="110" y="154">OOH</text>
    <text x="296" y="154" fill="#211714">SOC</text>
    <text x="482" y="154" fill="#211714">IRL</text>
    <text x="668" y="154">CRM</text>
    <text x="854" y="154">RET</text>
  </g>
</svg>`;

function footer(num: number, onDark: boolean): SlideElement[] {
  const color = onDark ? "C9B9A7" : MUTED;
  return [
    { type: "text", position: { x: 0.55, y: 5.25 }, size: { width: 3.5, height: 0.22 }, font: { family: SANS, size: 8, color: color, bold: true, letterSpacing: 260 }, runs: [{ text: "MIDNIGHT ROAST" }] },
    { type: "text", position: { x: 8.75, y: 5.25 }, size: { width: 0.8, height: 0.22 }, font: { family: SANS, size: 8, color: color, bold: true }, alignment: { horizontal: "right" }, runs: [{ text: `${num}/${TOTAL}` }] },
  ];
}

function eyebrow(text: string, color = CORAL): SlideElement {
  return { type: "text", position: { x: 0.62, y: 0.52 }, size: { width: 5.8, height: 0.22 }, font: { family: SANS, size: 8, color: color, bold: true, letterSpacing: 260 }, runs: [{ text: text }] };
}

function stat(x: number, value: string, label: string, color: string): SlideElement[] {
  return [
    { type: "rectangle", position: { x: x, y: 4.06 }, size: { width: 1.55, height: 0.72 }, fill: { color: color }, borderRadius: { tl: 0.08, tr: 0.08, bl: 0.08, br: 0.08 } },
    { type: "text", position: { x: x + 0.16, y: 4.2 }, size: { width: 1.23, height: 0.28 }, font: { family: SANS, size: 22, color: color === CREAM || color === MINT || color === SAFFRON ? INK : WHITE, bold: true }, alignment: { horizontal: "center" }, runs: [{ text: value }] },
    { type: "text", position: { x: x + 0.18, y: 4.52 }, size: { width: 1.2, height: 0.16 }, font: { family: SANS, size: 6.5, color: color === CREAM || color === MINT || color === SAFFRON ? INK : WHITE, bold: true, letterSpacing: 130 }, alignment: { horizontal: "center" }, runs: [{ text: label }] },
  ];
}

const slide1Cover: Slide = {
  title: "Campaign Cover",
  background: ROAST,
  elements: [
    { type: "svg", position: { x: 4.72, y: 0 }, size: { width: 5.28, height: SLIDE_H }, svg: HERO_CUP_SVG, name: "Glowing coffee cup" },
    { type: "rectangle", position: { x: 0, y: 0 }, size: { width: 4.82, height: SLIDE_H }, fill: { color: ROAST } },
    { type: "rectangle", position: { x: 0.62, y: 0.62 }, size: { width: 0.56, height: 0.05 }, fill: { color: MINT } },
    { type: "text", position: { x: 0.62, y: 0.88 }, size: { width: 3.6, height: 0.22 }, font: { family: SANS, size: 8, color: MINT, bold: true, letterSpacing: 250 }, runs: [{ text: "COFFEE MARKETING SYSTEM" }] },
    { type: "text", position: { x: 0.55, y: 1.38 }, size: { width: 4.45, height: 1.92 }, font: { family: SERIF, size: 64, color: FOAM, bold: true, lineHeight: 0.96 }, runs: [{ text: "Midnight\nRoast" }] },
    { type: "text", position: { x: 0.65, y: 3.5 }, size: { width: 3.55, height: 0.56 }, font: { family: SANS, size: 13, color: "D7C8B8", lineHeight: 1.35 }, runs: [{ text: "A sensory launch campaign for an evening coffee ritual: bold enough for night, smooth enough for every day." }] },
    ...stat(0.65, "4.7x", "SOCIAL LIFT", CORAL),
    ...stat(2.38, "62%", "TRIAL INTENT", MINT),
    ...footer(1, true),
  ],
};

const slide2Audience: Slide = {
  title: "Audience Signal",
  background: CREAM,
  elements: [
    { type: "svg", position: { x: 0, y: 2.0 }, size: { width: 10, height: 2.55 }, svg: BEAN_CONSTELLATION_SVG, name: "Bean signal map" },
    eyebrow("01 · AUDIENCE SIGNAL", CORAL),
    { type: "text", position: { x: 0.62, y: 0.9 }, size: { width: 7.4, height: 0.78 }, font: { family: SERIF, size: 34, color: INK, bold: true }, runs: [{ text: "The next coffee occasion is after hours." }] },
    { type: "text-list", position: { x: 6.35, y: 0.8 }, size: { width: 2.95, height: 1.0 }, font: { family: SANS, size: 12, color: INK, lineHeight: 1.18 }, marker: "bullet", items: [{ type: "text", text: "Remote workers want a softer second wind" }, { type: "text", text: "Creators buy rituals, not just caffeine" }, { type: "text", text: "Flavor-forward coffee travels on social" }] },
    ...stat(0.7, "8:43", "PEAK SAVE TIME", PLUM),
    ...stat(2.5, "38M", "NIGHT-SCROLL REACH", CORAL),
    ...stat(4.3, "+24%", "DECAF CURIOUS", SAFFRON),
    ...stat(6.1, "71%", "RITUAL SEEKERS", MINT),
    ...footer(2, false),
  ],
};

const slide3ProductWorld: Slide = {
  title: "Product World",
  background: PLUM,
  elements: [
    { type: "svg", position: { x: 0.48, y: 0.48 }, size: { width: 5.05, height: 3.2 }, svg: PACK_SYSTEM_SVG, name: "Packaging system" },
    eyebrow("02 · PRODUCT WORLD", MINT),
    { type: "text", position: { x: 5.95, y: 0.96 }, size: { width: 3.42, height: 1.0 }, font: { family: SERIF, size: 34, color: FOAM, bold: true, lineHeight: 1.05 }, runs: [{ text: "Three packs. One night ritual." }] },
    { type: "table", position: { x: 5.95, y: 2.32 }, size: { width: 3.25, height: 1.55 }, font: { family: SANS, size: 8.5, color: FOAM }, columns: [{ text: "SKU", fill: { color: CORAL }, font: { color: WHITE, bold: true }, stroke: { color: "6B4A70", width: 1 } }, { text: "Mood", fill: { color: CORAL }, font: { color: WHITE, bold: true }, stroke: { color: "6B4A70", width: 1 } }, { text: "Hero note", fill: { color: CORAL }, font: { color: WHITE, bold: true }, stroke: { color: "6B4A70", width: 1 } }], rows: [[{ text: "Velvet", fill: { color: "45284F" }, stroke: { color: "6B4A70", width: 1 } }, { text: "Calm", fill: { color: "45284F" }, stroke: { color: "6B4A70", width: 1 } }, { text: "Cocoa", fill: { color: "45284F" }, stroke: { color: "6B4A70", width: 1 } }], [{ text: "Mint", fill: { color: "45284F" }, stroke: { color: "6B4A70", width: 1 } }, { text: "Bright", fill: { color: "45284F" }, stroke: { color: "6B4A70", width: 1 } }, { text: "Herbal", fill: { color: "45284F" }, stroke: { color: "6B4A70", width: 1 } }], [{ text: "Glow", fill: { color: "45284F" }, stroke: { color: "6B4A70", width: 1 } }, { text: "Bold", fill: { color: "45284F" }, stroke: { color: "6B4A70", width: 1 } }, { text: "Citrus", fill: { color: "45284F" }, stroke: { color: "6B4A70", width: 1 } }]] },
    { type: "text", position: { x: 5.98, y: 4.18 }, size: { width: 3.1, height: 0.42 }, font: { family: SANS, size: 11.5, color: "D8C8DF", lineHeight: 1.3 }, runs: [{ text: "Packaging designed for shelf stop, creator close-ups, and unboxing motion." }] },
    ...footer(3, true),
  ],
};

const slide4Flavor: Slide = {
  title: "Flavor Strategy",
  background: FOAM,
  elements: [
    eyebrow("03 · FLAVOR STRATEGY", PLUM),
    { type: "text", position: { x: 0.62, y: 0.9 }, size: { width: 4.2, height: 1.0 }, font: { family: SERIF, size: 33, color: INK, bold: true, lineHeight: 1.06 }, runs: [{ text: "Build taste memory, not menu clutter." }] },
    { type: "svg", position: { x: 5.65, y: 0.56 }, size: { width: 3.65, height: 3.65 }, svg: FLAVOR_WHEEL_SVG, name: "Flavor wheel" },
    { type: "chart", position: { x: 0.7, y: 2.35 }, size: { width: 4.35, height: 1.76 }, chartType: "bar", data: [
        { label: "Cocoa", value: 84, color: ESPRESSO },
        { label: "Mint", value: 76, color: MINT },
        { label: "Citrus", value: 68, color: CORAL },
        { label: "Smoke", value: 52, color: PLUM },
      ], title: "Flavor pull in concept test", color: CORAL, axisColor: LINE, labelColor: MUTED, showValues: true },
    { type: "text", position: { x: 5.85, y: 4.34 }, size: { width: 3.25, height: 0.36 }, font: { family: SANS, size: 12, color: MUTED, lineHeight: 1.25 }, runs: [{ text: "Lead with cocoa comfort, then let mint and citrus create the talkable edge." }] },
    ...footer(4, false),
  ],
};

const slide5Campaign: Slide = {
  title: "Campaign System",
  background: CREAM,
  elements: [
    eyebrow("04 · CAMPAIGN SYSTEM", CORAL),
    { type: "text", position: { x: 0.62, y: 0.9 }, size: { width: 6.8, height: 0.76 }, font: { family: SERIF, size: 33, color: INK, bold: true }, runs: [{ text: "One ritual, five channel moments." }] },
    { type: "svg", position: { x: 0.55, y: 1.88 }, size: { width: 8.9, height: 2.78 }, svg: CHANNELS_SVG, name: "Campaign channels" },
    ...["Out-of-home glow", "Creator night desk", "Tasting pop-up", "SMS reorder", "Retail endcap"].map((label, index): SlideElement => ({ type: "text", position: { x: 0.55 + index * 1.86, y: 4.65 }, size: { width: 1.32, height: 0.28 }, font: { family: SANS, size: 8.5, color: INK, bold: true }, alignment: { horizontal: "center" }, runs: [{ text: label }] })),
    ...footer(5, false),
  ],
};

const slide6Content: Slide = {
  title: "Content Engine",
  background: ROAST,
  elements: [
    { type: "rectangle", position: { x: 0.52, y: 0.52 }, size: { width: 2.08, height: 3.95 }, fill: { color: FOAM }, borderRadius: { tl: 0.1, tr: 0.1, bl: 0.1, br: 0.1 } },
    { type: "rectangle", position: { x: 2.85, y: 1.06 }, size: { width: 2.08, height: 3.95 }, fill: { color: MINT }, borderRadius: { tl: 0.1, tr: 0.1, bl: 0.1, br: 0.1 } },
    { type: "rectangle", position: { x: 5.18, y: 0.52 }, size: { width: 2.08, height: 3.95 }, fill: { color: CORAL }, borderRadius: { tl: 0.1, tr: 0.1, bl: 0.1, br: 0.1 } },
    { type: "rectangle", position: { x: 7.51, y: 1.06 }, size: { width: 2.08, height: 3.95 }, fill: { color: SAFFRON }, borderRadius: { tl: 0.1, tr: 0.1, bl: 0.1, br: 0.1 } },
    ...["POUR", "PAUSE", "POST", "PICKUP"].flatMap((word, index): SlideElement[] => {
      const x = 0.52 + index * 2.33;
      const y = index % 2 === 0 ? 0.52 : 1.06;
      return [
        { type: "text", position: { x: x + 0.25, y: y + 0.32 }, size: { width: 1.55, height: 0.34 }, font: { family: SANS, size: 16, color: index === 0 || index === 3 ? INK : ROAST, bold: true, letterSpacing: 120 }, alignment: { horizontal: "center" }, runs: [{ text: word }] },
        { type: "image", position: { x: x + 0.24, y: y + 0.9 }, size: { width: 1.6, height: 1.88 }, name: `${word} image slot`, fit: "cover" },
        { type: "text", position: { x: x + 0.24, y: y + 3.05 }, size: { width: 1.6, height: 0.28 }, font: { family: SANS, size: 9.5, color: index === 0 || index === 3 ? MUTED : ROAST, bold: true }, alignment: { horizontal: "center" }, runs: [{ text: ["Steam macro", "Desk ritual", "Creator cut", "Shelf story"][index] }] },
      ];
    }),
    ...footer(6, true),
  ],
};

const slide7Forecast: Slide = {
  title: "Forecast",
  background: FOAM,
  elements: [
    eyebrow("06 · GROWTH FORECAST", CORAL),
    { type: "text", position: { x: 0.62, y: 0.9 }, size: { width: 4.0, height: 0.82 }, font: { family: SERIF, size: 32, color: INK, bold: true, lineHeight: 1.06 }, runs: [{ text: "Trial compounds when ritual repeats." }] },
    { type: "chart", position: { x: 0.72, y: 2.04 }, size: { width: 4.52, height: 2.22 }, chartType: "line", data: [
        { label: "W1", value: 18, color: CORAL },
        { label: "W2", value: 29, color: CORAL },
        { label: "W3", value: 46, color: CORAL },
        { label: "W4", value: 58, color: CORAL },
        { label: "W5", value: 72, color: CORAL },
      ], title: "Repeat purchase curve", color: CORAL, axisColor: LINE, labelColor: MUTED, showValues: true },
    { type: "chart", position: { x: 5.72, y: 1.08 }, size: { width: 3.38, height: 2.28 }, chartType: "donut", data: [
        { label: "Social", value: 42, color: CORAL },
        { label: "Retail", value: 26, color: ESPRESSO },
        { label: "OOH", value: 20, color: MINT },
        { label: "CRM", value: 12, color: SAFFRON },
      ], title: "Media mix", color: PLUM, labelColor: MUTED, showValues: true },
    ...stat(5.78, "$2.8M", "LAUNCH REVENUE", PLUM),
    ...stat(7.55, "41%", "REPEAT TARGET", CORAL),
    ...footer(7, false),
  ],
};

const slide8Close: Slide = {
  title: "Closing",
  background: ROAST,
  elements: [
    { type: "svg", position: { x: 0, y: 0 }, size: { width: 10, height: SLIDE_H }, opacity: 0.34, svg: HERO_CUP_SVG, name: "Closing cup glow" },
    { type: "rectangle", position: { x: 0, y: 0 }, size: { width: 10, height: SLIDE_H }, opacity: 0.55, fill: { color: ROAST } },
    { type: "text", position: { x: 0.8, y: 0.78 }, size: { width: 8.4, height: 0.26 }, font: { family: SANS, size: 9, color: MINT, bold: true, letterSpacing: 300 }, alignment: { horizontal: "center" }, runs: [{ text: "THE ASK" }] },
    { type: "text", position: { x: 0.8, y: 1.45 }, size: { width: 8.4, height: 1.34 }, font: { family: SERIF, size: 47, color: FOAM, bold: true, lineHeight: 1.03 }, alignment: { horizontal: "center" }, runs: [{ text: "Make coffee feel like the night turning on." }] },
    { type: "text-list", position: { x: 2.35, y: 3.38 }, size: { width: 5.3, height: 0.9 }, font: { family: SANS, size: 14, color: FOAM, lineHeight: 1.18 }, marker: "bullet", items: [{ type: "text", text: "Approve hero packaging system" }, { type: "text", text: "Fund creator and retail launch" }, { type: "text", text: "Ship the 8-week ritual calendar" }] },
    { type: "rectangle", position: { x: 3.82, y: 4.62 }, size: { width: 2.35, height: 0.05 }, fill: { color: CORAL } },
    ...footer(8, true),
  ],
};

export const coffeeMarketingDeck: Deck = {
  title: "Midnight Roast Coffee Marketing",
  description:
    "A premium coffee campaign deck for an evening ritual launch, built with editable charts, SVG scenes, tables, image placeholders, and rich brand layouts.",
  theme: {
    background: CREAM,
    surface: FOAM,
    primary: ROAST,
    secondary: PLUM,
    accent: CORAL,
    text: INK,
    muted: MUTED,
  },
  slides: [
    slide1Cover,
    slide2Audience,
    slide3ProductWorld,
    slide4Flavor,
    slide5Campaign,
    slide6Content,
    slide7Forecast,
    slide8Close,
  ],
};
