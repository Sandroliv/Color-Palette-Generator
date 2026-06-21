import { hexToRgb, rgbToHsl, relativeLuminance } from "../core/utils.js";
import { contrastRatio } from "../tools/contrast.js";

/* ── Rollen-Mapping für Mockups ───────────────────
   Ordnet einer Palette automatisch semantische Rollen
   zu (Hintergrund, Fläche, Text, Akzente), damit die
   Farben in echten Layouts gezeigt werden können.
   Rein heuristisch — kein LLM/API. */

// Lesbare Tinte (schwarz/weiss) auf einer Fläche.
function inkOn(hex) {
  return relativeLuminance(hex) > 0.45 ? "#0A0A0A" : "#FFFFFF";
}

const FALLBACK_ROLES = {
  bg: "#FAFAF7",
  surface: "#FFFFFF",
  text: "#0A0A0A",
  accent: "#FF6B6B",
  accent2: "#4D96FF",
  onAccent: "#FFFFFF",
  onAccent2: "#FFFFFF",
};

/* forcedBg: optional eine Palettenfarbe, die als Hintergrund erzwungen wird
   (z.B. wenn der Nutzer im Mockup eine Farbe als Hintergrund wählt); sonst
   wird die hellste Farbe genommen. Die übrigen Rollen leiten sich daraus ab. */
export function deriveRoles(colorEntries, forcedBg) {
  const hexes = (colorEntries || []).map((entry) => entry?.hexColor).filter(Boolean);
  if (hexes.length === 0) return { ...FALLBACK_ROLES };

  const meta = hexes.map((hex) => {
    const hsl = rgbToHsl(hexToRgb(hex) || { r: 0, g: 0, b: 0 });
    return { hex, lum: relativeLuminance(hex), sat: hsl.s };
  });

  const byLight = [...meta].sort((a, b) => b.lum - a.lum);
  const bg = forcedBg && hexes.includes(forcedBg) ? forcedBg : byLight[0].hex; // gewählte oder hellste Farbe → Hintergrund

  // Text = bestkontrastierende Palettenfarbe, aber nur wenn wirklich lesbar
  // (WCAG AA ≥ 4.5); sonst lesbares Schwarz/Weiss erzwingen.
  let text = [...meta].sort((a, b) => contrastRatio(b.hex, bg) - contrastRatio(a.hex, bg))[0].hex;
  if (contrastRatio(text, bg) < 4.5) text = inkOn(bg);

  // Akzente = höchste Sättigung (ungleich Hintergrund).
  const bySat = meta.filter((m) => m.hex !== bg).sort((a, b) => b.sat - a.sat);
  const accent = (bySat[0] || meta[0]).hex;
  const accent2 = (bySat.find((m) => m.hex !== accent) || bySat[0] || meta[meta.length - 1]).hex;

  // Fläche = zweithellste, ungleich bg/text; sonst Hintergrund.
  const surface = (byLight.find((m) => m.hex !== bg && m.hex !== text) || byLight[1] || byLight[0])
    .hex;

  return { bg, surface, text, accent, accent2, onAccent: inkOn(accent), onAccent2: inkOn(accent2) };
}

/* Grobe Harmonie-Einordnung aus den Farbtönen (nur kräftige Farben zählen). */
export function classifyHarmony(colorEntries) {
  const hues = (colorEntries || [])
    .map((entry) => {
      const rgb = hexToRgb(entry?.hexColor);
      if (!rgb) return null;
      const { h, s } = rgbToHsl(rgb);
      return s >= 15 ? h : null;
    })
    .filter((h) => h !== null);

  if (hues.length < 2) return "Monochrom";

  const hueDistance = (a, b) => {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  };

  let maxSpan = 0;
  for (let i = 0; i < hues.length; i++) {
    for (let j = i + 1; j < hues.length; j++) {
      maxSpan = Math.max(maxSpan, hueDistance(hues[i], hues[j]));
    }
  }

  if (maxSpan <= 60) return "Analog";
  if (hues.length === 2 && maxSpan >= 130) return "Komplementär";
  if (hues.length >= 3 && maxSpan >= 90) return "Triadisch / Bunt";
  return "Gemischt";
}
