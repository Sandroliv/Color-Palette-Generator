import {
  normalizeHexColor,
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  hsvToRgb,
  cmykToRgb,
} from "../core/utils.js";
import { formatColorCode } from "../tools/ui.js";

// Anker-Parser für einen einzelnen Farbwert (genau ein Format pro Eintrag).
// rgbToHex rundet/clampt selbst → kein manuelles Math.round mehr nötig.
const VALUE_PARSERS = [
  {
    re: /^rgb\s*\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*\)$/i,
    toRgb: (m) => ({ r: +m[1], g: +m[2], b: +m[3] }),
  },
  {
    re: /^hsl\s*\(\s*([-+]?[\d.]+)\s*,\s*([-+]?[\d.]+)%\s*,\s*([-+]?[\d.]+)%\s*\)$/i,
    toRgb: (m) => hslToRgb({ h: +m[1], s: +m[2], l: +m[3] }),
  },
  {
    re: /^hsv\s*\(\s*([-+]?[\d.]+)\s*,\s*([-+]?[\d.]+)%\s*,\s*([-+]?[\d.]+)%\s*\)$/i,
    toRgb: (m) => hsvToRgb({ h: +m[1], s: +m[2], v: +m[3] }),
  },
  {
    re: /^cmyk\s*\(\s*([\d.]+)%\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)$/i,
    toRgb: (m) => cmykToRgb({ c: +m[1], m: +m[2], y: +m[3], k: +m[4] }),
  },
];

function colorValueToHex(value) {
  const normalized = normalizeHexColor(value);
  if (normalized) return normalized;

  for (const { re, toRgb } of VALUE_PARSERS) {
    const match = value.match(re);
    if (match) return rgbToHex(toRgb(match));
  }
  return null;
}

function addUniqueHexColor(collected, seen, candidate, limit) {
  const normalized = normalizeHexColor(candidate) || candidate;
  if (!normalized || seen.has(normalized)) return false;
  seen.add(normalized);
  collected.push(normalized);
  return collected.length >= limit;
}

// Freie Farbwerte im Text — feste Reihenfolge (hex → rgb → hsl → hsv),
// jeweils mit überschreibbarem Regex aus den Server-Patterns.
const TEXT_SCANNERS = [
  { key: "hex", fallback: "#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\\b", toHex: (m) => m[0] },
  {
    key: "rgb",
    fallback: "rgb\\s*\\(\\s*([0-9]{1,3})\\s*,\\s*([0-9]{1,3})\\s*,\\s*([0-9]{1,3})\\s*\\)",
    toHex: (m) => rgbToHex({ r: +m[1], g: +m[2], b: +m[3] }),
  },
  {
    key: "hsl",
    fallback:
      "hsl\\s*\\(\\s*([-+]?[0-9]*\\.?[0-9]+)\\s*,\\s*([-+]?[0-9]*\\.?[0-9]+)%\\s*,\\s*([-+]?[0-9]*\\.?[0-9]+)%\\s*\\)",
    toHex: (m) => rgbToHex(hslToRgb({ h: +m[1], s: +m[2], l: +m[3] })),
  },
  {
    key: "hsv",
    fallback:
      "hsv\\s*\\(\\s*([-+]?[0-9]*\\.?[0-9]+)\\s*,\\s*([-+]?[0-9]*\\.?[0-9]+)%\\s*,\\s*([-+]?[0-9]*\\.?[0-9]+)%\\s*\\)",
    toHex: (m) => rgbToHex(hsvToRgb({ h: +m[1], s: +m[2], v: +m[3] })),
  },
];

export function extractNeutralHexColorsFromText(text, limit, patterns = {}) {
  if (typeof text !== "string") return [];

  const collected = [];
  const seen = new Set();

  // 1) Explizite COLOR_NEUTRAL-Tokens (jedes Farbformat, inkl. CMYK).
  for (const match of text.matchAll(/\[\s*COLOR_NEUTRAL\s*:\s*([^\]]+?)\s*\]/gi)) {
    const hex = colorValueToHex(match[1].trim());
    if (hex && addUniqueHexColor(collected, seen, hex, limit)) return collected;
  }

  // 2) Frei im Text stehende Farbwerte, in fester Format-Reihenfolge.
  for (const { key, fallback, toHex } of TEXT_SCANNERS) {
    const pattern = new RegExp(patterns[key] || fallback, "gi");
    for (const match of text.matchAll(pattern)) {
      const hex = toHex(match);
      if (hex && addUniqueHexColor(collected, seen, hex, limit)) return collected;
    }
  }

  return collected;
}

// Format → AI-Anweisung. Alle Nicht-Hex-Formate folgen demselben Satzschema,
// daher als Tabelle (Label/Spezifikation/Beispielwert) statt switch-Zweigen.
// Beispielwerte bewusst NEUTRALGRAU (kein Farbton, mittlere Helligkeit): ein
// konkretes farbiges Beispiel verankert das LLM sonst auf genau diesem Ton/dieser
// Helligkeit (z.B. immer helles Rot #FF6B6B) statt die Farben aus dem Prompt-Thema
// abzuleiten. Das Beispiel zeigt nur das Format, nicht die zu wählende Farbe.
const NEUTRAL_TOKEN_FORMATS = {
  rgb: { label: "RGB", spec: "rgb(R, G, B)", example: "rgb(128, 128, 128)" },
  hsl: { label: "HSL", spec: "hsl(H, S%, L%)", example: "hsl(0, 0%, 50%)" },
  hsv: { label: "HSV", spec: "hsv(H, S%, V%)", example: "hsv(0, 0%, 50%)" },
  cmyk: { label: "CMYK", spec: "cmyk(C%, M%, Y%, K%)", example: "cmyk(0%, 0%, 0%, 50%)" },
};

// Leitplanke gegen „immer dieselben hellen Farben": Farben aus dem Motiv ableiten
// und ihren charakteristischen Ton (Sättigung/Helligkeit) behalten.
const THEME_GUIDANCE =
  " Die Beispielwerte zeigen NUR das Format, nicht die zu verwendende Farbe." +
  " Leite die Farben aus dem Thema/Motiv des Prompts ab und triff den charakteristischen Ton" +
  " — kräftige, dunkle oder satte Farben nicht pauschal aufhellen.";

export function buildPromptWithColorMetadata(prompt, { format, formatConfigs, maxColors } = {}) {
  // Anzahl der gewünschten Output-Farben: steuert die AI-Anweisung.
  const count = Math.max(1, Math.round(Number(maxColors) || 6));
  const fmt = format || "hex";

  const config = formatConfigs?.get(fmt) || {};
  const formatLabel = config.label || fmt.toUpperCase();

  const spec = NEUTRAL_TOKEN_FORMATS[fmt];
  let instruction;
  let tokenExample;
  if (spec) {
    tokenExample = `[COLOR_NEUTRAL:${spec.example}]`;
    instruction = `Gib die Antwort normal aus und füge genau ${count} Farb-Tokens im ${spec.label}-Format hinzu: [COLOR_NEUTRAL:${spec.spec}], z.B. ${tokenExample}.${THEME_GUIDANCE}`;
  } else {
    instruction = `Gib die Antwort normal aus und füge genau ${count} Farb-Tokens im Format [COLOR_NEUTRAL:#RRGGBB] hinzu.${THEME_GUIDANCE}`;
    tokenExample = "[COLOR_NEUTRAL:#808080]";
  }

  const metadata = {
    target_format: config.request_target || fmt,
    target_format_label: formatLabel,
    neutral_regex_token: tokenExample,
    max_colors: count,
    instruction,
  };

  return `${prompt}\n\n[COLOR_RULE_JSON]\n${JSON.stringify(metadata)}\n[/COLOR_RULE_JSON]`;
}

export function padColorEntriesToCount(entries, format, targetCount = 6) {
  if (entries.length === 0) return entries;
  const padded = [...entries];
  let step = 0;
  while (padded.length < targetCount) {
    step++;
    const src = entries[entries.length - 1];
    const rgb = hexToRgb(src.hexColor);
    if (!rgb) {
      padded.push(src);
      continue;
    }
    // Varianten um den Quellton herum: Helligkeit abwechselnd dunkler/heller und
    // den Farbton leicht drehen — Sättigung bleibt erhalten, damit kräftige Farben
    // nicht zu Weiss ausbleichen (früher: Tint Richtung 255 → immer hellere Töne).
    const hsl = rgbToHsl(rgb);
    const dir = step % 2 === 1 ? -1 : 1;
    const magnitude = Math.ceil(step / 2) * 10;
    const l = Math.max(12, Math.min(88, hsl.l + dir * magnitude));
    const h = (((hsl.h + step * 8) % 360) + 360) % 360;
    const variantHex = rgbToHex(hslToRgb({ h, s: hsl.s, l }));
    padded.push({ hexColor: variantHex, code: formatColorCode(variantHex, format) || variantHex });
  }
  return padded;
}
