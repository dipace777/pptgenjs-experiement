import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { DeckTheme } from "./deck-theme";
import type { ExtractedDesignElementTemplate } from "./design-element-extraction";
import {
  DeckSchema,
  SLIDE_H,
  type Deck,
  type Slide,
  type SlideElement,
} from "./slide-schema";

export const CompanyUrlTemplateInputSchema = z
  .object({
    url: z.string().min(1).max(2048),
  })
  .strict();

export type CompanyUrlTemplateInput = z.infer<
  typeof CompanyUrlTemplateInputSchema
>;

export type CompanyUrlTemplateProfile = {
  designKeywords: string[];
  fonts: string[];
  logo?: {
    data: string;
    name: string;
    sourceUrl: string;
  };
  name: string;
  description: string;
  hostname: string;
  sourceUrls: string[];
  url: string;
  theme: DeckTheme;
  webSearchUsed: boolean;
};

const FETCH_TIMEOUT_MS = 8_000;
const CSS_FETCH_TIMEOUT_MS = 3_500;
const LOGO_FETCH_TIMEOUT_MS = 5_000;
const MAX_HTML_CHARS = 300_000;
const MAX_CSS_CHARS = 120_000;
const MAX_LOGO_BYTES = 900_000;
const SANS = "Arial";

const WebBrandResearchSchema = z
  .object({
    colors: z.array(z.string().max(32)).max(24).optional(),
    companyName: z.string().min(1).max(80).optional(),
    description: z.string().max(240).optional(),
    designKeywords: z.array(z.string().min(1).max(60)).max(12).optional(),
    fonts: z.array(z.string().min(1).max(80)).max(8).optional(),
    logoUrls: z.array(z.string().min(1).max(2048)).max(16).optional(),
    sourceUrls: z.array(z.string().min(1).max(2048)).max(16).optional(),
    tagline: z.string().max(180).optional(),
  })
  .strict();

type WebBrandResearch = z.infer<typeof WebBrandResearchSchema>;
type BrandResearchResult = WebBrandResearch & {
  imageResultUrls: string[];
};

export const generateCompanyTemplateFromUrl = createServerFn({ method: "POST" })
  .inputValidator((data: CompanyUrlTemplateInput) =>
    CompanyUrlTemplateInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const inputUrl = normalizeCompanyUrl(data.url);

    try {
      const profile = await companyProfileFromUrl(inputUrl);
      return {
        deck: companyTemplateDeck(profile),
        componentTemplates: companyDesignElementTemplates(profile),
        profile,
        source: profile.webSearchUsed ? ("web-search" as const) : ("url" as const),
      };
    } catch (error) {
      const profile = await companyProfileFromWebSearchOnly(inputUrl).catch(() =>
        fallbackCompanyProfile(inputUrl),
      );
      return {
        deck: companyTemplateDeck(profile),
        componentTemplates: companyDesignElementTemplates(profile),
        profile,
        source: profile.webSearchUsed
          ? ("web-search" as const)
          : ("fallback" as const),
        message:
          error instanceof Error
            ? error.message
            : "Could not read the company URL.",
      };
    }
  });

async function companyProfileFromUrl(inputUrl: URL): Promise<CompanyUrlTemplateProfile> {
  const page = await fetchText(inputUrl.href, FETCH_TIMEOUT_MS, MAX_HTML_CHARS);
  const pageUrl = new URL(page.url);
  const html = page.text;
  const title = textFromTitle(html);
  const siteName =
    metaContent(html, ["og:site_name", "application-name", "twitter:site"]) ??
    undefined;
  const description =
    metaContent(html, ["description", "og:description", "twitter:description"]) ??
    `Editable presentation template generated from ${pageUrl.hostname}.`;
  const cssUrls = stylesheetUrls(html, pageUrl).slice(0, 4);
  const cssTexts = await Promise.all(
    cssUrls.map((url) =>
      fetchText(url.href, CSS_FETCH_TIMEOUT_MS, MAX_CSS_CHARS)
        .then((result) => result.text)
        .catch(() => ""),
    ),
  );
  const styleText = [html, ...styleBlocks(html), ...cssTexts].join("\n");
  const colors = extractColors(styleText);
  const themeColor = metaContent(html, ["theme-color", "msapplication-TileColor"]);
  if (themeColor) colors.unshift(cleanHex(themeColor));
  const htmlLogoUrls = logoUrlsFromHtml(html, pageUrl);
  const research = await brandResearchWithWebSearch(inputUrl, {
    colors,
    description,
    logoUrls: htmlLogoUrls.map((url) => url.href),
    name: siteName ?? brandFromTitle(title) ?? hostnameToName(pageUrl.hostname),
  }).catch(() => null);
  const researchLogoUrls = research?.logoUrls ?? [];
  const searchImageUrls = research?.imageResultUrls ?? [];
  const logo = await fetchLogoDataUrl(
    [...researchLogoUrls, ...htmlLogoUrls.map((url) => url.href), ...searchImageUrls],
    pageUrl,
  );
  const researchedColors = research?.colors?.map(cleanHex).filter(Boolean) ?? [];

  return {
    name: cleanBrandName(
      research?.companyName ??
        siteName ??
        brandFromTitle(title) ??
        hostnameToName(pageUrl.hostname),
    ),
    description: cleanDescription(
      research?.tagline ?? research?.description ?? description,
    ),
    designKeywords: cleanStringList(research?.designKeywords, 8),
    fonts: cleanStringList(research?.fonts, 5),
    hostname: pageUrl.hostname.replace(/^www\./i, ""),
    logo,
    sourceUrls: cleanStringList(
      [pageUrl.href, ...(research?.sourceUrls ?? [])],
      10,
    ),
    url: pageUrl.href,
    theme: themeFromColors([...researchedColors, ...colors], pageUrl.hostname),
    webSearchUsed: !!research,
  };
}

function fallbackCompanyProfile(inputUrl: URL): CompanyUrlTemplateProfile {
  const hostname = inputUrl.hostname.replace(/^www\./i, "");
  return {
    designKeywords: [],
    fonts: [],
    name: hostnameToName(inputUrl.hostname),
    description: `Editable brand presentation template generated from ${hostname}.`,
    hostname,
    sourceUrls: [inputUrl.href],
    url: inputUrl.href,
    theme: themeFromColors([], inputUrl.hostname),
    webSearchUsed: false,
  };
}

async function companyProfileFromWebSearchOnly(
  inputUrl: URL,
): Promise<CompanyUrlTemplateProfile> {
  const base = fallbackCompanyProfile(inputUrl);
  const research = await brandResearchWithWebSearch(inputUrl, {
    colors: [],
    description: base.description,
    logoUrls: [],
    name: base.name,
  });
  if (!research) return base;
  const colors = research.colors?.map(cleanHex).filter(Boolean) ?? [];
  const logo = await fetchLogoDataUrl(
    [...(research.logoUrls ?? []), ...(research.imageResultUrls ?? [])],
    inputUrl,
  );
  return {
    ...base,
    designKeywords: cleanStringList(research.designKeywords, 8),
    fonts: cleanStringList(research.fonts, 5),
    logo,
    name: cleanBrandName(research.companyName ?? base.name),
    description: cleanDescription(
      research.tagline ?? research.description ?? base.description,
    ),
    sourceUrls: cleanStringList(
      [inputUrl.href, ...(research.sourceUrls ?? [])],
      10,
    ),
    theme: themeFromColors(colors, inputUrl.hostname),
    webSearchUsed: true,
  };
}

function normalizeCompanyUrl(raw: string): URL {
  const trimmed = raw.trim();
  const withProtocol = /^[a-z][a-z\d+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const url = new URL(withProtocol);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Enter an http or https company URL.");
  }
  if (isBlockedHostname(url.hostname)) {
    throw new Error("Enter a public company URL.");
  }
  url.hash = "";
  return url;
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "0.0.0.0" ||
    host === "::1"
  ) {
    return true;
  }
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;
  const octets = ipv4.slice(1).map((part) => Number.parseInt(part, 10));
  const [a, b] = octets;
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  );
}

async function fetchText(
  url: string,
  timeoutMs: number,
  maxChars: number,
): Promise<{ text: string; url: string }> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        accept: "text/html, text/css;q=0.9, */*;q=0.1",
        "user-agent": "PPTY template generator",
      },
      signal: abortController.signal,
    });
    if (!response.ok) {
      throw new Error(`Company URL returned HTTP ${response.status}.`);
    }
    const text = (await response.text()).slice(0, maxChars);
    return { text, url: response.url || url };
  } finally {
    clearTimeout(timeout);
  }
}

function metaContent(html: string, names: string[]): string | null {
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributesFromTag(tag[0]);
    const key = (attrs.property ?? attrs.name ?? attrs.itemprop ?? "").toLowerCase();
    if (wanted.has(key) && attrs.content) {
      return cleanInlineText(attrs.content);
    }
  }
  return null;
}

function textFromTitle(html: string): string | null {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return match ? cleanInlineText(match[1]) : null;
}

function brandFromTitle(title: string | null): string | null {
  if (!title) return null;
  const parts = title
    .split(/\s(?:[-\u2013\u2014|:])\s/g)
    .map((part) => part.trim())
    .filter(Boolean);
  const candidates = parts.length > 1 ? [parts.at(-1), parts[0]] : [title];
  return (
    candidates.find(
      (candidate): candidate is string =>
        !!candidate &&
        candidate.length >= 2 &&
        candidate.length <= 48 &&
        !/^(home|homepage|official website|welcome)$/i.test(candidate),
    ) ?? null
  );
}

function attributesFromTag(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of tag.matchAll(
    /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g,
  )) {
    attrs[match[1].toLowerCase()] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attrs;
}

function stylesheetUrls(html: string, baseUrl: URL): URL[] {
  const urls: URL[] = [];
  for (const tag of html.matchAll(/<link\b[^>]*>/gi)) {
    const attrs = attributesFromTag(tag[0]);
    const rel = attrs.rel?.toLowerCase() ?? "";
    if (!rel.includes("stylesheet") || !attrs.href) continue;
    try {
      const url = new URL(attrs.href, baseUrl.href);
      if (
        (url.protocol === "https:" || url.protocol === "http:") &&
        !isBlockedHostname(url.hostname)
      ) {
        urls.push(url);
      }
    } catch {
      // Ignore malformed stylesheet URLs.
    }
  }
  return urls;
}

async function brandResearchWithWebSearch(
  inputUrl: URL,
  hints: {
    colors: string[];
    description: string;
    logoUrls: string[];
    name: string;
  },
): Promise<BrandResearchResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const domain = inputUrl.hostname.replace(/^www\./i, "");
  const body = {
    model:
      process.env.COMPANY_TEMPLATE_MODEL ??
      process.env.OPENAI_MODEL ??
      "gpt-4.1-mini",
    tools: [
      {
        type: "web_search",
        filters: { allowed_domains: [domain] },
        search_content_types: ["image", "text"],
        image_settings: { max_results: 6, caption: true },
      },
    ],
    include: ["web_search_call.results", "web_search_call.action.sources"],
    tool_choice: "auto",
    input: [
      `Research the visual brand identity for ${hints.name} at ${inputUrl.href}.`,
      "Use web search. Prefer official website pages, brand/media/press assets, and public logo assets from that domain.",
      "Focus only on company name, logo URLs, colors, typefaces, and design style keywords for a presentation template.",
      "Do not write marketing content, strategy content, slide copy, or invented facts.",
      "Return only a compact JSON object with these optional keys:",
      "companyName, tagline, description, logoUrls, colors, fonts, designKeywords, sourceUrls.",
      "Colors must be 6-digit hex values when possible. Logo URLs must be absolute image URLs.",
      "Known page hints:",
      JSON.stringify({
        colors: hints.colors.slice(0, 12),
        description: hints.description,
        logoUrls: hints.logoUrls.slice(0, 8),
      }),
    ].join("\n"),
  };

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 12_000);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: abortController.signal,
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const parsed = parseBrandResearch(responseOutputText(payload));
    if (!parsed) return null;
    return {
      ...parsed,
      imageResultUrls: responseImageUrls(payload),
      sourceUrls: [
        ...(parsed.sourceUrls ?? []),
        ...responseSourceUrls(payload),
      ].slice(0, 16),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function parseBrandResearch(textValue: string): WebBrandResearch | null {
  const jsonText = extractJsonObject(textValue);
  if (!jsonText) return null;
  try {
    const parsed = JSON.parse(jsonText);
    const result = WebBrandResearchSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function extractJsonObject(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  return start >= 0 && end > start ? value.slice(start, end + 1) : null;
}

function responseOutputText(payload: unknown): string {
  const data = payload as {
    output?: Array<{
      content?: Array<{ text?: string; type?: string }>;
      type?: string;
    }>;
    output_text?: string;
  };
  if (typeof data.output_text === "string") return data.output_text;
  const parts: string[] = [];
  for (const item of data.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === "string") parts.push(content.text);
    }
  }
  return parts.join("\n");
}

function responseImageUrls(payload: unknown): string[] {
  const urls: string[] = [];
  for (const result of webSearchResults(payload)) {
    if (typeof result.image_url === "string") urls.push(result.image_url);
    if (typeof result.thumbnail_url === "string") urls.push(result.thumbnail_url);
  }
  return dedupeStrings(urls);
}

function responseSourceUrls(payload: unknown): string[] {
  const urls: string[] = [];
  for (const result of webSearchResults(payload)) {
    if (typeof result.source_website_url === "string") {
      urls.push(result.source_website_url);
    }
    if (typeof result.url === "string") urls.push(result.url);
  }
  return dedupeStrings(urls);
}

function webSearchResults(payload: unknown): Array<Record<string, unknown>> {
  const data = payload as {
    output?: Array<{ results?: Array<Record<string, unknown>>; type?: string }>;
  };
  return (data.output ?? []).flatMap((item) => item.results ?? []);
}

function logoUrlsFromHtml(html: string, baseUrl: URL): URL[] {
  const urls: URL[] = [];
  for (const tag of html.matchAll(/<link\b[^>]*>/gi)) {
    const attrs = attributesFromTag(tag[0]);
    const rel = attrs.rel?.toLowerCase() ?? "";
    if (
      !attrs.href ||
      (!rel.includes("icon") && !rel.includes("mask-icon"))
    ) {
      continue;
    }
    const url = safePublicUrl(attrs.href, baseUrl);
    if (url) urls.push(url);
  }
  for (const name of ["og:image", "twitter:image", "twitter:image:src"]) {
    const value = metaContent(html, [name]);
    const url = value ? safePublicUrl(value, baseUrl) : null;
    if (url) urls.push(url);
  }
  for (const tag of html.matchAll(/<img\b[^>]*>/gi)) {
    const attrs = attributesFromTag(tag[0]);
    const hint = `${attrs.alt ?? ""} ${attrs.class ?? ""} ${attrs.id ?? ""} ${attrs.src ?? ""}`;
    if (!/logo|brand|mark/i.test(hint)) continue;
    const raw = firstSrcsetUrl(attrs.srcset) ?? attrs.src;
    const url = raw ? safePublicUrl(raw, baseUrl) : null;
    if (url) urls.push(url);
  }
  return dedupeUrls(urls).slice(0, 14);
}

function firstSrcsetUrl(value: string | undefined): string | null {
  if (!value) return null;
  return value.split(",")[0]?.trim().split(/\s+/)[0] ?? null;
}

function safePublicUrl(raw: string, baseUrl: URL): URL | null {
  try {
    const url = new URL(raw, baseUrl.href);
    if (
      (url.protocol === "https:" || url.protocol === "http:") &&
      !isBlockedHostname(url.hostname)
    ) {
      return url;
    }
  } catch {
    return null;
  }
  return null;
}

async function fetchLogoDataUrl(
  urls: Array<string | URL>,
  baseUrl: URL,
): Promise<CompanyUrlTemplateProfile["logo"] | undefined> {
  for (const rawUrl of dedupeStrings(urls.map(String))) {
    const url = safePublicUrl(rawUrl, baseUrl);
    if (!url) continue;
    const logo = await fetchSingleLogoDataUrl(url).catch(() => undefined);
    if (logo) return logo;
  }
  return undefined;
}

async function fetchSingleLogoDataUrl(
  url: URL,
): Promise<CompanyUrlTemplateProfile["logo"] | undefined> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), LOGO_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url.href, {
      headers: { accept: "image/avif,image/webp,image/svg+xml,image/png,image/jpeg,*/*" },
      signal: abortController.signal,
    });
    if (!response.ok) return undefined;
    const contentLength = Number.parseInt(
      response.headers.get("content-length") ?? "0",
      10,
    );
    if (contentLength > MAX_LOGO_BYTES) return undefined;
    const contentType =
      response.headers.get("content-type")?.split(";")[0]?.toLowerCase() ??
      mimeFromPath(url.pathname);
    if (!contentType.startsWith("image/")) return undefined;
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_LOGO_BYTES) return undefined;
    return {
      data: `data:${contentType};base64,${arrayBufferToBase64(buffer)}`,
      name: url.pathname.split("/").filter(Boolean).at(-1) ?? "logo",
      sourceUrl: url.href,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function mimeFromPath(pathname: string): string {
  const lower = pathname.toLowerCase();
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".png")) return "image/png";
  return "image/png";
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  if (typeof btoa === "function") return btoa(binary);
  return Buffer.from(bytes).toString("base64");
}

function styleBlocks(html: string): string[] {
  return [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(
    (match) => match[1],
  );
}

function cleanInlineText(value: string): string {
  return decodeHtml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity: string) => {
    const normalized = entity.toLowerCase();
    if (normalized.startsWith("#x")) {
      return String.fromCodePoint(Number.parseInt(normalized.slice(2), 16));
    }
    if (normalized.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(normalized.slice(1), 10));
    }
    return (
      {
        amp: "&",
        apos: "'",
        gt: ">",
        lt: "<",
        nbsp: " ",
        quot: '"',
      }[normalized] ?? `&${entity};`
    );
  });
}

function cleanBrandName(value: string): string {
  const cleaned = cleanInlineText(value)
    .replace(/^@/, "")
    .replace(/\s+/g, " ")
    .trim();
  return truncate(cleaned || "Company", 42);
}

function cleanDescription(value: string): string {
  return truncate(cleanInlineText(value), 170);
}

function cleanStringList(
  values: ReadonlyArray<string> | null | undefined,
  limit: number,
): string[] {
  return dedupeStrings(
    (values ?? [])
      .map((value) => cleanInlineText(value))
      .filter((value) => value.length > 0),
  ).slice(0, limit);
}

function dedupeStrings(values: ReadonlyArray<string>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = value.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(key);
  }
  return result;
}

function dedupeUrls(urls: ReadonlyArray<URL>): URL[] {
  const seen = new Set<string>();
  const result: URL[] = [];
  for (const url of urls) {
    if (seen.has(url.href)) continue;
    seen.add(url.href);
    result.push(url);
  }
  return result;
}

function hostnameToName(hostname: string): string {
  const root = hostname
    .replace(/^www\./i, "")
    .split(".")
    .filter(Boolean)[0]
    ?.replace(/[-_]+/g, " ");
  if (!root) return "Company";
  return root
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function extractColors(text: string): string[] {
  const counts = new Map<string, number>();
  const add = (hex: string, weight = 1) => {
    const clean = cleanHex(hex);
    if (!clean) return;
    counts.set(clean, (counts.get(clean) ?? 0) + weight);
  };

  for (const match of text.matchAll(/#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b/gi)) {
    add(match[1]);
  }
  for (const match of text.matchAll(
    /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/gi,
  )) {
    add(
      rgbToHex({
        r: Number.parseInt(match[1], 10),
        g: Number.parseInt(match[2], 10),
        b: Number.parseInt(match[3], 10),
      }),
    );
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([hex]) => hex);
}

function cleanHex(value: string | null | undefined): string {
  if (!value) return "";
  const stripped = value.trim().replace(/^#/, "").toUpperCase();
  if (/^[0-9A-F]{3}$/.test(stripped)) {
    return stripped
      .split("")
      .map((char) => `${char}${char}`)
      .join("");
  }
  if (/^[0-9A-F]{4}$/.test(stripped)) {
    return stripped
      .slice(0, 3)
      .split("")
      .map((char) => `${char}${char}`)
      .join("");
  }
  if (/^[0-9A-F]{6}$/.test(stripped)) return stripped;
  if (/^[0-9A-F]{8}$/.test(stripped)) return stripped.slice(0, 6);
  return "";
}

function themeFromColors(colors: string[], seed: string): DeckTheme {
  const vivid = colors
    .map(cleanHex)
    .filter(Boolean)
    .filter((hex) => {
      const hsl = rgbToHsl(hexToRgb(hex));
      const lum = luminance(hex);
      return hsl.s > 0.18 && lum > 0.04 && lum < 0.92;
    });
  const fallback = seededPalette(seed);
  const rawPrimary =
    vivid.find((hex) => luminance(hex) < 0.55) ?? vivid[0] ?? fallback.primary;
  const primary = normalizePrimary(rawPrimary);
  const secondary =
    vivid.find((hex) => colorDistance(hex, primary) > 92 && luminance(hex) < 0.72) ??
    fallback.secondary;
  const accent =
    vivid.find(
      (hex) =>
        colorDistance(hex, primary) > 112 && colorDistance(hex, secondary) > 76,
    ) ?? fallback.accent;

  return {
    background: "F7F9FC",
    surface: "FFFFFF",
    primary,
    secondary: normalizeSecondary(secondary, primary),
    accent: normalizeAccent(accent, primary),
    text: "111827",
    muted: "64748B",
  };
}

function seededPalette(seed: string) {
  const hue = hashString(seed) % 360;
  return {
    primary: hslToHex({ h: hue, s: 0.54, l: 0.28 }),
    secondary: hslToHex({ h: (hue + 28) % 360, s: 0.5, l: 0.44 }),
    accent: hslToHex({ h: (hue + 162) % 360, s: 0.68, l: 0.52 }),
  };
}

function normalizePrimary(hex: string): string {
  const hsl = rgbToHsl(hexToRgb(hex));
  return hslToHex({ ...hsl, l: clamp(hsl.l, 0.19, 0.38), s: Math.max(hsl.s, 0.34) });
}

function normalizeSecondary(hex: string, primary: string): string {
  const hsl = rgbToHsl(hexToRgb(hex));
  const adjusted = hslToHex({
    ...hsl,
    l: clamp(hsl.l, 0.34, 0.56),
    s: Math.max(hsl.s, 0.26),
  });
  if (colorDistance(adjusted, primary) > 48) return adjusted;
  return hslToHex({ h: (hsl.h + 34) % 360, s: Math.max(hsl.s, 0.36), l: 0.46 });
}

function normalizeAccent(hex: string, primary: string): string {
  const hsl = rgbToHsl(hexToRgb(hex));
  const adjusted = hslToHex({
    ...hsl,
    l: clamp(hsl.l, 0.42, 0.66),
    s: Math.max(hsl.s, 0.42),
  });
  if (colorDistance(adjusted, primary) > 58) return adjusted;
  return hslToHex({ h: (hsl.h + 150) % 360, s: 0.68, l: 0.52 });
}

function companyTemplateDeck(profile: CompanyUrlTemplateProfile): Deck {
  const theme = profile.theme;
  const slides: Slide[] = [
    coverSlide(profile),
    brandSystemSlide(profile),
    sectionDividerSlide(profile),
    messageSlide(profile),
    metricsSlide(profile),
    closingSlide(profile),
  ];

  return DeckSchema.parse({
    title: `${profile.name} Slide Template`,
    description: `Slide template generated from ${profile.url}`,
    theme,
    slides,
  });
}

function companyDesignElementTemplates(
  profile: CompanyUrlTemplateProfile,
): ExtractedDesignElementTemplate[] {
  const { theme } = profile;
  return [
    componentTemplate(
      "brand-lockup",
      "Brand Lockup",
      "Logo mark with editable company name.",
      "title-lockup",
      brandLockup(0.35, 0.35, profile, theme.text),
      [
        {
          elementIndexes: [profile.logo ? 2 : 2],
          kind: "title",
          name: "Company Name",
          role: "Editable brand name",
          text: profile.name,
        },
      ],
    ),
    componentTemplate(
      "title-lockup",
      "Title Lockup",
      "Headline, subtitle, and accent rule.",
      "title-lockup",
      [
        rect(0.35, 0.35, 0.72, 0.06, theme.accent, 1, undefined, 0.03),
        text(0.35, 0.62, 3.8, 0.46, "Headline Placeholder", {
          color: theme.text,
          size: 24,
          bold: true,
        }),
        text(0.37, 1.18, 3.25, 0.35, "Subtitle placeholder", {
          color: theme.muted,
          size: 11,
        }),
      ],
      [
        {
          elementIndexes: [1],
          kind: "title",
          name: "Headline",
          role: "Primary slide headline",
          text: "Headline Placeholder",
        },
        {
          elementIndexes: [2],
          kind: "body",
          name: "Subtitle",
          role: "Short supporting line",
          text: "Subtitle placeholder",
        },
      ],
    ),
    componentTemplate(
      "content-card",
      "Content Card",
      "Reusable framed card with label, title, and body slots.",
      "content-card",
      [
        rect(0.35, 0.35, 2.8, 1.55, theme.surface, 1, { color: "DFE7F1", width: 0.8 }, 0.14),
        rect(0.35, 0.35, 2.8, 0.11, theme.accent, 1, undefined, 0.08),
        text(0.58, 0.68, 1.1, 0.18, "LABEL", {
          color: theme.accent,
          size: 7,
          bold: true,
          letterSpacing: 100,
        }),
        text(0.58, 0.96, 1.95, 0.26, "Card Title", {
          color: theme.text,
          size: 13,
          bold: true,
        }),
        text(0.58, 1.28, 2.0, 0.28, "Placeholder copy", {
          color: theme.muted,
          size: 8,
        }),
      ],
      [
        {
          elementIndexes: [2],
          kind: "label",
          name: "Label",
          role: "Small card label",
          text: "LABEL",
        },
        {
          elementIndexes: [3],
          kind: "title",
          name: "Title",
          role: "Card title",
          text: "Card Title",
        },
        {
          elementIndexes: [4],
          kind: "body",
          name: "Body",
          role: "Card body",
          text: "Placeholder copy",
        },
      ],
    ),
    componentTemplate(
      "metric-card",
      "Metric Card",
      "Compact metric block with label.",
      "metric-card",
      [
        rect(0.35, 0.35, 2.2, 1.08, theme.surface, 1, { color: "DFE7F1", width: 0.8 }, 0.13),
        text(0.58, 0.64, 1.15, 0.34, "00%", {
          color: theme.primary,
          size: 25,
          bold: true,
        }),
        text(0.6, 1.12, 1.35, 0.2, "Metric label", {
          color: theme.muted,
          size: 8,
          bold: true,
        }),
      ],
      [
        {
          elementIndexes: [1],
          kind: "metric",
          name: "Metric",
          role: "Metric value",
          text: "00%",
        },
        {
          elementIndexes: [2],
          kind: "label",
          name: "Label",
          role: "Metric label",
          text: "Metric label",
        },
      ],
    ),
    componentTemplate(
      "cta-button",
      "CTA Button",
      "Rounded accent button for closing slides.",
      "cta-button",
      [
        rect(0.35, 0.35, 1.82, 0.48, theme.accent, 1, undefined, 0.22),
        text(0.68, 0.49, 1.18, 0.18, "CTA LABEL", {
          color: contrastText(theme.accent),
          size: 8,
          bold: true,
          letterSpacing: 120,
        }),
      ],
      [
        {
          elementIndexes: [1],
          kind: "label",
          name: "Label",
          role: "Button label",
          text: "CTA LABEL",
        },
      ],
    ),
    componentTemplate(
      "image-slot",
      "Image Slot",
      "Editable media placeholder with brand accent.",
      "image-asset",
      [
        rect(0.35, 0.35, 2.7, 1.55, theme.surface, 1, { color: "DFE7F1", width: 0.8 }, 0.14),
        {
          type: "image",
          position: { x: 0.52, y: 0.52 },
          size: { width: 2.36, height: 1.18 },
          fit: "cover",
          borderRadius: { tl: 0.1, tr: 0.1, bl: 0.1, br: 0.1 },
        },
        rect(0.52, 1.72, 0.62, 0.07, theme.accent, 1, undefined, 0.03),
      ],
      [
        {
          elementIndexes: [1],
          kind: "image",
          name: "Image",
          role: "Replaceable image slot",
        },
      ],
    ),
    componentTemplate(
      "navigation-pill",
      "Navigation Pill",
      "Small section label for headers or footers.",
      "navigation-pill",
      [
        rect(0.35, 0.35, 1.6, 0.38, theme.primary, 1, undefined, 0.19),
        text(0.66, 0.47, 0.95, 0.13, "SECTION", {
          color: "FFFFFF",
          size: 7,
          bold: true,
          letterSpacing: 110,
        }),
      ],
      [
        {
          elementIndexes: [1],
          kind: "label",
          name: "Label",
          role: "Navigation label",
          text: "SECTION",
        },
      ],
    ),
    componentTemplate(
      "divider-accent",
      "Accent Divider",
      "Brand color divider rule.",
      "divider",
      [rect(0.35, 0.35, 1.25, 0.08, theme.accent, 1, undefined, 0.04)],
    ),
  ];
}

function componentTemplate(
  id: string,
  label: string,
  description: string,
  intent: ExtractedDesignElementTemplate["intent"],
  elements: SlideElement[],
  slots?: ExtractedDesignElementTemplate["slots"],
): ExtractedDesignElementTemplate {
  return {
    id,
    label,
    description,
    elements: tagTemplateElements(elements, id, description),
    intent,
    qualityScore: 92,
    slots,
  };
}

function tagTemplateElements(
  elements: SlideElement[],
  componentId: string,
  description: string,
): SlideElement[] {
  return elements.map((element) => ({
    ...element,
    componentId,
    componentDescription: description,
  }));
}

function coverSlide(profile: CompanyUrlTemplateProfile): Slide {
  const { theme } = profile;
  return {
    title: "Cover",
    background: theme.primary,
    backgroundRole: "primary",
    elements: [
      rect(6.9, 0.45, 2.9, 2.9, theme.secondary, 0.24, undefined, 0.45),
      rect(7.62, 3.72, 1.9, 0.16, theme.accent, 0.9, undefined, 0.08),
      rect(0.72, 0.7, 0.8, 0.07, theme.accent, 1, undefined, 0.04),
      ...brandLockup(0.72, 0.38, profile, "FFFFFF"),
      text(0.72, 1.58, 7.65, 1.32, `${profile.name} Brand Template`, {
        color: "FFFFFF",
        size: 42,
        bold: true,
        lineHeight: 0.98,
      }),
      text(0.76, 3.1, 5.95, 0.78, "Presentation subtitle / one-line purpose", {
        color: "DDE7F3",
        size: 15,
        lineHeight: 1.18,
      }),
      footerText(0.76, 5.1, profile.hostname, "B9C7D8"),
    ],
  };
}

function brandSystemSlide(profile: CompanyUrlTemplateProfile): Slide {
  const { theme } = profile;
  const swatches = [
    ["Primary", theme.primary],
    ["Secondary", theme.secondary],
    ["Accent", theme.accent],
    ["Background", theme.background],
    ["Surface", theme.surface],
    ["Text", theme.text],
  ];
  const keywords =
    profile.designKeywords.length > 0
      ? profile.designKeywords.join(" / ")
      : "Design keywords";
  const fonts =
    profile.fonts.length > 0 ? profile.fonts.join(" / ") : "Typeface notes";
  return {
    title: "Brand System",
    background: theme.background,
    backgroundRole: "background",
    elements: [
      ...pageHeader(profile, "Brand System"),
      rect(0.72, 1.38, 3.6, 1.22, theme.surface, 1, { color: "DFE7F1", width: 0.8 }, 0.14),
      ...brandLockup(1.02, 1.82, profile, theme.text),
      text(0.98, 2.9, 3.0, 0.34, fonts, {
        color: theme.muted,
        size: 9,
      }),
      text(0.98, 3.33, 3.0, 0.46, keywords, {
        color: theme.muted,
        size: 9,
        lineHeight: 1.15,
      }),
      ...swatches.flatMap(([label, color], index) => {
        const col = index % 3;
        const row = Math.floor(index / 3);
        const x = 4.78 + col * 1.45;
        const y = 1.42 + row * 1.18;
        return [
          rect(x, y, 1.08, 0.62, color, 1, { color: "DFE7F1", width: 0.6 }, 0.1),
          text(x, y + 0.74, 1.18, 0.18, label, {
            color: theme.text,
            size: 7.5,
            bold: true,
          }),
          text(x, y + 0.94, 1.18, 0.16, `#${color}`, {
            color: theme.muted,
            size: 6.5,
          }),
        ];
      }),
      footerText(0.72, 5.14, profile.hostname, theme.muted),
    ],
  };
}

function sectionDividerSlide(profile: CompanyUrlTemplateProfile): Slide {
  const { theme } = profile;
  return {
    title: "Section Divider",
    background: theme.primary,
    backgroundRole: "primary",
    elements: [
      rect(0, 0, 10, 5.625, theme.primary),
      rect(7.1, 0, 2.9, 5.625, theme.secondary, 0.25),
      ...brandLockup(0.72, 0.43, profile, "FFFFFF"),
      text(0.72, 1.55, 1.5, 0.72, "01", {
        color: theme.accent,
        size: 46,
        bold: true,
      }),
      rect(0.76, 2.42, 0.74, 0.07, theme.accent, 1, undefined, 0.03),
      text(0.72, 2.72, 6.2, 0.72, "Section Title", {
        color: "FFFFFF",
        size: 33,
        bold: true,
      }),
      text(0.76, 3.56, 4.75, 0.44, "Short section descriptor", {
        color: "DDE7F3",
        size: 13,
      }),
    ],
  };
}

function messageSlide(profile: CompanyUrlTemplateProfile): Slide {
  const { theme } = profile;
  const cardTitles = ["Audience", "Proof", "Action"];
  return {
    title: "Message Architecture",
    background: theme.background,
    backgroundRole: "background",
    elements: [
      ...pageHeader(profile, "Message Architecture"),
      rect(0.72, 1.36, 3.95, 3.22, theme.surface, 1, { color: "DFE7F1", width: 0.8 }, 0.14),
      rect(0.72, 1.36, 3.95, 0.12, theme.accent, 1, undefined, 0.08),
      text(1.0, 1.75, 3.22, 0.5, "Primary Message", {
        color: theme.text,
        size: 20,
        bold: true,
      }),
      text(1.02, 2.42, 2.95, 0.98, "Supporting copy placeholder", {
        color: theme.muted,
        size: 13,
        lineHeight: 1.18,
      }),
      ...cardTitles.flatMap((title, index) => {
        const y = 1.36 + index * 1.08;
        return [
          rect(5.18, y, 3.95, 0.82, theme.surface, 1, { color: "DFE7F1", width: 0.8 }, 0.12),
          rect(5.43, y + 0.24, 0.28, 0.28, index === 1 ? theme.secondary : theme.accent, 1, undefined, 0.14),
          text(5.95, y + 0.18, 2.1, 0.26, title, {
            color: theme.text,
            size: 13,
            bold: true,
          }),
          text(5.95, y + 0.48, 2.62, 0.22, "Placeholder copy", {
            color: theme.muted,
            size: 8,
          }),
        ];
      }),
      footerText(0.72, 5.14, profile.hostname, theme.muted),
    ],
  };
}

function metricsSlide(profile: CompanyUrlTemplateProfile): Slide {
  const { theme } = profile;
  const metrics = [
    ["00", "Metric label"],
    ["00%", "Metric label"],
    ["00x", "Metric label"],
  ];
  return {
    title: "Metric Snapshot",
    background: theme.background,
    backgroundRole: "background",
    elements: [
      ...pageHeader(profile, "Metric Snapshot"),
      ...metrics.flatMap(([value, label], index) => {
        const x = 0.72 + index * 3.04;
        return [
          rect(x, 1.42, 2.62, 1.38, theme.surface, 1, { color: "DFE7F1", width: 0.8 }, 0.14),
          text(x + 0.26, 1.76, 1.55, 0.42, value, {
            color: index === 1 ? theme.secondary : theme.primary,
            size: 28,
            bold: true,
          }),
          text(x + 0.28, 2.31, 1.9, 0.24, label, {
            color: theme.muted,
            size: 9,
            bold: true,
          }),
        ];
      }),
      rect(0.74, 3.38, 8.45, 0.08, "DCE5EF"),
      rect(0.74, 3.38, 2.8, 0.08, theme.accent),
      rect(3.54, 3.38, 2.8, 0.08, theme.secondary),
      rect(6.34, 3.38, 2.85, 0.08, theme.primary),
      text(0.74, 3.74, 2.2, 0.28, "Phase 1", { color: theme.text, size: 12, bold: true }),
      text(3.54, 3.74, 2.2, 0.28, "Phase 2", { color: theme.text, size: 12, bold: true }),
      text(6.34, 3.74, 2.2, 0.28, "Phase 3", { color: theme.text, size: 12, bold: true }),
      text(0.74, 4.14, 7.5, 0.42, "Timeline note placeholder", {
        color: theme.muted,
        size: 11,
      }),
      footerText(0.72, 5.14, profile.hostname, theme.muted),
    ],
  };
}

function closingSlide(profile: CompanyUrlTemplateProfile): Slide {
  const { theme } = profile;
  const ctaText = contrastText(theme.accent);
  return {
    title: "Closing",
    background: theme.surface,
    backgroundRole: "surface",
    elements: [
      rect(0, 0, 3.75, SLIDE_H, theme.primary),
      rect(0.72, 0.7, 0.68, 0.07, theme.accent, 1, undefined, 0.04),
      ...brandLockup(0.72, 0.42, profile, "FFFFFF"),
      text(0.72, 1.62, 2.3, 0.78, "Closing Headline", {
        color: "FFFFFF",
        size: 26,
        bold: true,
        lineHeight: 1.05,
      }),
      text(0.76, 2.82, 2.2, 0.52, "Closing note placeholder", {
        color: "DDE7F3",
        size: 11.5,
        lineHeight: 1.18,
      }),
      text(4.55, 1.08, 3.8, 0.48, "Call to Action", {
        color: theme.text,
        size: 26,
        bold: true,
      }),
      text(4.58, 1.86, 3.75, 0.78, "Short closing copy placeholder", {
        color: theme.muted,
        size: 14,
        lineHeight: 1.2,
      }),
      rect(4.58, 3.1, 2.0, 0.48, theme.accent, 1, undefined, 0.22),
      text(4.86, 3.24, 1.45, 0.18, "CTA LABEL", {
        color: ctaText,
        size: 8,
        bold: true,
        letterSpacing: 120,
      }),
      footerText(4.58, 5.14, profile.hostname, theme.muted),
    ],
  };
}

function pageHeader(profile: CompanyUrlTemplateProfile, title: string): SlideElement[] {
  const { theme } = profile;
  return [
    ...brandLockup(0.72, 0.42, profile, theme.text),
    text(0.72, 0.86, 5.2, 0.4, title, {
      color: theme.text,
      size: 25,
      bold: true,
    }),
    rect(0.74, 1.22, 0.72, 0.06, theme.accent, 1, undefined, 0.03),
  ];
}

function brandLockup(
  x: number,
  y: number,
  profile: CompanyUrlTemplateProfile,
  color: string,
): SlideElement[] {
  const { theme } = profile;
  const initials = profile.name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const mark = profile.logo
    ? [
        rect(x, y, 0.38, 0.38, "FFFFFF", 0.96, undefined, 0.1),
        image(x + 0.045, y + 0.045, 0.29, 0.29, profile.logo.data, profile.logo.name),
      ]
    : [
        ellipse(x, y, 0.34, 0.34, theme.accent),
        text(x + 0.065, y + 0.085, 0.2, 0.13, initials || "C", {
          color: contrastText(theme.accent),
          size: 7,
          bold: true,
          alignment: "center",
        }),
      ];
  return [
    ...mark,
    text(x + 0.5, y + 0.075, 2.8, 0.19, profile.name, {
      color,
      size: 9,
      bold: true,
      letterSpacing: 80,
    }),
  ];
}

function footerText(x: number, y: number, value: string, color: string): SlideElement {
  return text(x, y, 3.6, 0.2, value.toUpperCase(), {
    color,
    size: 7,
    bold: true,
    letterSpacing: 120,
  });
}

function text(
  x: number,
  y: number,
  width: number,
  height: number,
  value: string,
  options: {
    alignment?: "left" | "center" | "right";
    bold?: boolean;
    color: string;
    letterSpacing?: number;
    lineHeight?: number;
    size: number;
  },
): SlideElement {
  return {
    type: "text",
    position: { x, y },
    size: { width, height },
    font: {
      family: SANS,
      size: options.size,
      color: options.color,
      bold: options.bold,
      lineHeight: options.lineHeight,
      letterSpacing: options.letterSpacing,
    },
    alignment: options.alignment ? { horizontal: options.alignment } : undefined,
    runs: [{ text: truncate(value, 690) || " " }],
  };
}

function rect(
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  opacity = 1,
  stroke?: { color: string; width: number },
  radius = 0,
): SlideElement {
  return {
    type: "rectangle",
    position: { x, y },
    size: { width, height },
    fill: { color, opacity },
    stroke,
    borderRadius: radius
      ? { tl: radius, tr: radius, bl: radius, br: radius }
      : undefined,
  };
}

function ellipse(
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
): SlideElement {
  return {
    type: "ellipse",
    position: { x, y },
    size: { width, height },
    fill: { color },
  };
}

function image(
  x: number,
  y: number,
  width: number,
  height: number,
  data: string,
  name: string,
): SlideElement {
  return {
    type: "image",
    position: { x, y },
    size: { width, height },
    data,
    fit: "contain",
    name,
  };
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, Math.max(0, max - 3))}...` : value;
}

function contrastText(hex: string): string {
  return luminance(hex) > 0.56 ? "111827" : "FFFFFF";
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = cleanHex(hex) || "000000";
  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }): string {
  return [r, g, b]
    .map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const linear = [r, g, b].map((value) => {
    const channel = value / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function colorDistance(a: string, b: string): number {
  const first = hexToRgb(a);
  const second = hexToRgb(b);
  return Math.sqrt(
    (first.r - second.r) ** 2 +
      (first.g - second.g) ** 2 +
      (first.b - second.b) ** 2,
  );
}

function rgbToHsl({ r, g, b }: { r: number; g: number; b: number }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
  }
  return { h: (h * 60 + 360) % 360, s, l };
}

function hslToHex({ h, s, l }: { h: number; s: number; l: number }): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [rn, gn, bn] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return rgbToHex({
    r: (rn + m) * 255,
    g: (gn + m) * 255,
    b: (bn + m) * 255,
  });
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
