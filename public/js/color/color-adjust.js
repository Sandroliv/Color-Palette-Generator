import { hexToRgb, rgbToHex, rgbToHsl, hslToRgb, clamp } from "../core/utils.js";

/* ── Farb-Anpassung: Sättigung, Kontrast, Helligkeit ──
   Relativ zur Ausgangsfarbe (Regler bei 0 = unverändert).
   Wird einzeln pro Farbe oder auf die ganze Palette
   angewendet (ui.js, Pigment-Popover). */

export function adjustHexColor(hex, { saturation = 0, contrast = 0, brightness = 0 } = {}) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  // Sättigung & Helligkeit relativ in HSL.
  const hsl = rgbToHsl(rgb);
  const s = clamp(hsl.s * (1 + saturation / 100), 0, 100);
  const l = clamp(hsl.l * (1 + brightness / 100), 0, 100);
  const base = hslToRgb({ h: hsl.h, s, l });

  // Kontrast: Werte um die Mitte (128) spreizen/stauchen.
  const f = 1 + contrast / 100;
  return rgbToHex({
    r: clamp((base.r - 128) * f + 128, 0, 255),
    g: clamp((base.g - 128) * f + 128, 0, 255),
    b: clamp((base.b - 128) * f + 128, 0, 255),
  });
}
