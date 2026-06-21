// Reine Palette-Parsing-Logik (kein DOM, kein Netzwerk) — aus den teils
// chaotischen Replicate-Ausgaben robuste #RRGGBB-Paletten gewinnen und auf die
// gewünschte Länge auffüllen. Bewusst frei von Seiteneffekten = isoliert testbar.
import { blendHexColors, rgbToHex } from "../core/utils.js";
import { MAX_OUTPUT_COLORS_LIMIT } from "../core/constants.js";

const HEX6 = /^#[0-9A-F]{6}$/;

// Einen Kandidaten zu kanonischem #RRGGBB normalisieren oder null zurückgeben.
function toHex6(value) {
  if (typeof value !== "string") return null;
  const upper = value.trim().toUpperCase();
  return HEX6.test(upper) ? upper : null;
}

// RGB-Tripel als 0–1 (normalisiert) oder 0–255 interpretieren und zu Hex machen.
function rgbTripleToHex(values) {
  const rgb = values.slice(0, 3);
  const normalized = rgb.every((v) => Number.isFinite(v) && v >= 0 && v <= 1);
  const [r, g, b] = normalized ? rgb.map((v) => v * 255) : rgb;
  return rgbToHex({ r, g, b });
}

export function extractHexColorsFromText(text, limit = 6) {
  if (typeof text !== "string") return [];
  const matches = text.match(/#[0-9a-fA-F]{6}\b/g) || [];
  return Array.from(new Set(matches.map((m) => m.toUpperCase()))).slice(0, limit);
}

export function extractRgbLikeArraysFromText(text, limit = 6) {
  if (typeof text !== "string") return [];
  const arrays = text.match(/\[[^\]]+\]/g) || [];
  const colors = [];

  for (const raw of arrays) {
    const numericValues = (raw.match(/-?\d*\.?\d+/g) || [])
      .map(Number.parseFloat)
      .filter(Number.isFinite);
    if (numericValues.length < 3) continue;
    colors.push(rgbTripleToHex(numericValues));
    if (colors.length >= limit) break;
  }

  return Array.from(new Set(colors));
}

export function normalizePaletteColors(colors) {
  if (!Array.isArray(colors)) return [];

  const seen = new Set();
  const normalized = [];
  for (const color of colors) {
    const value = toHex6(color);
    if (value && !seen.has(value)) {
      seen.add(value);
      normalized.push(value);
    }
  }
  return normalized;
}

export function ensurePaletteLength(
  primaryPalette,
  fallbackPalette,
  limit = MAX_OUTPUT_COLORS_LIMIT,
) {
  const result = normalizePaletteColors(primaryPalette);
  const fallback = normalizePaletteColors(fallbackPalette);
  const seen = new Set(result);

  const addColor = (candidate) => {
    const value = toHex6(candidate);
    if (!value || seen.has(value)) return false;
    seen.add(value);
    result.push(value);
    return true;
  };

  fallback.forEach(addColor);

  const sources = result.length > 0 ? result.slice() : fallback.slice();
  const seed = sources[0] || "#808080";
  const secondary = sources[1] || seed;
  const tertiary = sources[2] || secondary;
  const blendPlan = [
    () => blendHexColors(seed, "#FFFFFF", 0.18),
    () => blendHexColors(seed, "#000000", 0.18),
    () => blendHexColors(seed, secondary, 0.5),
    () => blendHexColors(secondary, "#FFFFFF", 0.28),
    () => blendHexColors(secondary, "#000000", 0.24),
    () => blendHexColors(secondary, tertiary, 0.5),
    () => blendHexColors(tertiary, "#FFFFFF", 0.32),
    () => blendHexColors(tertiary, "#000000", 0.32),
  ];

  for (const createColor of blendPlan) {
    if (result.length >= limit) break;
    addColor(createColor());
  }

  while (result.length < limit) {
    addColor(blendHexColors(seed, "#FFFFFF", 0.5 + result.length * 0.05) || seed);
    if (result.length >= limit) break;
    addColor(blendHexColors(seed, "#000000", 0.2 + result.length * 0.05) || seed);
    if (result.length >= limit) break;
    if (!addColor(seed)) {
      result.push(seed);
      seen.add(seed);
    }
    if (result.length > limit + 8) break;
  }

  return result.slice(0, limit);
}

export function parsePaletteFromReplicateOutput(output, limit = 6) {
  const hexLimit = Math.max(1, limit);

  if (Array.isArray(output) && output.every((item) => typeof item === "number")) {
    return output.length >= 3 ? [rgbTripleToHex(output)].slice(0, hexLimit) : [];
  }

  if (Array.isArray(output)) {
    const joined = output
      .filter((item) => typeof item === "string")
      .join("")
      .trim();
    const fromJoined = parsePaletteFromReplicateOutput(joined, hexLimit);
    if (fromJoined.length > 0) return fromJoined;

    const colors = output.flatMap((item) =>
      typeof item === "string" ? extractHexColorsFromText(item, hexLimit) : [],
    );
    return Array.from(new Set(colors)).slice(0, hexLimit);
  }

  if (typeof output === "string") {
    try {
      return parsePaletteFromReplicateOutput(JSON.parse(output), hexLimit);
    } catch {
      const hexColors = extractHexColorsFromText(output, hexLimit);
      return hexColors.length > 0 ? hexColors : extractRgbLikeArraysFromText(output, hexLimit);
    }
  }

  if (output && typeof output === "object") {
    if (Array.isArray(output.palette))
      return parsePaletteFromReplicateOutput(output.palette, hexLimit);
    if (Array.isArray(output.colors))
      return parsePaletteFromReplicateOutput(output.colors, hexLimit);

    if (["r", "g", "b"].every((key) => Number.isFinite(output[key]))) {
      return [rgbToHex({ r: output.r, g: output.g, b: output.b })].slice(0, hexLimit);
    }

    const serialized = JSON.stringify(output);
    const hexColors = extractHexColorsFromText(serialized, hexLimit);
    return hexColors.length > 0 ? hexColors : extractRgbLikeArraysFromText(serialized, hexLimit);
  }

  return [];
}
