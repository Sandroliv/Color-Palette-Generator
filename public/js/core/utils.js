export function normalizeHexColor(hexColor) {
  if (typeof hexColor !== "string") return null;

  let value = hexColor.trim();
  if (!value.startsWith("#")) value = `#${value}`;

  const shortHexMatch = /^#([0-9a-fA-F]{3})$/;
  const fullHexMatch = /^#([0-9a-fA-F]{6})$/;

  if (shortHexMatch.test(value)) {
    const [, short] = value.match(shortHexMatch);
    return `#${short
      .split("")
      .map((ch) => ch + ch)
      .join("")
      .toUpperCase()}`;
  }

  if (fullHexMatch.test(value)) {
    return value.toUpperCase();
  }

  return null;
}

export function hexToRgb(hexColor) {
  const normalized = normalizeHexColor(hexColor);
  if (!normalized) return null;

  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

export function rgbToHex({ r, g, b }) {
  const toHex = (value) =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function roundTo(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

// Prozentwert (0–100) auf 0–1 begrenzen — für HSL/HSV/CMYK-Eingaben.
const clampPct = (value) => Math.max(0, Math.min(100, value)) / 100;

// Farbton in Grad (0–360) aus normalisierten RGB-Kanälen. Gemeinsam für HSL & HSV.
function hueFromRgb(rn, gn, bn, max, delta) {
  if (delta === 0) return 0;
  let h;
  if (max === rn) h = ((gn - bn) / delta) % 6;
  else if (max === gn) h = (bn - rn) / delta + 2;
  else h = (rn - gn) / delta + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

export function rgbToHsl({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return {
    h: Math.round(hueFromRgb(rn, gn, bn, max, delta)),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function rgbToHsv({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const delta = max - Math.min(rn, gn, bn);
  const s = max === 0 ? 0 : delta / max;

  return {
    h: Math.round(hueFromRgb(rn, gn, bn, max, delta)),
    s: Math.round(s * 100),
    v: Math.round(max * 100),
  };
}

export function rgbToCmyk({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const k = 1 - Math.max(rn, gn, bn);
  if (k === 1) {
    return { c: 0, m: 0, y: 0, k: 100 };
  }

  const c = (1 - rn - k) / (1 - k);
  const m = (1 - gn - k) / (1 - k);
  const y = (1 - bn - k) / (1 - k);

  return {
    c: Math.round(c * 100),
    m: Math.round(m * 100),
    y: Math.round(y * 100),
    k: Math.round(k * 100),
  };
}

export function rgbToLch({ r, g, b }) {
  const toLinear = (channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };

  const rl = toLinear(r);
  const gl = toLinear(g);
  const bl = toLinear(b);

  const x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) / 0.95047;
  const y = (rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175) / 1.0;
  const z = (rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041) / 1.08883;

  const f = (value) => (value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116);

  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  const l = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const bAxis = 200 * (fy - fz);

  const c = Math.sqrt(a * a + bAxis * bAxis);
  let h = (Math.atan2(bAxis, a) * 180) / Math.PI;
  if (h < 0) h += 360;

  return {
    l: roundTo(l, 1),
    c: roundTo(c, 1),
    h: roundTo(h, 1),
  };
}

// Aus Chroma (c), Zwischenwert (x), Offset (m) und Farbton (hn) die RGB-Kanäle
// bilden — der Sektor-Block ist für HSL- und HSV-Umrechnung identisch.
function chromaToRgb(hn, c, x, m) {
  let rp, gp, bp;
  if (hn < 60) [rp, gp, bp] = [c, x, 0];
  else if (hn < 120) [rp, gp, bp] = [x, c, 0];
  else if (hn < 180) [rp, gp, bp] = [0, c, x];
  else if (hn < 240) [rp, gp, bp] = [0, x, c];
  else if (hn < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];

  return { r: (rp + m) * 255, g: (gp + m) * 255, b: (bp + m) * 255 };
}

export function hslToRgb({ h, s, l }) {
  const hn = ((h % 360) + 360) % 360;
  const sn = clampPct(s);
  const ln = clampPct(l);

  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
  return chromaToRgb(hn, c, x, ln - c / 2);
}

export function hsvToRgb({ h, s, v }) {
  const hn = ((h % 360) + 360) % 360;
  const vn = clampPct(v);

  const c = vn * clampPct(s);
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
  return chromaToRgb(hn, c, x, vn - c);
}

export function cmykToRgb({ c, m, y, k }) {
  const kn = clampPct(k);
  return {
    r: 255 * (1 - clampPct(c)) * (1 - kn),
    g: 255 * (1 - clampPct(m)) * (1 - kn),
    b: 255 * (1 - clampPct(y)) * (1 - kn),
  };
}

export function blendHexColors(leftHex, rightHex, amount) {
  const left = hexToRgb(leftHex);
  const right = hexToRgb(rightHex);
  if (!left || !right)
    return normalizeHexColor(leftHex) || normalizeHexColor(rightHex) || "#000000";

  return rgbToHex({
    r: left.r + (right.r - left.r) * amount,
    g: left.g + (right.g - left.g) * amount,
    b: left.b + (right.b - left.b) * amount,
  });
}

// Relative Luminanz (WCAG 2.x) einer Hex-Farbe; ungültige Eingabe → 0.
export function relativeLuminance(hexColor) {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return 0;
  const channel = (value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

// Lesbare Textfarbe (Tinte oder Weiß) für einen gegebenen Hintergrund.
export function getReadableTextColor(hexColor) {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return "#0A0A0A";
  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return luminance > 0.62 ? "#0A0A0A" : "#FFFFFF";
}

// ── Allgemeine Helfer (vorher in mehreren Dateien kopiert) ──

// Wert auf [lo, hi] begrenzen.
export const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));

// Text in einen dateinamen-tauglichen Slug umwandeln (Umlaute bleiben erhalten).
export function slugify(str) {
  return (
    String(str || "palette")
      .toLowerCase()
      .replace(/[^a-z0-9äöüß]+/gi, "-")
      .replace(/^-+|-+$/g, "") || "palette"
  );
}

// Einen Blob als Datei-Download auslösen (Object-URL wird danach freigegeben).
export function downloadBlob(blob, filename) {
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
