import {
  hexToRgb,
  rgbToHex,
  hslToRgb,
  rgbToHsl,
  rgbToHsv,
  rgbToCmyk,
  rgbToLch,
} from "../core/utils.js";
import { localColorName, fetchColorNames } from "../color/color-names.js";
import { exportPaletteAsPng } from "./palette-export.js";
import { openMockupOverlay } from "./mockup.js";
import { playHoverSound, playSpaceSound } from "../audio/sound.js";

/* ── Coolors-artiger Paletten-Generator (lokal) ───
   Vollbild-Spalten; Leertaste/Generate würfelt die
   nicht gesperrten Farben neu. Pro Spalte: sperren,
   ziehen (umsortieren), entfernen, HEX kopieren.
   Icons/Typo passen ihre Farbe an den Kontrast an. */

const MIN_COLS = 2;
const DEFAULT_COLS = 5;

let columns = []; // [{ hex, locked }]
let undoStack = [];
let redoStack = [];
let rowEl = null;

// Farbcodierung der angezeigten/kopierten Werte (durchgeschaltet wie in der History).
const FORMATS = ["hex", "rgb", "hsl", "hsv", "cmyk", "lch"];
let formatIndex = 0;
let formatBtnEl = null;

// HEX in den aktuell gewählten Code-Stil umwandeln (für Anzeige & Clipboard).
function formatColor(hex, format = FORMATS[formatIndex]) {
  const rgb = hexToRgb(hex) || { r: 0, g: 0, b: 0 };
  switch (format) {
    case "rgb":
      return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    case "hsl": {
      const { h, s, l } = rgbToHsl(rgb);
      return `hsl(${h}, ${s}%, ${l}%)`;
    }
    case "hsv": {
      const { h, s, v } = rgbToHsv(rgb);
      return `hsv(${h}, ${s}%, ${v}%)`;
    }
    case "cmyk": {
      const { c, m, y, k } = rgbToCmyk(rgb);
      return `cmyk(${c}%, ${m}%, ${y}%, ${k}%)`;
    }
    case "lch": {
      const { l, c, h } = rgbToLch(rgb);
      return `lch(${l}% ${c} ${h})`;
    }
    default:
      return hex.toUpperCase();
  }
}

// Lesbare „Tinte" (Weiss oder Anthrazit) für Icons/Text auf der Farbfläche.
function readableInk(hex) {
  const { r, g, b } = hexToRgb(hex) || { r: 0, g: 0, b: 0 };
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.6 ? "#0A0A0A" : "#FFFFFF";
}

// Angenehme Zufallsfarbe (über HSL, damit keine Schlamm-Töne entstehen).
function randomHex() {
  return rgbToHex(
    hslToRgb({
      h: Math.floor(Math.random() * 360),
      s: 45 + Math.floor(Math.random() * 45),
      l: 36 + Math.floor(Math.random() * 40),
    }),
  );
}

const ICONS = {
  lockOpen:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>',
  lockClosed:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  grip: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>',
  remove:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  check:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
};

const snapshot = () => columns.map((c) => ({ ...c }));
const paletteEntries = () => columns.map((c) => ({ hexColor: c.hex, code: c.hex.toUpperCase() }));

function pushUndo() {
  undoStack.push(snapshot());
  if (undoStack.length > 60) undoStack.shift();
  redoStack = [];
}

function generate() {
  playSpaceSound();
  pushUndo();
  columns = columns.map((c) => (c.locked ? c : { ...c, hex: randomHex() }));
  render();
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  columns = undoStack.pop();
  render();
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  columns = redoStack.pop();
  render();
}

function toggleLock(i) {
  columns[i].locked = !columns[i].locked;
  render();
}

// Format-Button beschriften und einfärben (data-format steuert die Pillenfarbe).
function paintFormatBtn() {
  if (!formatBtnEl) return;
  formatBtnEl.textContent = FORMATS[formatIndex].toUpperCase();
  formatBtnEl.dataset.format = FORMATS[formatIndex];
}

// Farbcodierung umschalten (HEX → RGB → HSL → …).
function cycleFormat() {
  formatIndex = (formatIndex + 1) % FORMATS.length;
  paintFormatBtn();
  render();
}

function removeCol(i) {
  if (columns.length <= MIN_COLS) return;
  pushUndo();
  columns.splice(i, 1);
  render();
}

async function copyHex(i, btn) {
  try {
    await navigator.clipboard.writeText(formatColor(columns[i].hex));
    btn.innerHTML = ICONS.check;
    btn.classList.add("is-copied");
    setTimeout(() => {
      btn.innerHTML = ICONS.copy;
      btn.classList.remove("is-copied");
    }, 850);
  } catch {
    /* clipboard blocked */
  }
}

// ── Spalten per Griff umsortieren ──
let drag = null;
function targetIndexFromX(clientX) {
  const rect = rowEl.getBoundingClientRect();
  const idx = Math.floor(((clientX - rect.left) / rect.width) * columns.length);
  return Math.max(0, Math.min(columns.length - 1, idx));
}
function onDragMove() {
  /* visuelles Feedback via Cursor (CSS) reicht */
}
function onDragEnd(event) {
  document.removeEventListener("pointermove", onDragMove);
  document.removeEventListener("pointerup", onDragEnd);
  rowEl.classList.remove("is-dragging");
  if (!drag) return;
  const to = targetIndexFromX(event.clientX);
  if (to !== drag.index) {
    pushUndo();
    const [moved] = columns.splice(drag.index, 1);
    columns.splice(to, 0, moved);
    render();
  }
  drag = null;
}
function startDrag(event, index) {
  event.preventDefault();
  drag = { index };
  rowEl.classList.add("is-dragging");
  document.addEventListener("pointermove", onDragMove);
  document.addEventListener("pointerup", onDragEnd);
}

function toolButton(iconKey, title, onClick, extraClass = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `cool-tool ${extraClass}`.trim();
  button.innerHTML = ICONS[iconKey];
  button.title = title;
  button.setAttribute("aria-label", title);
  button.addEventListener("click", () => onClick(button));
  return button;
}

function render() {
  rowEl.replaceChildren();
  const nameEls = [];

  columns.forEach((col, i) => {
    const ink = readableInk(col.hex);
    const colEl = document.createElement("div");
    colEl.className = "cool-col" + (col.locked ? " is-locked" : "");
    colEl.style.background = col.hex;
    colEl.style.color = ink;
    colEl.addEventListener("mouseenter", playHoverSound);

    const tools = document.createElement("div");
    tools.className = "cool-tools";

    const lockBtn = toolButton(
      col.locked ? "lockClosed" : "lockOpen",
      col.locked ? "Entsperren" : "Sperren",
      () => toggleLock(i),
      col.locked ? "is-on" : "",
    );

    const grip = document.createElement("button");
    grip.type = "button";
    grip.className = "cool-tool cool-grip";
    grip.innerHTML = ICONS.grip;
    grip.title = "Ziehen zum Umsortieren";
    grip.setAttribute("aria-label", "Farbe verschieben");
    grip.addEventListener("pointerdown", (event) => startDrag(event, i));

    tools.append(
      lockBtn,
      grip,
      toolButton("remove", "Farbe entfernen", () => removeCol(i)),
      toolButton("copy", "Farbwert kopieren", (btn) => copyHex(i, btn)),
    );

    const meta = document.createElement("div");
    meta.className = "cool-meta";
    const hexEl = document.createElement("div");
    hexEl.className = "cool-hex";
    hexEl.textContent = formatColor(col.hex);
    const nameEl = document.createElement("div");
    nameEl.className = "cool-name";
    nameEl.textContent = localColorName(col.hex);
    nameEls.push(nameEl);
    meta.append(hexEl, nameEl);

    colEl.append(tools, meta);
    rowEl.append(colEl);
  });

  // Sprechende Farbnamen (api.color.pizza) asynchron nachladen.
  fetchColorNames(columns.map((c) => c.hex))
    .then((names) =>
      names.forEach((name, i) => {
        if (name && nameEls[i]) nameEls[i].textContent = name;
      }),
    )
    .catch(() => {
      /* lokaler Name bleibt */
    });
}

function isTyping(el) {
  return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

export function initCoolors({ row, generateBtn, undoBtn, redoBtn, viewBtn, exportBtn, formatBtn }) {
  if (!row) return;
  rowEl = row;
  formatBtnEl = formatBtn || null;
  columns = Array.from({ length: DEFAULT_COLS }, () => ({ hex: randomHex(), locked: false }));
  paintFormatBtn();
  render();

  formatBtn?.addEventListener("click", cycleFormat);
  generateBtn?.addEventListener("click", generate);
  undoBtn?.addEventListener("click", undo);
  redoBtn?.addEventListener("click", redo);
  viewBtn?.addEventListener("click", () =>
    openMockupOverlay({ colorEntries: paletteEntries(), name: "Palette" }),
  );
  exportBtn?.addEventListener("click", () =>
    exportPaletteAsPng({ title: "SAEK Palette", format: "hex", colorEntries: paletteEntries() }),
  );

  document.addEventListener("keydown", (event) => {
    if (event.code === "Space" && !isTyping(event.target)) {
      event.preventDefault();
      generate();
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    }
  });
}
