import { getReadableTextColor, slugify, downloadBlob } from "../core/utils.js";
import { getFormatLabel } from "../core/api.js";
import { fetchColorNames, localColorName } from "../color/color-names.js";
import { getCvdMode, simulateHex, CVD_MODES } from "./cvd.js";

/* ── PNG-Export (4:3): Farben oben mit Codes & Namen,
      schwarzer Titelbalken unten — spiegelt das Design
      der History-Einträge. ───────────────────────── */

/* Emblem-Wasserzeichen für den Export (im Titelbalken).
   Verkleinerte Kopie von "Sandro Livo Emblem" — fehlt sie,
   wird sie im Export einfach weggelassen. */
function loadWatermarkImage() {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = "assets/emblem-watermark.png";
  });
}

/* Das Emblem ist schwarz; auf einem Offscreen-Canvas weiß
   einfärben, damit es hell auf den Farben sitzt. */
function tintImageWhite(img) {
  const off = document.createElement("canvas");
  off.width = img.width;
  off.height = img.height;
  const offCtx = off.getContext("2d");
  offCtx.drawImage(img, 0, 0);
  offCtx.globalCompositeOperation = "source-in";
  offCtx.fillStyle = "#FFFFFF";
  offCtx.fillRect(0, 0, off.width, off.height);
  return off;
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function exportPaletteAsPng({ title, format, colorEntries }) {
  const entries = (colorEntries || []).filter((e) => e?.hexColor);
  if (entries.length === 0) return;

  // Falls eine Sehsimulation aktiv ist: die sichtbaren Farbflächen werden durch
  // dieselbe Matrix wie die History-Palette geschickt. Codes & Namen bleiben echt
  // (genau wie auf dem gefilterten Bildschirm) — fillHex liefert die Anzeigefarbe.
  const cvdMode = getCvdMode();
  const cvdLabel = CVD_MODES.find((mode) => mode.id === cvdMode)?.label;
  const fillHex = (hex) => simulateHex(hex, cvdMode);

  try {
    await document.fonts.ready;
  } catch {
    /* fonts optional */
  }

  // Farbnamen (color-name-api) für die Beschriftung über dem Balken.
  let colorNames = [];
  try {
    colorNames = await fetchColorNames(entries.map((e) => e.hexColor));
  } catch {
    colorNames = [];
  }

  // Logical layout 1600×1200 (4:3), rendered at 2.5× —
  // 4000×3000 px, crisp enough for print (~170 ppi A3+).
  const W = 1600,
    H = 1200,
    BAR = 200,
    PAD = 64;
  const SCALE = 2.5;
  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);

  // ── Colour stripes (like the history swatch row) ──
  const stripeW = W / entries.length;
  entries.forEach((entry, i) => {
    ctx.fillStyle = fillHex(entry.hexColor);
    ctx.fillRect(i * stripeW, 0, stripeW + 1, H - BAR);
  });

  // ── Colour codes: vertical mono type, lower half of each stripe ──
  ctx.textBaseline = "middle";
  const codeBottom = H - BAR - 30;
  const maxCodeLen = (H - BAR) * 0.42;

  entries.forEach((entry, i) => {
    const code = String(entry.code || entry.hexColor).toUpperCase();
    const cx = i * stripeW + stripeW / 2;

    let fontSize = Math.min(34, stripeW * 0.28);
    let textW;
    do {
      ctx.font = `${fontSize}px "Fira Code", "Consolas", monospace`;
      textW = ctx.measureText(code).width;
      fontSize -= 2;
    } while (textW > maxCodeLen && fontSize >= 14);

    ctx.save();
    ctx.translate(cx, codeBottom);
    ctx.rotate(-Math.PI / 2); // reads bottom-to-top
    ctx.textAlign = "left";

    const textColor = getReadableTextColor(fillHex(entry.hexColor));
    const shadow = textColor === "#FFFFFF" ? "rgba(10,10,10,0.35)" : "rgba(255,255,255,0.45)";
    ctx.fillStyle = shadow;
    ctx.fillText(code, 1.5, 1.5);
    ctx.fillStyle = textColor;
    ctx.fillText(code, 0, 0);
    ctx.restore();
  });

  // ── Colour names: bold, vertical, upper half of each stripe ──
  ctx.textBaseline = "middle";
  const nameBottom = (H - BAR) * 0.48;
  const maxNameLen = (H - BAR) * 0.42;
  entries.forEach((entry, i) => {
    const name = String(colorNames[i] || localColorName(entry.hexColor) || "").trim();
    if (!name) return;
    const cx = i * stripeW + stripeW / 2;

    let fontSize = Math.min(30, stripeW * 0.22);
    let shown = name.toUpperCase();
    ctx.font = `700 ${fontSize}px "adapter-pe-variable", "Arial", sans-serif`;
    while (ctx.measureText(shown).width > maxNameLen && fontSize > 14) {
      fontSize -= 2;
      ctx.font = `700 ${fontSize}px "adapter-pe-variable", "Arial", sans-serif`;
    }
    while (ctx.measureText(shown).width > maxNameLen && shown.length > 1) {
      shown = shown.slice(0, -2) + "…";
    }

    ctx.save();
    ctx.translate(cx, nameBottom);
    ctx.rotate(-Math.PI / 2); // reads bottom-to-top, wie die Codes
    ctx.textAlign = "left";

    const textColor = getReadableTextColor(fillHex(entry.hexColor));
    const shadow = textColor === "#FFFFFF" ? "rgba(10,10,10,0.30)" : "rgba(255,255,255,0.40)";
    ctx.globalAlpha = 0.85; // dezent
    ctx.fillStyle = shadow;
    ctx.fillText(shown, 1.5, 1.5);
    ctx.fillStyle = textColor;
    ctx.fillText(shown, 0, 0);
    ctx.globalAlpha = 1;
    ctx.restore();
  });

  // ── Black title bar ──
  ctx.fillStyle = "#0A0A0A";
  ctx.fillRect(0, H - BAR, W, BAR);
  const barMidY = H - BAR / 2;

  // Format pill, filled with the button's colour.
  const formatId = String(format || "").toLowerCase();
  const pillColor = document.getElementById(`btn-${formatId}`)?.dataset.color || "#FFFFFF";
  const pillLabel = getFormatLabel(format);
  ctx.font = `900 36px "snaga-uni-display-extralight", "Arial Black", sans-serif`;
  const pillW = ctx.measureText(pillLabel).width + 56;
  const pillH = 64;
  const pillX = W - PAD - pillW;
  ctx.fillStyle = pillColor;
  drawRoundedRect(ctx, pillX, barMidY - pillH / 2, pillW, pillH, pillH / 2);
  ctx.fill();
  ctx.fillStyle = "#0A0A0A";
  ctx.textAlign = "center";
  ctx.fillText(pillLabel.toUpperCase(), pillX + pillW / 2, barMidY + 2);

  // ── Emblem, left of the pill — light and quiet ──
  const watermark = await loadWatermarkImage();
  let emblemLeft = pillX;
  if (watermark) {
    const wmWidth = 70;
    const wmHeight = wmWidth * (watermark.height / watermark.width);
    emblemLeft = pillX - 28 - wmWidth;
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.drawImage(tintImageWhite(watermark), emblemLeft, barMidY - wmHeight / 2, wmWidth, wmHeight);
    ctx.restore();
  }

  // Title, white display type, truncated to the available room.
  const safeTitle = (title || `${pillLabel} Palette`).toUpperCase();
  ctx.font = `900 72px "snaga-uni-display-extralight", "Arial Black", sans-serif`;
  ctx.textAlign = "left";
  ctx.fillStyle = "#FFFFFF";
  const maxTitleW = emblemLeft - PAD - 48;
  let shownTitle = safeTitle;
  while (ctx.measureText(shownTitle).width > maxTitleW && shownTitle.length > 1) {
    shownTitle = shownTitle.slice(0, -2) + "…";
  }
  ctx.fillText(shownTitle, PAD, barMidY + 4);

  // ── Watermark, bottom left ──
  ctx.font = `22px "array-mono", "Fira Code", monospace`;
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
  const credit =
    cvdMode !== "none"
      ? `© Sandro Fankhauser — SAEK · Sehsimulation: ${cvdLabel}`
      : "© Sandro Fankhauser — SAEK";
  ctx.fillText(credit, PAD, H - 28);

  // ── Download ──
  const slug = slugify(title || `${pillLabel}-palette`);
  canvas.toBlob((blob) => downloadBlob(blob, `${slug}.png`), "image/png");
}
