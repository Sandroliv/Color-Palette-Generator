/* ── Sehsimulation (Color Vision Deficiency) ──────
   Simuliert in der History-Palette, wie die Farben für
   Menschen mit Farbsehschwäche wirken. Rein visuell über
   einen SVG-feColorMatrix-Filter auf #color-history — die
   echten Farbcodes (zum Kopieren) bleiben unverändert.
   Auswahl wird in localStorage gemerkt. Mockup-Vorschau
   und PNG-Export übernehmen die Simulation, indem sie die
   Farben rechnerisch durch dieselbe Matrix schicken. */

import { hexToRgb, rgbToHex } from "../core/utils.js";

const CVD_STORAGE_KEY = "history-cvd-mode-v1";

export const CVD_MODES = [
  { id: "none", label: "Normalsicht" },
  { id: "protanopia", label: "Protanopie · Rot-Blindheit" },
  { id: "deuteranopia", label: "Deuteranopie · Grün-Blindheit" },
  { id: "tritanopia", label: "Tritanopie · Blau-Blindheit" },
  { id: "achromatopsia", label: "Achromatopsie · Graustufen" },
];

// 4×5-Matrizen (RGBA + Offset) für SVG feColorMatrix.
// Gängige Simulations-Approximationen (Brettel/Viénot-Stil).
const CVD_MATRICES = {
  protanopia: [0.567, 0.433, 0, 0, 0, 0.558, 0.442, 0, 0, 0, 0, 0.242, 0.758, 0, 0, 0, 0, 0, 1, 0],
  deuteranopia: [0.625, 0.375, 0, 0, 0, 0.7, 0.3, 0, 0, 0, 0, 0.3, 0.7, 0, 0, 0, 0, 0, 1, 0],
  tritanopia: [0.95, 0.05, 0, 0, 0, 0, 0.433, 0.567, 0, 0, 0, 0.475, 0.525, 0, 0, 0, 0, 0, 1, 0],
  achromatopsia: [
    0.299, 0.587, 0.114, 0, 0, 0.299, 0.587, 0.114, 0, 0, 0.299, 0.587, 0.114, 0, 0, 0, 0, 0, 1, 0,
  ],
};

// Aktuell gewählter Modus (gespiegelt aus dem <select>, damit Mockup &
// PNG-Export ihn ohne DOM-Zugriff abfragen können).
let activeMode = "none";

/* Aktuellen Simulations-Modus abfragen ("none", "protanopia", …). */
export function getCvdMode() {
  return activeMode;
}

/* Eine HEX-Farbe rechnerisch durch die feColorMatrix des Modus schicken,
   damit gebackene Ausgaben (Mockup-DOM, PNG) die Simulation zeigen. */
export function simulateHex(hex, mode = activeMode) {
  const matrix = CVD_MATRICES[mode];
  if (!matrix) return hex; // "none" oder unbekannt → unverändert
  const { r, g, b } = hexToRgb(hex) || { r: 0, g: 0, b: 0 };
  const channel = (row) =>
    matrix[row] * r + matrix[row + 1] * g + matrix[row + 2] * b + matrix[row + 4] * 255;
  return rgbToHex({
    r: Math.max(0, Math.min(255, Math.round(channel(0)))),
    g: Math.max(0, Math.min(255, Math.round(channel(5)))),
    b: Math.max(0, Math.min(255, Math.round(channel(10)))),
  });
}

/* Liste von { hexColor, code } durch die Simulation schicken (für das Mockup). */
export function simulateEntries(colorEntries, mode = activeMode) {
  if (!CVD_MATRICES[mode]) return colorEntries || [];
  return (colorEntries || []).map((entry) => {
    const hex = simulateHex(entry.hexColor, mode);
    return { ...entry, hexColor: hex, code: hex.toUpperCase() };
  });
}

const SVG_NS = "http://www.w3.org/2000/svg";

/* Versteckte SVG-Filterdefinitionen einmalig ins DOM legen. */
function injectFilters() {
  if (document.getElementById("cvd-filter-defs")) return;

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.id = "cvd-filter-defs";
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.style.position = "absolute";
  svg.style.width = "0";
  svg.style.height = "0";
  svg.style.overflow = "hidden";

  const defs = document.createElementNS(SVG_NS, "defs");
  for (const [id, matrix] of Object.entries(CVD_MATRICES)) {
    const filter = document.createElementNS(SVG_NS, "filter");
    filter.id = `cvd-${id}`;
    filter.setAttribute("color-interpolation-filters", "sRGB");

    const node = document.createElementNS(SVG_NS, "feColorMatrix");
    node.setAttribute("type", "matrix");
    node.setAttribute("values", matrix.join(" "));

    filter.append(node);
    defs.append(filter);
  }
  svg.append(defs);
  document.body.append(svg);
}

function readStoredMode() {
  try {
    const stored = localStorage.getItem(CVD_STORAGE_KEY);
    return CVD_MODES.some((mode) => mode.id === stored) ? stored : "none";
  } catch {
    return "none";
  }
}

function storeMode(mode) {
  try {
    localStorage.setItem(CVD_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

/* Verdrahtet das <select> mit dem Filter-Ziel (#color-history).
   Setzt data-cvd, das CSS in einen feColorMatrix-Filter übersetzt. */
export function initCvdControl({ select, target }) {
  if (!select || !target) return;
  injectFilters();

  // Optionen aufbauen.
  select.textContent = "";
  for (const mode of CVD_MODES) {
    const option = document.createElement("option");
    option.value = mode.id;
    option.textContent = mode.label;
    select.append(option);
  }

  const apply = (mode) => {
    activeMode = mode;
    if (mode === "none") target.removeAttribute("data-cvd");
    else target.dataset.cvd = mode;
  };

  const initial = readStoredMode();
  select.value = initial;
  apply(initial);

  select.addEventListener("change", () => {
    const mode = select.value;
    apply(mode);
    storeMode(mode);
  });
}
