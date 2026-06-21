/* ── Farbnamen (color-name-api von meodai) ────────
   Holt sprechende Namen für Hex-Farben von der
   öffentlichen Instanz api.color.pizza und cached sie,
   damit das häufige Neu-Rendern der History die API
   nicht überlastet.
   Quelle: https://github.com/meodai/color-name-api */

import { hexToRgb, rgbToHsl } from "../core/utils.js";

const COLOR_NAME_ENDPOINT = "https://api.color.pizza/v1/";

const nameCache = new Map(); // "rrggbb" -> Name (oder null, wenn ohne Treffer)

/* Lokaler Fallback-Name (HSL-basiert), damit jede Farbe immer
   beschriftet ist — auch wenn die API offline ist / nichts liefert. */
export function localColorName(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return "Farbe";
  const { h, s, l } = rgbToHsl(rgb);

  if (s < 10) {
    if (l < 12) return "Schwarz";
    if (l < 30) return "Anthrazit";
    if (l < 55) return "Grau";
    if (l < 80) return "Silber";
    return "Weiss";
  }

  let base = "Rot";
  if (h < 12) base = "Rot";
  else if (h < 28) base = "Koralle";
  else if (h < 42) base = "Orange";
  else if (h < 55) base = "Bernstein";
  else if (h < 68) base = "Gelb";
  else if (h < 92) base = "Limette";
  else if (h < 135) base = "Grün";
  else if (h < 160) base = "Mint";
  else if (h < 185) base = "Türkis";
  else if (h < 205) base = "Cyan";
  else if (h < 225) base = "Himmelblau";
  else if (h < 250) base = "Blau";
  else if (h < 270) base = "Indigo";
  else if (h < 290) base = "Violett";
  else if (h < 315) base = "Purpur";
  else if (h < 340) base = "Magenta";
  else if (h < 352) base = "Pink";

  const tone = l < 30 ? "Dunkles " : l > 74 ? "Helles " : "";
  return `${tone}${base}`;
}

function normalizeKey(hex) {
  const raw = String(hex || "")
    .trim()
    .replace(/^#/, "")
    .toLowerCase();
  if (/^[0-9a-f]{6}$/.test(raw)) return raw;
  if (/^[0-9a-f]{3}$/.test(raw))
    return raw
      .split("")
      .map((ch) => ch + ch)
      .join("");
  return null;
}

/* Synchroner Zugriff auf bereits geholte Namen (für das
   sofortige Rendern; fehlende werden async nachgeladen). */
export function getCachedColorName(hex) {
  const key = normalizeKey(hex);
  return key ? nameCache.get(key) || null : null;
}

/* Holt Namen für eine Liste von Hex-Farben (in Reihenfolge).
   Bereits gecachte werden nicht erneut angefragt. */
export async function fetchColorNames(hexColors) {
  const keys = hexColors.map(normalizeKey);
  const missing = [...new Set(keys.filter((key) => key && !nameCache.has(key)))];

  if (missing.length > 0) {
    try {
      const response = await fetch(`${COLOR_NAME_ENDPOINT}?values=${missing.join(",")}`);
      if (response.ok) {
        const data = await response.json();
        for (const color of data.colors || []) {
          const key = normalizeKey(color.requestedHex || color.hex);
          if (key) nameCache.set(key, color.name || null);
        }
        // Treffer-Lücken als null merken, damit wir nicht endlos neu anfragen.
        missing.forEach((key) => {
          if (!nameCache.has(key)) nameCache.set(key, null);
        });
      }
    } catch {
      // Netzwerkfehler: nichts cachen, beim nächsten Render erneut versuchen.
    }
  }

  return keys.map((key) => (key ? nameCache.get(key) || null : null));
}
