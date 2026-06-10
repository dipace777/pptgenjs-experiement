import { type Deck, type Slide, type SlideElement } from "../lib/slide-schema";

// ── Editorial cream-paper palette ───────────────────────────────────────
// Distinct from layout-kit's corporate navy/gold. The pitch deck reads like
// a print magazine: warm paper, big serif headlines, a single confident
// accent doing all the heavy lifting.
const PAPER = "F5F1E8";       // warm cream — slide background
const SURFACE = "FFFFFF";     // pure white — cards
const INK = "1A1A1A";         // deep near-black — body type
const CORAL = "D9534F";       // primary accent — single hero color
const DEEP = "5A2620";        // burgundy — section dividers / emphasis bg
const AMBER = "C49D5E";       // aged-gold secondary accent
const MUTED = "6B6B6B";       // mid-gray meta text
const WHISPER = "B0B0B0";     // lighter gray
const LINE = "E0DCD3";        // hairline separator

// Georgia ships with PowerPoint, Keynote, Google Slides and macOS/Windows
// — safe cross-renderer serif. Pairs with Arial for body.
const SERIF = "Georgia";
const SANS = "Arial";

const TOTAL = 10;

// ── Shared chrome ───────────────────────────────────────────────────────
function footer(num: number, total: number, onDeep: boolean): SlideElement[] {
  const c = onDeep ? WHISPER : MUTED;
  return [
    { type: "text", position: { x: 0.5, y: 5.25 }, size: { width: 4, height: 0.3 }, font: { family: SERIF, size: 11, color: c, italic: true }, runs: [{ text: "Starship" }] },
    { type: "text", position: { x: 8.5, y: 5.25 }, size: { width: 1.0, height: 0.3 }, font: { family: SERIF, size: 10, color: c, italic: true }, alignment: { horizontal: "right" }, runs: [{ text: `${num} / ${total}` }] },
  ];
}

function eyebrow(text: string, color: string = CORAL): SlideElement {
  return { type: "text", position: { x: 0.6, y: 0.65 }, size: { width: 6, height: 0.28 }, font: { family: SANS, size: 10, color: color, bold: true, letterSpacing: 340 }, runs: [{ text: text }] };
}

function headline(text: string): SlideElement {
  return { type: "text", position: { x: 0.6, y: 1.0 }, size: { width: 8.8, height: 0.85 }, font: { family: SERIF, size: 36, color: INK, lineHeight: 1.05 }, runs: [{ text: text }] };
}

// Coral hairline under headlines — replaces layout-kit's gold accent rect.
function rule(y: number, w = 0.7, color = CORAL): SlideElement {
  return { type: "rectangle", position: { x: 0.6, y: y }, size: { width: w, height: 0.025 }, fill: { color: color } };
}

// ── Slide 1: Cover ──────────────────────────────────────────────────────
const slide1Cover: Slide = {
  title: "Cover",
  background: PAPER,
  elements: [
    // Right-margin marker — a hairline rule with a coral pin, the kind of
    // confident single flourish you'd see on a magazine cover.
    { type: "rectangle", position: { x: 9.4, y: 0.6 }, size: { width: 0.04, height: 4.4 }, fill: { color: CORAL } },
    { type: "ellipse", position: { x: 9.22, y: 0.42 }, size: { width: 0.4, height: 0.4 }, fill: { color: CORAL } },

    { type: "text", position: { x: 0.6, y: 0.65 }, size: { width: 6, height: 0.28 }, font: { family: SANS, size: 10, color: CORAL, bold: true, letterSpacing: 340 }, runs: [{ text: "SERIES A · SPRING 2026" }] },

    // Massive serif wordmark — left-aligned, hero of the slide.
    { type: "text", position: { x: 0.55, y: 1.55 }, size: { width: 7, height: 2.0 }, font: { family: SERIF, size: 110, color: INK, lineHeight: 1.0 }, runs: [{ text: "Starship." }] },

    rule(3.55, 0.6, CORAL),

    { type: "text", position: { x: 0.6, y: 3.75 }, size: { width: 6.2, height: 0.9 }, font: { family: SERIF, size: 18, color: INK, italic: true, lineHeight: 1.4 }, runs: [{ text: "An operating system for the next generation of small teams." }] },

    { type: "text", position: { x: 0.6, y: 4.78 }, size: { width: 5, height: 0.28 }, font: { family: SANS, size: 12, color: INK }, runs: [{ text: "Jane Founder — CEO" }] },
    { type: "text", position: { x: 0.6, y: 5.05 }, size: { width: 5, height: 0.25 }, font: { family: SANS, size: 11, color: MUTED }, runs: [{ text: "jane@starship.example" }] },
  ],
};

// ── Slide 2: Problem ────────────────────────────────────────────────────
function problemStat(x: number, big: string, label: string): SlideElement[] {
  return [
    { type: "text", position: { x: x, y: 3.5 }, size: { width: 2.8, height: 1.0 }, font: { family: SERIF, size: 56, color: CORAL, lineHeight: 1.0 }, runs: [{ text: big }] },
    { type: "rectangle", position: { x: x, y: 4.5 }, size: { width: 0.35, height: 0.025 }, fill: { color: INK } },
    { type: "text", position: { x: x, y: 4.6 }, size: { width: 2.8, height: 0.5 }, font: { family: SANS, size: 11, color: INK, lineHeight: 1.4 }, runs: [{ text: label }] },
  ];
}

const slide2Problem: Slide = {
  title: "Problem",
  background: PAPER,
  elements: [
    eyebrow("THE PROBLEM"),
    { type: "text", position: { x: 0.6, y: 1.05 }, size: { width: 8.8, height: 2.1 }, font: { family: SERIF, size: 32, color: INK, lineHeight: 1.2 }, runs: [{ text: "Small teams ship a dozen tools to do the work of one — and pay the\n" +
        "spreadsheet tax every Friday afternoon." }] },
    rule(3.3, 0.6),
    ...problemStat(0.6, "11", "tools in the average operations stack"),
    ...problemStat(3.7, "62%", "of week lost stitching context across tools"),
    ...problemStat(6.8, "$48k", "per FTE per year on operations software"),
    ...footer(2, TOTAL, false),
  ],
};

// ── Slide 3: Solution ───────────────────────────────────────────────────
const slide3Solution: Slide = {
  title: "Solution",
  background: PAPER,
  elements: [
    eyebrow("THE SOLUTION"),
    headline("One workspace.\nThe work, the data, the decision."),
    rule(2.0, 0.6),

    { type: "text", position: { x: 0.6, y: 2.3 }, size: { width: 4.3, height: 2.2 }, font: { family: SANS, size: 13, color: INK, lineHeight: 1.55 }, runs: [{ text: "Starship unifies the operating layer — projects, customers, " +
        "contracts, and finance — into a single editable surface. " +
        "Replaces the spreadsheet tax with a model your team can " +
        "actually trust." }] },

    { type: "text", position: { x: 0.6, y: 4.65 }, size: { width: 4.3, height: 0.25 }, font: { family: SANS, size: 9, color: CORAL, bold: true, letterSpacing: 280 }, runs: [{ text: "BUILT FOR TEAMS OF 5 TO 50" }] },

    // Image with a coral rule above it — editorial caption treatment.
    { type: "rectangle", position: { x: 5.25, y: 2.25 }, size: { width: 0.5, height: 0.04 }, fill: { color: CORAL } },
    { type: "image", position: { x: 5.25, y: 2.4 }, size: { width: 4.15, height: 2.6 }, name: "Product screenshot placeholder", fit: "cover" },
    ...footer(3, TOTAL, false),
  ],
};

// ── Slide 4: Why now ────────────────────────────────────────────────────
function whyNowItem(y: number, num: string, title: string, body: string): SlideElement[] {
  return [
    // Big serif number on the left
    { type: "text", position: { x: 0.6, y: y }, size: { width: 0.9, height: 0.7 }, font: { family: SERIF, size: 38, color: CORAL, italic: true, lineHeight: 1.0 }, runs: [{ text: num }] },
    // Title in serif
    { type: "text", position: { x: 1.7, y: y + 0.05 }, size: { width: 7.6, height: 0.45 }, font: { family: SERIF, size: 18, color: INK }, runs: [{ text: title }] },
    // Body in sans
    { type: "text", position: { x: 1.7, y: y + 0.55 }, size: { width: 7.6, height: 0.4 }, font: { family: SANS, size: 12, color: MUTED, lineHeight: 1.4 }, runs: [{ text: body }] },
    // Hairline separator below
    { type: "rectangle", position: { x: 1.7, y: y + 1.05 }, size: { width: 7.6, height: 0.01 }, fill: { color: LINE } },
  ];
}

const slide4WhyNow: Slide = {
  title: "Why Now",
  background: PAPER,
  elements: [
    eyebrow("WHY NOW"),
    headline("Three forces just made the old stack obsolete."),
    rule(2.0, 0.6),
    ...whyNowItem(
      2.2,
      "01",
      "AI assistants go mainstream",
      "Embedded copilots collapsed the cost of building integrated workflows.",
    ),
    ...whyNowItem(
      3.25,
      "02",
      "Distributed hiring is default",
      "Small teams now operate across five timezones — async coordination is non-negotiable.",
    ),
    ...whyNowItem(
      4.3,
      "03",
      "SaaS budgets are being cut",
      "CFOs are consolidating tools; the team that replaces four wins the budget.",
    ),
    ...footer(4, TOTAL, false),
  ],
};

// ── Slide 5: Product ────────────────────────────────────────────────────
const slide5Product: Slide = {
  title: "Product",
  background: PAPER,
  elements: [
    eyebrow("PRODUCT"),
    headline("Four surfaces. One model underneath."),
    rule(2.0, 0.6),
    ...[
      ["Operate", "Run projects with built-in finance and capacity tracking."],
      ["Decide", "Compare scenarios with versioned, queryable docs."],
      ["Automate", "Trigger workflows from any field with no-code recipes."],
      ["Report", "Ship board-ready views without rebuilding the spreadsheet."],
    ].flatMap((entry, index): SlideElement[] => {
      const [label, body] = entry;
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = 0.6 + col * 4.4;
      const y = 2.25 + row * 1.35;
      return [
        // Subtle card — only a hairline border + paper-white fill.
        { type: "rectangle", position: { x: x, y: y }, size: { width: 4.15, height: 1.15 }, fill: { color: SURFACE }, stroke: { color: LINE, width: 0.5 } },
        // Coral hairline above the feature name — replaces the gold stripe.
        { type: "rectangle", position: { x: x + 0.3, y: y + 0.22 }, size: { width: 0.32, height: 0.025 }, fill: { color: CORAL } },
        { type: "text", position: { x: x + 0.3, y: y + 0.3 }, size: { width: 3.6, height: 0.36 }, font: { family: SERIF, size: 18, color: INK }, runs: [{ text: label }] },
        { type: "text", position: { x: x + 0.3, y: y + 0.7 }, size: { width: 3.6, height: 0.4 }, font: { family: SANS, size: 11, color: MUTED, lineHeight: 1.4 }, runs: [{ text: body }] },
      ];
    }),
    ...footer(5, TOTAL, false),
  ],
};

// ── Slide 6: Traction ───────────────────────────────────────────────────
function tractionStat(x: number, big: string, label: string): SlideElement[] {
  return [
    { type: "text", position: { x: x, y: 3.85 }, size: { width: 2.8, height: 0.85 }, font: { family: SERIF, size: 44, color: CORAL, lineHeight: 1.0 }, runs: [{ text: big }] },
    { type: "rectangle", position: { x: x, y: 4.7 }, size: { width: 0.32, height: 0.025 }, fill: { color: INK } },
    { type: "text", position: { x: x, y: 4.8 }, size: { width: 2.8, height: 0.28 }, font: { family: SANS, size: 9, color: INK, bold: true, letterSpacing: 280 }, runs: [{ text: label }] },
  ];
}

const slide6Traction: Slide = {
  title: "Traction",
  background: PAPER,
  elements: [
    eyebrow("TRACTION"),
    headline("Eighteen months. Compounding revenue."),
    rule(2.0, 0.6),
    { type: "chart", position: { x: 0.6, y: 2.3 }, size: { width: 8.8, height: 1.45 }, chartType: "line", data: [
        { label: "Q1", value: 42 },
        { label: "Q2", value: 88 },
        { label: "Q3", value: 162 },
        { label: "Q4", value: 240 },
        { label: "Q5", value: 358 },
        { label: "Q6", value: 510 },
      ], title: "ARR ($k) · trailing 6 quarters", color: CORAL, axisColor: WHISPER, labelColor: MUTED, showValues: true },
    ...tractionStat(0.6, "$510k", "ARR"),
    ...tractionStat(3.7, "118%", "NET RETENTION"),
    ...tractionStat(6.8, "1.4×", "QUARTERLY GROWTH"),
    ...footer(6, TOTAL, false),
  ],
};

// ── Slide 7: Business Model ─────────────────────────────────────────────
const slide7Model: Slide = {
  title: "Business Model",
  background: PAPER,
  elements: [
    eyebrow("BUSINESS MODEL"),
    headline("Per-seat pricing with usage-based add-ons."),
    rule(2.0, 0.6),
    { type: "table", position: { x: 0.6, y: 2.3 }, size: { width: 8.8, height: 2.5 }, opacity: 1, font: { family: SANS, size: 11, color: INK }, columns: [{ text: "Tier", fill: { color: CORAL }, font: { color: "FFFFFF", bold: true }, stroke: { color: LINE, width: 1 } }, { text: "Seats", fill: { color: CORAL }, font: { color: "FFFFFF", bold: true }, stroke: { color: LINE, width: 1 } }, { text: "Monthly", fill: { color: CORAL }, font: { color: "FFFFFF", bold: true }, stroke: { color: LINE, width: 1 } }, { text: "Includes", fill: { color: CORAL }, font: { color: "FFFFFF", bold: true }, stroke: { color: LINE, width: 1 } }], rows: [[{ text: "Starter", fill: { color: SURFACE }, stroke: { color: LINE, width: 1 } }, { text: "1 – 5", fill: { color: SURFACE }, stroke: { color: LINE, width: 1 } }, { text: "$24 / seat", fill: { color: SURFACE }, stroke: { color: LINE, width: 1 } }, { text: "Operate + Decide", fill: { color: SURFACE }, stroke: { color: LINE, width: 1 } }], [{ text: "Team", fill: { color: SURFACE }, stroke: { color: LINE, width: 1 } }, { text: "6 – 25", fill: { color: SURFACE }, stroke: { color: LINE, width: 1 } }, { text: "$36 / seat", fill: { color: SURFACE }, stroke: { color: LINE, width: 1 } }, { text: "+ Automate", fill: { color: SURFACE }, stroke: { color: LINE, width: 1 } }], [{ text: "Scale", fill: { color: SURFACE }, stroke: { color: LINE, width: 1 } }, { text: "26 – 100", fill: { color: SURFACE }, stroke: { color: LINE, width: 1 } }, { text: "$48 / seat", fill: { color: SURFACE }, stroke: { color: LINE, width: 1 } }, { text: "+ Report, SSO, audit", fill: { color: SURFACE }, stroke: { color: LINE, width: 1 } }], [{ text: "Enterprise", fill: { color: SURFACE }, stroke: { color: LINE, width: 1 } }, { text: "100+", fill: { color: SURFACE }, stroke: { color: LINE, width: 1 } }, { text: "Talk to us", fill: { color: SURFACE }, stroke: { color: LINE, width: 1 } }, { text: "Dedicated infra, SLAs", fill: { color: SURFACE }, stroke: { color: LINE, width: 1 } }]] },
    { type: "text", position: { x: 0.6, y: 4.95 }, size: { width: 8.8, height: 0.25 }, font: { family: SERIF, size: 11, color: MUTED, italic: true }, runs: [{ text: "Gross margin holds at 82%; payback under 9 months on Team and above." }] },
    ...footer(7, TOTAL, false),
  ],
};

// ── Slide 8: Competition ────────────────────────────────────────────────
const slide8Competition: Slide = {
  title: "Competition",
  background: PAPER,
  elements: [
    eyebrow("COMPETITION"),
    headline("Bundled where the market is unbundled."),
    rule(2.0, 0.6),

    // Quadrant card — pure white surface with hairline border.
    { type: "rectangle", position: { x: 0.6, y: 2.3 }, size: { width: 5.0, height: 2.8 }, fill: { color: SURFACE }, stroke: { color: LINE, width: 0.5 } },
    // Axes
    { type: "rectangle", position: { x: 0.6, y: 3.7 }, size: { width: 5.0, height: 0.01 }, fill: { color: WHISPER } },
    { type: "rectangle", position: { x: 3.1, y: 2.3 }, size: { width: 0.01, height: 2.8 }, fill: { color: WHISPER } },

    // Axis labels — serif italic for an editorial feel.
    { type: "text", position: { x: 0.7, y: 2.4 }, size: { width: 2.2, height: 0.22 }, font: { family: SERIF, size: 10, color: MUTED, italic: true }, runs: [{ text: "AI-native" }] },
    { type: "text", position: { x: 0.7, y: 4.85 }, size: { width: 2.2, height: 0.22 }, font: { family: SERIF, size: 10, color: MUTED, italic: true }, runs: [{ text: "Legacy" }] },
    { type: "text", position: { x: 0.7, y: 5.13 }, size: { width: 5, height: 0.22 }, font: { family: SANS, size: 9, color: MUTED, bold: true, letterSpacing: 180 }, alignment: { horizontal: "center" }, runs: [{ text: "single tool        BREADTH        all-in-one" }] },

    // Quadrant dots
    { type: "ellipse", position: { x: 1.0, y: 4.25 }, size: { width: 0.22, height: 0.22 }, fill: { color: INK } },
    { type: "text", position: { x: 1.3, y: 4.23 }, size: { width: 1.6, height: 0.26 }, font: { family: SERIF, size: 10, color: INK }, runs: [{ text: "Spreadsheet" }] },
    { type: "ellipse", position: { x: 4.1, y: 4.2 }, size: { width: 0.22, height: 0.22 }, fill: { color: INK } },
    { type: "text", position: { x: 4.4, y: 4.18 }, size: { width: 1.3, height: 0.26 }, font: { family: SERIF, size: 10, color: INK }, runs: [{ text: "Legacy ERP" }] },
    { type: "ellipse", position: { x: 1.55, y: 2.85 }, size: { width: 0.22, height: 0.22 }, fill: { color: INK } },
    { type: "text", position: { x: 1.85, y: 2.83 }, size: { width: 1.4, height: 0.26 }, font: { family: SERIF, size: 10, color: INK }, runs: [{ text: "AI point tool" }] },
    // Starship — bigger, coral, the hero dot.
    { type: "ellipse", position: { x: 4.55, y: 2.7 }, size: { width: 0.36, height: 0.36 }, fill: { color: CORAL } },
    { type: "text", position: { x: 4.95, y: 2.75 }, size: { width: 1.4, height: 0.28 }, font: { family: SERIF, size: 12, color: CORAL, italic: true }, runs: [{ text: "Starship" }] },

    // Right column — editorial wedge list with serif markers.
    { type: "text", position: { x: 5.95, y: 2.3 }, size: { width: 3.45, height: 0.3 }, font: { family: SANS, size: 9, color: CORAL, bold: true, letterSpacing: 280 }, runs: [{ text: "OUR WEDGE" }] },
    { type: "rectangle", position: { x: 5.95, y: 2.6 }, size: { width: 0.5, height: 0.025 }, fill: { color: CORAL } },
    ...[
      "Built model-first, not feature-first.",
      "Replaces four incumbents on average.",
      "AI assist priced into the seat, not extra.",
      "Migration in days, not quarters.",
    ].flatMap((text, index): SlideElement[] => {
      const y = 2.85 + index * 0.55;
      return [
        { type: "text", position: { x: 5.95, y: y }, size: { width: 0.3, height: 0.3 }, font: { family: SERIF, size: 14, color: CORAL }, runs: [{ text: "—" }] },
        { type: "text", position: { x: 6.3, y: y }, size: { width: 3.1, height: 0.45 }, font: { family: SERIF, size: 12, color: INK, lineHeight: 1.35 }, runs: [{ text: text }] },
      ];
    }),
    ...footer(8, TOTAL, false),
  ],
};

// ── Slide 9: Team ───────────────────────────────────────────────────────
function teamCard(x: number, name: string, role: string, bio: string): SlideElement[] {
  return [
    { type: "rectangle", position: { x: x, y: 2.3 }, size: { width: 2.85, height: 2.6 }, fill: { color: SURFACE }, stroke: { color: LINE, width: 0.5 } },
    // Coral-ringed initial — editorial portrait stand-in.
    { type: "ellipse", position: { x: x + 0.95, y: 2.55 }, size: { width: 0.95, height: 0.95 }, fill: { color: PAPER } },
    { type: "ellipse", position: { x: x + 1.0, y: 2.6 }, size: { width: 0.85, height: 0.85 }, fill: { color: SURFACE } },
    { type: "text", position: { x: x + 0.95, y: 2.55 }, size: { width: 0.95, height: 0.95 }, font: { family: SERIF, size: 26, color: CORAL }, alignment: { horizontal: "center", vertical: "middle" }, runs: [{ text: name
        .split(" ")
        .map((part) => part[0])
        .join("") }] },

    { type: "text", position: { x: x + 0.2, y: 3.7 }, size: { width: 2.45, height: 0.32 }, font: { family: SERIF, size: 17, color: INK }, alignment: { horizontal: "center" }, runs: [{ text: name }] },
    { type: "rectangle", position: { x: x + 1.25, y: 4.02 }, size: { width: 0.3, height: 0.02 }, fill: { color: CORAL } },
    { type: "text", position: { x: x + 0.2, y: 4.1 }, size: { width: 2.45, height: 0.24 }, font: { family: SANS, size: 9, color: MUTED, bold: true, letterSpacing: 280 }, alignment: { horizontal: "center" }, runs: [{ text: role }] },
    { type: "text", position: { x: x + 0.2, y: 4.4 }, size: { width: 2.45, height: 0.5 }, font: { family: SERIF, size: 10, color: INK, italic: true, lineHeight: 1.4 }, alignment: { horizontal: "center" }, runs: [{ text: bio }] },
  ];
}

const slide9Team: Slide = {
  title: "Team",
  background: PAPER,
  elements: [
    eyebrow("TEAM"),
    headline("Operators who built and shipped this before."),
    rule(2.0, 0.6),
    ...teamCard(
      0.6,
      "Jane Founder",
      "CEO",
      "Previously led ops at Northstar; scaled finance team from 4 to 60.",
    ),
    ...teamCard(
      3.6,
      "Ravi Patel",
      "CTO",
      "Built the data platform at Heron; ten years on distributed systems.",
    ),
    ...teamCard(
      6.6,
      "Mia Chen",
      "HEAD OF GTM",
      "Series-A through D playbook at Vector; took ARR from $2M to $40M.",
    ),
    ...footer(9, TOTAL, false),
  ],
};

// ── Slide 10: Ask ───────────────────────────────────────────────────────
function fundsRow(y: number, percent: string, label: string, body: string): SlideElement[] {
  return [
    { type: "text", position: { x: 5.3, y: y }, size: { width: 1.2, height: 0.5 }, font: { family: SERIF, size: 28, color: AMBER, lineHeight: 1.0 }, runs: [{ text: percent }] },
    { type: "text", position: { x: 6.65, y: y }, size: { width: 2.85, height: 0.3 }, font: { family: SANS, size: 10, color: PAPER, bold: true, letterSpacing: 280 }, runs: [{ text: label }] },
    { type: "text", position: { x: 6.65, y: y + 0.32 }, size: { width: 2.85, height: 0.5 }, font: { family: SERIF, size: 11, color: WHISPER, italic: true, lineHeight: 1.4 }, runs: [{ text: body }] },
  ];
}

const slide10Ask: Slide = {
  title: "Ask",
  background: DEEP,
  elements: [
    // Inverted slide — deep burgundy paper-flip for the closing moment.
    { type: "text", position: { x: 0.6, y: 0.65 }, size: { width: 4, height: 0.28 }, font: { family: SANS, size: 10, color: AMBER, bold: true, letterSpacing: 340 }, runs: [{ text: "THE ASK" }] },

    { type: "text", position: { x: 0.55, y: 1.4 }, size: { width: 4.5, height: 2.0 }, font: { family: SERIF, size: 140, color: PAPER, lineHeight: 1.0 }, runs: [{ text: "$8M" }] },
    { type: "rectangle", position: { x: 0.6, y: 3.4 }, size: { width: 0.6, height: 0.04 }, fill: { color: CORAL } },
    { type: "text", position: { x: 0.6, y: 3.55 }, size: { width: 4.2, height: 0.45 }, font: { family: SERIF, size: 17, color: PAPER, italic: true }, runs: [{ text: "Series A · 24-month runway" }] },
    { type: "text", position: { x: 0.6, y: 4.15 }, size: { width: 4.2, height: 0.95 }, font: { family: SANS, size: 12, color: WHISPER, lineHeight: 1.5 }, runs: [{ text: "Leading the round with a strategic partner. Target close: Q3 2026. " +
        "Welcoming follow-on from existing investors." }] },

    // Right column: use of funds
    { type: "text", position: { x: 5.3, y: 0.65 }, size: { width: 4, height: 0.28 }, font: { family: SANS, size: 10, color: AMBER, bold: true, letterSpacing: 340 }, runs: [{ text: "USE OF FUNDS" }] },
    { type: "rectangle", position: { x: 5.3, y: 1.0 }, size: { width: 4.1, height: 0.015 }, opacity: 0.3, fill: { color: WHISPER } },
    ...fundsRow(1.25, "45%", "PRODUCT & ENGINEERING", "Ship Automate; double the platform team."),
    ...fundsRow(2.25, "30%", "GO TO MARKET", "Build outbound; mid-market sales motion."),
    ...fundsRow(3.25, "15%", "CUSTOMER SUCCESS", "White-glove onboarding for top quartile."),
    ...fundsRow(4.25, "10%", "OPERATIONS", "Finance, legal, and the next two milestones."),
    ...footer(10, TOTAL, true),
  ],
};

export const pitchDeck: Deck = {
  title: "Starship Pitch Deck",
  description: "A ten-slide editorial pitch from cover through ask.",
  theme: {
    background: PAPER,
    surface: SURFACE,
    primary: CORAL,
    secondary: DEEP,
    accent: AMBER,
    text: INK,
    muted: MUTED,
  },
  slides: [
    slide1Cover,
    slide2Problem,
    slide3Solution,
    slide4WhyNow,
    slide5Product,
    slide6Traction,
    slide7Model,
    slide8Competition,
    slide9Team,
    slide10Ask,
  ],
};
