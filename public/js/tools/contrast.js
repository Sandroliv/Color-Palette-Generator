import { normalizeHexColor, hexToRgb, relativeLuminance } from "../core/utils.js";

/* ── Kontrast-Checker (ohne LLM/API) ──────────────
   Wertet den WCAG-Kontrast zwischen zwei Farben aus.
   ≥ 7 = sehr gut (grün), 4–7 = mittel (gelb),
   < 4 = schlecht (rot). Coolors-inspiriert. */

/* Beliebige CSS-Farbe (Hex, Name, rgb(), hsl() …) → #RRGGBB.
   Nutzt den Canvas zum Normalisieren; ungültige Eingaben → null. */
function cssColorToHex(input) {
  const trimmed = String(input || "").trim();
  if (!trimmed) return null;

  const direct = normalizeHexColor(trimmed);
  if (direct) return direct;

  const ctx = document.createElement("canvas").getContext("2d");
  ctx.fillStyle = "#000000";
  ctx.fillStyle = trimmed;
  const first = ctx.fillStyle;
  ctx.fillStyle = "#ffffff";
  ctx.fillStyle = trimmed;
  const second = ctx.fillStyle;

  // Bei ungültiger Eingabe bleiben die zwei Sentinel-Werte verschieden.
  if (first !== second) return null;
  return typeof first === "string" && first.startsWith("#") ? first.toUpperCase() : null;
}

export function contrastRatio(hexA, hexB) {
  if (!hexToRgb(hexA) || !hexToRgb(hexB)) return null;
  const hi = Math.max(relativeLuminance(hexA), relativeLuminance(hexB));
  const lo = Math.min(relativeLuminance(hexA), relativeLuminance(hexB));
  return (hi + 0.05) / (lo + 0.05); // 1 … 21
}

/* Ampel-Schwellen (WCAG, wie bbc/color-contrast-checker):
   ≥ 4.5 grün (AA Normaltext), 3–4.5 gelb (nur Grosstext), darunter rot.
   Quelle: https://github.com/bbc/color-contrast-checker */
const GOOD_RATIO = 4.5;
const MEDIUM_RATIO = 3;

export function initContrastTool({ panel }) {
  if (!panel) return;

  const bgInput = panel.querySelector("#contrast-bg");
  const fgInput = panel.querySelector("#contrast-fg");
  const square = panel.querySelector("#contrast-square");
  const sample = panel.querySelector("#contrast-sample");
  const result = panel.querySelector("#contrast-result");
  if (!bgInput || !fgInput || !square || !sample || !result) return;

  function update() {
    const bgHex = cssColorToHex(bgInput.value);
    const fgHex = cssColorToHex(fgInput.value);

    bgInput.classList.toggle("is-invalid", !bgHex);
    fgInput.classList.toggle("is-invalid", !fgHex);

    result.textContent = "";
    result.className = "contrast-result";

    if (!bgHex || !fgHex) {
      const hint = document.createElement("div");
      hint.className = "contrast-hint";
      hint.textContent =
        "Bitte zwei gültige Farben eingeben (z.B. #0A0A0A, white, rgb(255,107,107)).";
      result.append(hint);
      return;
    }

    // Vorschau-Quadrat: Hintergrund = Primärfarbe, Text = Sekundärfarbe.
    square.style.backgroundColor = bgHex;
    sample.style.color = fgHex;

    const ratio = contrastRatio(bgHex, fgHex);
    let level, verdictText;
    if (ratio >= GOOD_RATIO) {
      level = "good";
      verdictText = "Gut genug";
    } else if (ratio >= MEDIUM_RATIO) {
      level = "medium";
      verdictText = "Mittel · nur Grosstext";
    } else {
      level = "bad";
      verdictText = "Nicht genug";
    }
    result.classList.add(`is-${level}`);

    const value = document.createElement("div");
    value.className = "contrast-value";
    value.textContent = ratio.toFixed(2);

    const caption = document.createElement("div");
    caption.className = "contrast-value-cap";
    caption.textContent = "Kontrast";

    const verdict = document.createElement("div");
    verdict.className = "contrast-verdict";
    verdict.textContent = verdictText;

    result.append(value, caption, verdict);
  }

  bgInput.addEventListener("input", update);
  fgInput.addEventListener("input", update);
  update();
}
