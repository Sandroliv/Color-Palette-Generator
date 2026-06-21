import {
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  rgbToHsv,
  hslToRgb,
  hsvToRgb,
  clamp,
} from "../core/utils.js";
import { adjustHexColor } from "../color/color-adjust.js";

/* ── "Pigment" swatch picker ──────────────────────
   Bearbeitet einen einzelnen Swatch per Popup: voller Farbkreis
   (HSV wie in Procreate) plus optionale Schnellauswahl harmonischer
   Töne, die aus den übrigen Swatches der Palette abgeleitet werden. */

function circularMeanHue(hues) {
  let x = 0,
    y = 0;
  for (const h of hues) {
    x += Math.cos((h * Math.PI) / 180);
    y += Math.sin((h * Math.PI) / 180);
  }
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function generateMatchingColors(colorEntries, editIndex) {
  const others = colorEntries
    .filter((_, i) => i !== editIndex)
    .map((entry) => {
      const rgb = hexToRgb(entry.hexColor);
      return rgb ? rgbToHsl(rgb) : null;
    })
    .filter(Boolean);

  const current = hexToRgb(colorEntries[editIndex]?.hexColor || "#888888");
  const base =
    others.length > 0
      ? {
          h: circularMeanHue(others.map((t) => t.h)),
          s: others.reduce((sum, t) => sum + t.s, 0) / others.length,
          l: others.reduce((sum, t) => sum + t.l, 0) / others.length,
        }
      : rgbToHsl(current);

  const s = clamp(base.s, 18, 88);
  const l = clamp(base.l, 24, 80);

  // Harmony candidates around the palette's average hue.
  const candidates = [
    { h: base.h + 15, s, l }, // analogous
    { h: base.h - 15, s, l },
    { h: base.h + 35, s, l: clamp(l + 10, 18, 86) },
    { h: base.h - 35, s, l: clamp(l - 10, 18, 86) },
    { h: base.h + 180, s, l }, // complementary
    { h: base.h + 150, s, l: clamp(l + 8, 18, 86) }, // split-complementary
    { h: base.h, s, l: clamp(l + 20, 18, 90) }, // tonal light
    { h: base.h, s, l: clamp(l - 20, 12, 86) }, // tonal dark
  ];

  const existing = new Set(colorEntries.map((entry) => String(entry.hexColor).toLowerCase()));
  const result = [];
  for (const tone of candidates) {
    const hex = rgbToHex(
      hslToRgb({
        h: ((tone.h % 360) + 360) % 360,
        s: Math.round(clamp(tone.s, 0, 100)),
        l: Math.round(clamp(tone.l, 0, 100)),
      }),
    ).toLowerCase();
    if (!existing.has(hex) && !result.includes(hex)) result.push(hex);
  }
  return result.slice(0, 8);
}

let activeSwatchPopup = null;

export function closeSwatchPickerPopup() {
  if (!activeSwatchPopup) return;
  activeSwatchPopup.remove();
  activeSwatchPopup = null;
  document.removeEventListener("pointerdown", onDocumentPointerDown, true);
  document.removeEventListener("keydown", onPopupKeydown, true);
}

function onDocumentPointerDown(event) {
  if (activeSwatchPopup && !activeSwatchPopup.contains(event.target)) closeSwatchPickerPopup();
}

function onPopupKeydown(event) {
  if (event.key === "Escape") closeSwatchPickerPopup();
}

// Freie Farbwahl: voller Farbkreis (Position 0–1 ↔ Farbton 0–360°).
const allowedHueFromT = (t) => clamp(t, 0, 1) * 360;
const tFromAllowedHue = (hue) => (((hue % 360) + 360) % 360) / 360;

export function openSwatchPickerPopup({ anchor, colorEntries, editIndex, onPick, onAdjust }) {
  closeSwatchPickerPopup();

  const currentRgb = hexToRgb(colorEntries[editIndex]?.hexColor || "#888888");

  // Anpassen-Zustand (Sättigung/Kontrast/Helligkeit) — wirkt gleichzeitig
  // mit der frei gewählten Farbe. updateAdjustStrip wird gesetzt, sobald
  // die Anpassen-Sektion gebaut ist (sonst No-Op).
  const baseHexes = (colorEntries || []).map((entry) => entry.hexColor).filter(Boolean);
  const adjustState = { saturation: 0, contrast: 0, brightness: 0 };
  let updateAdjustStrip = () => {};

  // Freie Farbwahl: voller Sättigungs-/Helligkeitsbereich.
  const sMin = 0,
    sMax = 100,
    vMin = 0,
    vMax = 100;

  // Picker state (HSV, like Procreate), full range.
  const startHsv = rgbToHsv(currentRgb);
  let hueT = tFromAllowedHue(startHsv.h);
  let hue = allowedHueFromT(hueT);
  let sat = clamp(startHsv.s, sMin, sMax);
  let val = clamp(startHsv.v, vMin, vMax);

  const popup = document.createElement("div");
  popup.className = "swatch-picker-popup";

  const label = document.createElement("div");
  label.className = "swatch-picker-label";
  label.textContent = "Pigment — Farbe frei wählen";

  // Saturation/value field.
  const FIELD_W = 216,
    FIELD_H = 140,
    HUE_H = 16;
  const field = document.createElement("canvas");
  field.className = "swatch-picker-field";
  field.width = FIELD_W;
  field.height = FIELD_H;
  const fieldCtx = field.getContext("2d");

  // Harmony-restricted hue lane.
  const hueLane = document.createElement("canvas");
  hueLane.className = "swatch-picker-hue";
  hueLane.width = FIELD_W;
  hueLane.height = HUE_H;
  const hueCtx = hueLane.getContext("2d");

  // Preview row + apply.
  const previewRow = document.createElement("div");
  previewRow.className = "swatch-picker-preview-row";
  const previewChip = document.createElement("span");
  previewChip.className = "swatch-picker-preview";
  const previewCode = document.createElement("span");
  previewCode.className = "swatch-picker-code";
  const applyBtn = document.createElement("button");
  applyBtn.type = "button";
  applyBtn.className = "swatch-picker-apply";
  applyBtn.textContent = "Übernehmen";
  previewRow.append(previewChip, previewCode, applyBtn);

  // Quick harmony chips.
  const grid = document.createElement("div");
  grid.className = "swatch-picker-grid";
  generateMatchingColors(colorEntries, editIndex).forEach((hex) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "swatch-picker-option";
    option.style.backgroundColor = hex;
    option.title = hex;
    option.setAttribute("aria-label", `Farbe ${hex} übernehmen`);
    option.addEventListener("click", () => {
      closeSwatchPickerPopup();
      onPick(hex);
    });
    grid.append(option);
  });

  popup.append(label, field, hueLane, grid, previewRow);

  function currentHex() {
    return rgbToHex(hsvToRgb({ h: hue, s: sat, v: val }));
  }

  // Gewählte Farbe + Anpassung kombiniert (für die einzelne Farbe).
  function finalSingleHex() {
    return onAdjust ? adjustHexColor(currentHex(), adjustState) : currentHex();
  }

  function drawField() {
    // Per-pixel paint of the palette's s/v window only.
    const image = fieldCtx.createImageData(FIELD_W, FIELD_H);
    const data = image.data;
    for (let y = 0; y < FIELD_H; y++) {
      const v = vMax - (y / (FIELD_H - 1)) * (vMax - vMin);
      for (let x = 0; x < FIELD_W; x++) {
        const s = sMin + (x / (FIELD_W - 1)) * (sMax - sMin);
        const { r, g, b } = hsvToRgb({ h: hue, s, v });
        const idx = (y * FIELD_W + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }
    fieldCtx.putImageData(image, 0, 0);

    // Cursor ring (mapped into the range window).
    const cx = ((sat - sMin) / Math.max(1, sMax - sMin)) * FIELD_W;
    const cy = ((vMax - val) / Math.max(1, vMax - vMin)) * FIELD_H;
    fieldCtx.beginPath();
    fieldCtx.arc(cx, cy, 7, 0, Math.PI * 2);
    fieldCtx.strokeStyle = "#FFFFFF";
    fieldCtx.lineWidth = 2.5;
    fieldCtx.stroke();
    fieldCtx.beginPath();
    fieldCtx.arc(cx, cy, 8.5, 0, Math.PI * 2);
    fieldCtx.strokeStyle = "rgba(0,0,0,0.45)";
    fieldCtx.lineWidth = 1;
    fieldCtx.stroke();
  }

  function drawHueLane() {
    for (let x = 0; x < FIELD_W; x++) {
      hueCtx.fillStyle = `hsl(${allowedHueFromT(x / FIELD_W)}, 90%, 55%)`;
      hueCtx.fillRect(x, 0, 1, HUE_H);
    }
    // Thumb.
    const tx = hueT * FIELD_W;
    hueCtx.fillStyle = "#FFFFFF";
    hueCtx.fillRect(tx - 1.5, 0, 3, HUE_H);
    hueCtx.strokeStyle = "rgba(0,0,0,0.4)";
    hueCtx.strokeRect(tx - 2.5, 0.5, 5, HUE_H - 1);
  }

  function updatePreview() {
    const hex = finalSingleHex();
    previewChip.style.backgroundColor = hex;
    previewCode.textContent = hex.toUpperCase();
  }

  function repaint() {
    drawField();
    drawHueLane();
    updatePreview();
    updateAdjustStrip();
  }

  function dragHandler(canvas, onMove) {
    canvas.addEventListener("pointerdown", (event) => {
      canvas.setPointerCapture(event.pointerId);
      onMove(event);
      const move = (e) => onMove(e);
      const up = () => {
        canvas.removeEventListener("pointermove", move);
        canvas.removeEventListener("pointerup", up);
      };
      canvas.addEventListener("pointermove", move);
      canvas.addEventListener("pointerup", up);
    });
  }

  dragHandler(field, (event) => {
    const rect = field.getBoundingClientRect();
    const tx = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const ty = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    sat = sMin + tx * (sMax - sMin);
    val = vMax - ty * (vMax - vMin);
    repaint();
  });

  dragHandler(hueLane, (event) => {
    const rect = hueLane.getBoundingClientRect();
    hueT = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    hue = allowedHueFromT(hueT);
    repaint();
  });

  applyBtn.addEventListener("click", () => {
    const hex = finalSingleHex();
    closeSwatchPickerPopup();
    onPick(hex);
  });

  // ── Anpassen-Sektion: Sättigung/Kontrast/Helligkeit, gleichzeitig mit
  //    der gewählten Farbe; „Übernehmen" oben wendet beides auf die Farbe
  //    an, „Ganze Palette" auf alle Farben. ──
  if (onAdjust && baseHexes.length > 0) {
    const section = document.createElement("div");
    section.className = "swatch-picker-adjust";

    const heading = document.createElement("div");
    heading.className = "swatch-picker-label";
    heading.textContent = "Anpassen — Sättigung · Kontrast · Helligkeit";

    const strip = document.createElement("div");
    strip.className = "adjust-preview";
    const chips = baseHexes.map((hex, i) => {
      const chip = document.createElement("span");
      chip.className = "adjust-preview-chip";
      if (i === editIndex) chip.classList.add("is-current");
      chip.style.backgroundColor = hex;
      strip.append(chip);
      return chip;
    });

    // Vorschau-Streifen: bearbeitete Farbe = gewählte Farbe + Anpassung,
    // die übrigen = Original + Anpassung.
    updateAdjustStrip = () => {
      baseHexes.forEach((hex, i) => {
        if (!chips[i]) return;
        chips[i].style.backgroundColor =
          i === editIndex ? finalSingleHex() : adjustHexColor(hex, adjustState);
      });
    };

    const slidersWrap = document.createElement("div");
    slidersWrap.className = "adjust-sliders";
    [
      { key: "saturation", text: "Sättigung" },
      { key: "contrast", text: "Kontrast" },
      { key: "brightness", text: "Helligkeit" },
    ].forEach(({ key, text }) => {
      const row = document.createElement("label");
      row.className = "adjust-slider-row";

      const name = document.createElement("span");
      name.className = "adjust-slider-name";
      name.textContent = text;

      const value = document.createElement("span");
      value.className = "adjust-slider-value";
      value.textContent = "0";

      const input = document.createElement("input");
      input.type = "range";
      input.className = "adjust-slider";
      input.min = "-100";
      input.max = "100";
      input.step = "1";
      input.value = "0";
      input.addEventListener("input", () => {
        adjustState[key] = Number(input.value);
        value.textContent =
          adjustState[key] > 0 ? `+${adjustState[key]}` : String(adjustState[key]);
        updatePreview();
        updateAdjustStrip();
      });

      row.append(name, input, value);
      slidersWrap.append(row);
    });

    const applyAllBtn = document.createElement("button");
    applyAllBtn.type = "button";
    applyAllBtn.className = "swatch-picker-apply adjust-apply-all";
    applyAllBtn.textContent = "Ganze Palette";
    applyAllBtn.addEventListener("click", () => {
      const hexes = baseHexes.map((hex, i) =>
        i === editIndex ? finalSingleHex() : adjustHexColor(hex, adjustState),
      );
      closeSwatchPickerPopup();
      onAdjust(hexes);
    });

    section.append(heading, strip, slidersWrap, applyAllBtn);
    popup.append(section);
  }

  repaint();

  document.body.append(popup);
  activeSwatchPopup = popup;

  // Position near the anchor, kept inside the viewport.
  const rect = anchor.getBoundingClientRect();
  const w = popup.offsetWidth;
  const h = popup.offsetHeight;
  const left = clamp(rect.left + rect.width / 2 - w / 2, 8, window.innerWidth - w - 8);
  let top = rect.bottom + 10;
  if (top + h > window.innerHeight - 8) top = rect.top - h - 10;
  popup.style.left = `${left}px`;
  popup.style.top = `${Math.max(8, top)}px`;

  document.addEventListener("pointerdown", onDocumentPointerDown, true);
  document.addEventListener("keydown", onPopupKeydown, true);
}
