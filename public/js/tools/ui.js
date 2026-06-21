import { getColorFormatConfigs, getFormatLabel } from "../core/api.js";
import {
  normalizeHexColor,
  hexToRgb,
  rgbToHsl,
  rgbToHsv,
  rgbToCmyk,
  rgbToLch,
  getReadableTextColor,
} from "../core/utils.js";
import { getCachedColorName, fetchColorNames, localColorName } from "../color/color-names.js";
import { openSwatchPickerPopup } from "./swatch-picker.js";
import { exportPaletteAsPng } from "./palette-export.js";
import { playHoverSound } from "../audio/sound.js";

// getFormatLabel wird vom Namespace-Import (main.js: ui.getFormatLabel) erwartet.
export { getFormatLabel };

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);

  const helper = document.createElement("textarea");
  helper.value = text;
  helper.setAttribute("readonly", "");
  helper.style.position = "fixed";
  helper.style.opacity = "0";
  document.body.append(helper);
  helper.select();
  document.execCommand("copy");
  helper.remove();
}

function createPaletteSwatch({ code, hexColor }) {
  const swatch = document.createElement("button");
  swatch.type = "button";
  swatch.className = "palette-swatch";
  swatch.style.backgroundColor = hexColor;
  swatch.dataset.code = code;
  swatch.title = `${code} (Klick zum Kopieren)`;
  swatch.setAttribute("aria-label", `Farbe ${code}. Klick zum Kopieren.`);
  swatch.addEventListener("mouseenter", playHoverSound);

  swatch.addEventListener("click", async () => {
    try {
      await copyTextToClipboard(code);
      swatch.classList.add("is-copied");
      setTimeout(() => swatch.classList.remove("is-copied"), 900);
    } catch (error) {
      console.warn("Kopieren fehlgeschlagen:", error);
    }
  });

  return swatch;
}

/* ── Swatches mit dem Cursor umsortieren ──────────
   Pointer-Drag innerhalb einer Palette: ab kleiner
   Bewegung wird gezogen (sonst bleibt es ein Klick zum
   Kopieren). Eine Einfüge-Markierung zeigt das Ziel,
   beim Loslassen wird einmal umsortiert. */

let swatchDragState = null;

function onSwatchDragMove(event) {
  const state = swatchDragState;
  if (!state) return;
  const dx = event.clientX - state.startX;
  const dy = event.clientY - state.startY;

  if (!state.started) {
    if (Math.hypot(dx, dy) < 5) return;
    state.started = true;
    state.rowRect = state.row.getBoundingClientRect();
    state.n = state.row.querySelectorAll(".swatch-cell").length;
    state.row.classList.add("is-reordering");
    state.cell.classList.add("is-dragging");
    state.indicator = document.createElement("div");
    state.indicator.className = "swatch-drop-indicator";
    state.row.append(state.indicator);
  }

  state.cell.style.transform = `translateX(${dx}px)`;
  const colW = state.rowRect.width / state.n;
  const slot = Math.max(
    0,
    Math.min(state.n, Math.round((event.clientX - state.rowRect.left) / colW)),
  );
  state.slot = slot;
  state.indicator.style.left = `${slot * colW}px`;
}

function onSwatchDragEnd() {
  window.removeEventListener("pointermove", onSwatchDragMove);
  window.removeEventListener("pointerup", onSwatchDragEnd);
  const state = swatchDragState;
  swatchDragState = null;
  if (!state || !state.started) return; // reiner Klick → Swatch kopiert selbst

  // Den nachfolgenden Klick (würde kopieren) nach echtem Drag unterdrücken.
  const blocker = (event) => {
    event.stopPropagation();
    event.preventDefault();
  };
  document.addEventListener("click", blocker, true);
  setTimeout(() => document.removeEventListener("click", blocker, true), 0);

  state.cell.classList.remove("is-dragging");
  state.cell.style.transform = "";
  state.row.classList.remove("is-reordering");
  state.indicator?.remove();

  const from = state.index;
  const slot = state.slot ?? from;
  if (slot !== from && slot !== from + 1) {
    let to = from < slot ? slot - 1 : slot;
    to = Math.max(0, Math.min(state.n - 1, to));
    state.onReorder(from, to);
  }
}

function attachSwatchDrag(cell, index, row, onReorder) {
  cell.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    if (event.target.closest(".swatch-edit-btn")) return;
    swatchDragState = {
      index,
      startX: event.clientX,
      startY: event.clientY,
      cell,
      row,
      onReorder,
      started: false,
    };
    window.addEventListener("pointermove", onSwatchDragMove);
    window.addEventListener("pointerup", onSwatchDragEnd);
  });
}

// SVG-Icons der Header-Buttons (download / mockup).
const DOWNLOAD_ICON =
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m6 11 6 6 6-6"/><path d="M5 21h14"/></svg>';
const MOCKUP_ICON =
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>';

export function createPaletteContainer({
  format,
  colorEntries,
  className = "",
  titleText,
  onDelete,
  onRename,
  onConvert,
  onEditColor,
  onReorder,
  onAdjust,
  onMockup,
  showNames = false,
  name,
}) {
  const palette = document.createElement("div");
  palette.className = className;
  const entries = Array.isArray(colorEntries) ? colorEntries : [];

  if (onDelete !== undefined) {
    const header = document.createElement("div");
    header.className = "palette-header";

    const formatLabel = document.createElement(onConvert ? "button" : "span");
    formatLabel.className = "palette-format-label";
    formatLabel.textContent = getFormatLabel(format);
    formatLabel.dataset.format = String(format || "").toLowerCase();

    // Click on the pill toggles a bar with all colour codings.
    // Picking one duplicates the palette in that coding.
    let formatMenu = null;
    if (onConvert) {
      formatLabel.type = "button";
      formatLabel.title = "Farbcodierung ändern (dupliziert die Palette)";

      formatMenu = document.createElement("div");
      formatMenu.className = "palette-format-menu";

      for (const config of getColorFormatConfigs().values()) {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "palette-format-option";
        option.dataset.format = String(config.id).toLowerCase();
        option.textContent = config.label || String(config.id).toUpperCase();
        if (config.id === format) {
          option.disabled = true;
          option.classList.add("is-current");
        } else {
          option.addEventListener("click", () => {
            header.classList.remove("menu-open");
            onConvert(config.id);
          });
        }
        formatMenu.append(option);
      }

      formatLabel.addEventListener("click", () => header.classList.toggle("menu-open"));
    }

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "palette-name-input";
    nameInput.value = name || `${getFormatLabel(format)} Palette`;
    if (onRename) {
      nameInput.addEventListener("change", () => onRename(nameInput.value || name));
      nameInput.addEventListener("blur", () => onRename(nameInput.value || name));
    }

    const downloadBtn = document.createElement("button");
    downloadBtn.type = "button";
    downloadBtn.className = "palette-download-btn";
    downloadBtn.innerHTML = DOWNLOAD_ICON;
    downloadBtn.title = "Als PNG herunterladen";
    downloadBtn.setAttribute("aria-label", "Palette als PNG herunterladen");
    downloadBtn.addEventListener("click", () =>
      exportPaletteAsPng({ title: nameInput.value, format, colorEntries: entries }),
    );

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "palette-delete-btn";
    deleteBtn.innerHTML = "&#x2715;";
    deleteBtn.title = "Palette löschen";
    deleteBtn.setAttribute("aria-label", "Palette löschen");
    deleteBtn.addEventListener("click", onDelete);

    let mockupBtn;
    if (onMockup) {
      mockupBtn = document.createElement("button");
      mockupBtn.type = "button";
      mockupBtn.className = "palette-mockup-btn";
      mockupBtn.innerHTML = MOCKUP_ICON;
      mockupBtn.title = "Mockup-Vorschau";
      mockupBtn.setAttribute("aria-label", "Palette als Mockup-Vorschau ansehen");
      mockupBtn.addEventListener("click", onMockup);
    }

    header.append(formatLabel, nameInput, downloadBtn, deleteBtn);
    if (mockupBtn) header.insertBefore(mockupBtn, downloadBtn);
    if (formatMenu) header.append(formatMenu);
    palette.append(header);
  } else {
    const title = document.createElement("div");
    title.className = "palette-title";
    title.textContent = titleText || `${getFormatLabel(format)} (${entries.length})`;
    palette.append(title);
  }

  const swatchRow = document.createElement("div");
  swatchRow.className = "palette-swatch-row";
  const nameEls = [];

  entries.forEach((entry, index) => {
    const swatch = createPaletteSwatch(entry);

    if (!onEditColor) {
      // Nur in der Nicht-Editier-Vorschau, wo Swatches beim Hover überlappen.
      swatch.style.zIndex = String(entries.length - index);
      swatchRow.append(swatch);
      return;
    }

    // Editable swatch: wrap in a cell with a "Pigment" trigger
    // (swatches are <button>s — no nesting allowed).
    // KEIN inline z-index auf Swatch/Cell — sonst überdeckt der Swatch
    // (hoher z-index der vorderen Kacheln) Name und ✎.
    const cell = document.createElement("span");
    cell.className = "swatch-cell";
    cell.append(swatch);

    // Farbname direkt in der Farbfläche (color-name-api), cool zentriert.
    if (showNames) {
      const nameEl = document.createElement("span");
      nameEl.className = "swatch-name";
      nameEl.style.color = getReadableTextColor(entry.hexColor);
      const cached = getCachedColorName(entry.hexColor);
      nameEl.textContent = cached || localColorName(entry.hexColor);
      cell.append(nameEl);
      nameEls.push(nameEl);
    }

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "swatch-edit-btn";
    editBtn.innerHTML = "&#x270E;";
    editBtn.title = "Farbe anpassen (Pigment)";
    editBtn.setAttribute("aria-label", `Farbe ${entry.code} anpassen`);
    editBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      openSwatchPickerPopup({
        anchor: editBtn,
        colorEntries: entries,
        editIndex: index,
        onPick: (hex) => onEditColor(index, hex),
        onAdjust,
      });
    });
    cell.append(editBtn);

    // Reorder per Cursor: Farbfläche an neue Position ziehen.
    if (onReorder) attachSwatchDrag(cell, index, swatchRow, onReorder);

    swatchRow.append(cell);
  });

  // Namen asynchron nachladen und in den Flächen einsetzen.
  if (showNames && nameEls.length > 0) {
    fetchColorNames(entries.map((entry) => entry.hexColor))
      .then((names) => {
        names.forEach((colorName, i) => {
          if (!nameEls[i]) return;
          const finalName = colorName || localColorName(entries[i].hexColor);
          nameEls[i].textContent = finalName;
          nameEls[i].title = finalName;
        });
      })
      .catch(() => {
        /* lokaler Fallback bleibt stehen */
      });
  }

  palette.append(swatchRow);
  return palette;
}

export function formatColorCode(hexColor, format) {
  const normalizedHex = normalizeHexColor(hexColor);
  const rgb = hexToRgb(normalizedHex);
  if (!normalizedHex || !rgb) return null;

  switch (format) {
    case "hex":
      return normalizedHex;
    case "rgb":
      return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    case "hsl": {
      const hsl = rgbToHsl(rgb);
      return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
    }
    case "hsv": {
      const hsv = rgbToHsv(rgb);
      return `hsv(${hsv.h}, ${hsv.s}%, ${hsv.v}%)`;
    }
    case "cmyk": {
      const cmyk = rgbToCmyk(rgb);
      return `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`;
    }
    case "lch": {
      const lch = rgbToLch(rgb);
      return `lch(${lch.l}% ${lch.c} ${lch.h})`;
    }
    default:
      return normalizedHex;
  }
}
