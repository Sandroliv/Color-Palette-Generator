import { PALETTE_HISTORY_STORAGE_KEY, PALETTE_COUNTER_KEY } from "../core/constants.js";
import { hexToRgb, rgbToHsl } from "../core/utils.js";

/* ── Sprechende Palettennamen ─────────────────────
   Statt "Palette 1" bekommt jede Palette einen Namen
   aus ihren Farbtönen ("Koralle & Mint", "Blau-Töne").
   Bleibt über das Namensfeld editierbar. */

function hueName({ h, s, l }) {
  if (s < 12) {
    if (l < 20) return "Kohle";
    if (l < 45) return "Graphit";
    if (l < 72) return "Grau";
    return "Nebel";
  }
  if (h < 12) return "Rot";
  if (h < 28) return "Koralle";
  if (h < 42) return "Orange";
  if (h < 55) return "Bernstein";
  if (h < 68) return "Gelb";
  if (h < 92) return "Lime";
  if (h < 135) return "Grün";
  if (h < 160) return "Mint";
  if (h < 185) return "Türkis";
  if (h < 205) return "Cyan";
  if (h < 225) return "Himmel";
  if (h < 250) return "Blau";
  if (h < 270) return "Indigo";
  if (h < 290) return "Violett";
  if (h < 315) return "Purpur";
  if (h < 340) return "Magenta";
  if (h < 352) return "Pink";
  return "Rot";
}

function generatePaletteName(colors) {
  const tones = (colors || [])
    .map((entry) => {
      const rgb = hexToRgb(entry.hexColor);
      return rgb ? rgbToHsl(rgb) : null;
    })
    .filter(Boolean);

  if (tones.length === 0) return null;

  const names = [...new Set(tones.map(hueName))];
  if (names.length >= 2) return `${names[0]} & ${names[1]}`;

  const avgL = tones.reduce((sum, t) => sum + t.l, 0) / tones.length;
  const avgS = tones.reduce((sum, t) => sum + t.s, 0) / tones.length;
  const prefix = avgL > 72 ? "Pastell " : avgS > 65 ? "Vivid " : "";
  return `${prefix}${names[0]}-Töne`;
}

let paletteHistoryItems = [];
let maxHistoryEntries = 10;
let paletteCounter = 0;

function sanitizePaletteHistoryItem(item) {
  if (!item || typeof item !== "object") return null;
  if (typeof item.format !== "string") return null;

  const sanitizedColors = (Array.isArray(item.colors) ? item.colors : [])
    .flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const hexColor = String(entry.hexColor || "");
      if (!hexColor) return [];
      return [
        {
          hexColor,
          code: typeof entry.code === "string" && entry.code.trim() ? entry.code.trim() : hexColor,
        },
      ];
    })
    .slice(0, 6);

  if (sanitizedColors.length === 0) return null;

  const name = typeof item.name === "string" && item.name.trim() ? item.name.trim() : null;
  return { format: item.format, colors: sanitizedColors, ...(name ? { name } : {}) };
}

export function initHistory(maxEntries) {
  maxHistoryEntries = Number(maxEntries) || 10;
  paletteHistoryItems = loadPaletteHistoryFromStorage();
  try {
    paletteCounter = Number(localStorage.getItem(PALETTE_COUNTER_KEY)) || 0;
  } catch {
    paletteCounter = 0;
  }
}

function loadPaletteHistoryFromStorage() {
  try {
    const raw = localStorage.getItem(PALETTE_HISTORY_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map(sanitizePaletteHistoryItem).filter(Boolean).slice(0, maxHistoryEntries)
      : [];
  } catch (error) {
    console.warn("Gespeicherte Paletten konnten nicht geladen werden:", error);
    return [];
  }
}

function savePaletteHistoryToStorage() {
  try {
    localStorage.setItem(PALETTE_HISTORY_STORAGE_KEY, JSON.stringify(paletteHistoryItems));
  } catch (error) {
    console.warn("Paletten konnten nicht gespeichert werden:", error);
  }
}

export function clearPaletteHistoryStorage() {
  try {
    localStorage.removeItem(PALETTE_HISTORY_STORAGE_KEY);
    localStorage.removeItem(PALETTE_COUNTER_KEY);
    paletteCounter = 0;
  } catch (error) {
    console.warn("Paletten konnten nicht geloescht werden:", error);
  }
}

export function getPaletteHistoryItems() {
  return paletteHistoryItems;
}

export function setPaletteHistoryItems(items) {
  paletteHistoryItems = Array.isArray(items) ? items.slice(0, maxHistoryEntries) : [];
}

export function addHistoryPalette(item) {
  const historyItem = sanitizePaletteHistoryItem(item);
  if (!historyItem) return;
  paletteCounter += 1;
  if (!historyItem.name) {
    historyItem.name = generatePaletteName(historyItem.colors) || `Palette ${paletteCounter}`;
  }
  try {
    localStorage.setItem(PALETTE_COUNTER_KEY, String(paletteCounter));
  } catch {
    /* ignore */
  }
  paletteHistoryItems = [historyItem, ...paletteHistoryItems].slice(0, maxHistoryEntries);
  savePaletteHistoryToStorage();
}

export function deleteHistoryPaletteByIndex(index) {
  paletteHistoryItems = paletteHistoryItems.filter((_, i) => i !== index);
  savePaletteHistoryToStorage();
}

export function updateHistoryPaletteColor(index, colorIndex, hexColor, code) {
  const item = paletteHistoryItems[index];
  if (!item || !item.colors?.[colorIndex]) return;
  item.colors[colorIndex] = { hexColor, code: code || hexColor };
  savePaletteHistoryToStorage();
}

export function reorderHistoryPaletteColor(index, fromIndex, toIndex) {
  const item = paletteHistoryItems[index];
  if (!item || !Array.isArray(item.colors)) return;
  const colors = item.colors;
  if (fromIndex < 0 || fromIndex >= colors.length || toIndex < 0 || toIndex >= colors.length)
    return;
  const [moved] = colors.splice(fromIndex, 1);
  colors.splice(toIndex, 0, moved);
  savePaletteHistoryToStorage();
}

export function setHistoryPaletteColors(index, colors) {
  const item = paletteHistoryItems[index];
  if (!item || !Array.isArray(colors)) return;
  item.colors = colors
    .filter((entry) => entry && entry.hexColor)
    .slice(0, 6)
    .map((entry) => ({ hexColor: entry.hexColor, code: entry.code || entry.hexColor }));
  savePaletteHistoryToStorage();
}

export function renameHistoryPaletteByIndex(index, newName) {
  if (index < 0 || index >= paletteHistoryItems.length) return;
  paletteHistoryItems[index] = { ...paletteHistoryItems[index], name: newName };
  savePaletteHistoryToStorage();
}
