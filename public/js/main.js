import { renderOutput } from "./output/index.js";
import * as api from "./core/api.js";
import * as ui from "./tools/ui.js";
import * as imagePalette from "./image/image-palette.js";
import * as history from "./tools/history.js";
import { initCvdControl } from "./tools/cvd.js";
import { initContrastTool } from "./tools/contrast.js";
import { initCoolors } from "./tools/coolors.js";
import { openMockupOverlay } from "./tools/mockup.js";
import {
  DEFAULT_MAX_HISTORY_ENTRIES,
  IMAGE_PALETTE_MAX_IMAGES,
  MAX_OUTPUT_COLORS_LIMIT,
} from "./core/constants.js";
import {
  extractNeutralHexColorsFromText,
  buildPromptWithColorMetadata,
  padColorEntriesToCount,
} from "./color/color-parser.js";

const form = document.querySelector("#form");
const output = document.querySelector("#output");
const input = document.querySelector("#input");
const submitButton = document.querySelector("#submit-button");
const resetButton = document.querySelector("#reset-button");
const fileInput = document.getElementById("fileInput");
const uploadBtn = document.getElementById("uploadBtn");
const imagePaletteSlider = document.querySelector("#image-palette-slider");
const modelPicker = document.querySelector("#model-picker");
const colorHistory = document.querySelector("#color-history");
const colorButtons = Array.from(document.querySelectorAll(".color-btn"));
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

let selectedColorFormat = null;
let selectedColorHex = null;
let maxHistoryEntries = DEFAULT_MAX_HISTORY_ENTRIES;
let maxOutputColors = MAX_OUTPUT_COLORS_LIMIT;
let selectedImageFiles = [];
let pendingImageQuestion = "";
let colorFormatConfigByButtonId = new Map();
let selectedProvider = null;

function setOutputMessage(message) {
  output.textContent = message;
  output.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function clearSelectedColorState() {
  selectedColorFormat = null;
  selectedColorHex = null;
  document.documentElement.style.removeProperty("--selected-format-color");
  colorButtons.forEach((button) => button.classList.remove("is-selected"));
}

function clearImageSelection() {
  selectedImageFiles = [];
  pendingImageQuestion = "";
  fileInput.value = "";
}

function getSelectedColorFormatFromButton(button) {
  const config = colorFormatConfigByButtonId.get(button.id);
  return config?.id || button.textContent.trim().toLowerCase();
}

form.addEventListener("submit", submitUserPrompt);
resetButton.addEventListener("click", resetConversation);
uploadBtn.addEventListener("click", () => fileInput.click());
colorButtons.forEach((button) => button.addEventListener("click", handleColorCodeButtonClick));
fileInput?.addEventListener("change", onFilesSelected);
imagePaletteSlider?.addEventListener("input", handleImagePaletteSliderChange);
imagePaletteSlider?.addEventListener("change", handleImagePaletteSliderChange);

await api.initializeColorConfiguration();
const outputUiConfig = api.getOutputUiConfig();
colorFormatConfigByButtonId = new Map(
  Array.from(api.getColorFormatConfigs().values()).map((config) => [config.button_id, config]),
);
maxHistoryEntries = Number(outputUiConfig.history?.max_entries) || DEFAULT_MAX_HISTORY_ENTRIES;
maxOutputColors = Math.min(
  MAX_OUTPUT_COLORS_LIMIT,
  Math.max(1, Number(outputUiConfig.display?.max_colors) || MAX_OUTPUT_COLORS_LIMIT),
);
history.initHistory(maxHistoryEntries);
renderHistoryPalettes();
initCvdControl({ select: document.querySelector("#cvd-select"), target: colorHistory });
initContrastTool({ panel: document.querySelector("#contrast-panel") });
initCoolors({
  row: document.querySelector("#coolors-row"),
  generateBtn: document.querySelector("#cool-generate"),
  formatBtn: document.querySelector("#cool-format"),
  undoBtn: document.querySelector("#cool-undo"),
  redoBtn: document.querySelector("#cool-redo"),
  viewBtn: document.querySelector("#cool-view"),
  exportBtn: document.querySelector("#cool-export"),
});
await initModelPicker();

const storedPaletteEntries = imagePalette.loadImagePaletteFromStorage();
if (storedPaletteEntries.length > 0) {
  imagePalette.setImagePaletteEntries(storedPaletteEntries);
}
// Rendert bei leerem Panel die Idle-Scrollbar.
imagePalette.renderImagePalettePanel();

function onFilesSelected() {
  const files = Array.from(fileInput.files || []);
  if (files.length === 0) {
    clearImageSelection();
    return imagePalette.clearImagePalettePanel();
  }

  const validFiles = files.filter((file) => ALLOWED_IMAGE_MIME_TYPES.has(file.type));
  const invalidFiles = files.filter((file) => !ALLOWED_IMAGE_MIME_TYPES.has(file.type));
  invalidFiles.forEach((file) => alert(`Datei "${file.name}" ist kein erlaubtes Bildformat!`));
  if (validFiles.length > IMAGE_PALETTE_MAX_IMAGES)
    alert(`Max ${IMAGE_PALETTE_MAX_IMAGES} Bilder erlaubt; benutze die ersten.`);

  if (validFiles.length === 0) {
    clearImageSelection();
    input.value = "";
    return imagePalette.clearImagePalettePanel();
  }

  pendingImageQuestion = input.value.trim();
  selectedImageFiles = validFiles.slice(0, IMAGE_PALETTE_MAX_IMAGES);
  input.value = `Bilder bereit: ${selectedImageFiles.map((file) => file.name).join(", ")}`;
  setOutputMessage(
    `Bilder geladen. Klicke Senden, um Paletten zu generieren (${selectedImageFiles.length}/${IMAGE_PALETTE_MAX_IMAGES}).`,
  );

  imagePalette.clearImagePalettePanel();
  fileInput.value = "";
}

function createHistoryPaletteNode(item, index) {
  return ui.createPaletteContainer({
    format: item.format,
    colorEntries: item.colors,
    className: "palette-entry",
    name: item.name,
    showNames: true,
    // In-Place: Index bleibt gleich → nur diese eine Palette neu aufbauen.
    onReorder: (fromIndex, toIndex) => {
      history.reorderHistoryPaletteColor(index, fromIndex, toIndex);
      renderSingleHistoryPalette(index);
    },
    onAdjust: (newHexColors) => {
      const colors = newHexColors.map((hex) => ({
        hexColor: hex,
        code: ui.formatColorCode(hex, item.format) || hex,
      }));
      history.setHistoryPaletteColors(index, colors);
      renderSingleHistoryPalette(index);
    },
    onEditColor: (colorIndex, newHex) => {
      history.updateHistoryPaletteColor(
        index,
        colorIndex,
        newHex,
        ui.formatColorCode(newHex, item.format) || newHex,
      );
      renderSingleHistoryPalette(index);
    },
    onRename: (newName) => {
      history.renameHistoryPaletteByIndex(index, newName);
    },
    // Mockup-Vorschau: zeigt diese Palette in echten Layouts.
    onMockup: () => openMockupOverlay({ colorEntries: item.colors, name: item.name }),
    // Strukturell: Indizes verschieben sich → kompletter Neuaufbau.
    onDelete: () => {
      history.deleteHistoryPaletteByIndex(index);
      renderHistoryPalettes();
    },
    onConvert: (newFormat) => {
      if (newFormat === item.format) return;
      const colors = item.colors.map((entry) => ({
        hexColor: entry.hexColor,
        code: ui.formatColorCode(entry.hexColor, newFormat) || entry.hexColor,
      }));
      history.addHistoryPalette({
        format: newFormat,
        colors,
        name: `${item.name || "Palette"} · ${ui.getFormatLabel(newFormat)}`,
      });
      renderHistoryPalettes();
    },
  });
}

function renderHistoryPalettes() {
  colorHistory.textContent = "";
  const items = history.getPaletteHistoryItems();

  if (!items || items.length === 0) {
    const placeholder = document.createElement("div");
    placeholder.className = "palette-entry placeholder";
    placeholder.textContent =
      outputUiConfig.history?.placeholder_text || "Noch keine Farbcodierung ausgewählt.";
    colorHistory.append(placeholder);
    return;
  }

  items.forEach((item, index) => colorHistory.append(createHistoryPaletteNode(item, index)));
}

/* Eine einzelne Palette an ihrer Stelle ersetzen — für In-Place-Edits, damit
   nicht alle Paletten zerstört, neu gebaut und ihre Farbnamen neu geladen
   werden. Hat sich die Struktur unerwartet geändert, fällt es auf den vollen
   Neuaufbau zurück. */
function renderSingleHistoryPalette(index) {
  const item = history.getPaletteHistoryItems()[index];
  const existing = colorHistory.children[index];
  if (!item || !existing) return renderHistoryPalettes();
  existing.replaceWith(createHistoryPaletteNode(item, index));
}

function handleColorCodeButtonClick(event) {
  const button = event.currentTarget;
  const format = getSelectedColorFormatFromButton(button);
  const normalizedHex = ui.formatColorCode(button.dataset.color, "hex") || button.dataset.color;

  if (!normalizedHex) return displayError("Ungültiger Farbwert im Button.");

  clearSelectedColorState();
  selectedColorFormat = format;
  selectedColorHex = normalizedHex;
  button.classList.add("is-selected");
  document.documentElement.style.setProperty("--selected-format-color", button.dataset.color);
  setOutputMessage(
    `${ui.getFormatLabel(format)} ausgewählt. Beim Submit wird dieses Format angefordert.`,
  );
}

function handleImagePaletteSliderChange() {
  imagePalette.renderImagePalettePanel();
}

/* Modell-Toggle: lädt die verfügbaren Provider vom Server (kein Fallback mehr)
   und baut EINEN Cycle-Button — jeder Klick schaltet zum nächsten LLM weiter
   (OpenAI → GitHub Copilot → Ollama → …). Die Wahl geht mit jeder Anfrage mit. */
async function initModelPicker() {
  if (!modelPicker) return;
  let info;
  try {
    info = await api.fetchProviders();
  } catch (error) {
    console.warn("Provider konnten nicht geladen werden:", error);
    return;
  }

  const list = info?.providers || [];
  if (list.length === 0) return;

  let index = Math.max(
    0,
    list.findIndex((provider) => provider.name === (info.default || list[0].name)),
  );

  const button = document.createElement("button");
  button.type = "button";
  button.className = "model-btn model-cycle is-active";

  const render = () => {
    const provider = list[index];
    selectedProvider = provider.name;
    button.innerHTML = `<span class="model-cycle-icon" aria-hidden="true">⇄</span><span>${provider.label}</span>`;
    button.title = `Modell: ${provider.model} — klicken wechselt zum nächsten`;
    button.setAttribute(
      "aria-label",
      `KI-Modell: ${provider.label} (${provider.model}). Klicken wechselt zum nächsten LLM.`,
    );
  };

  button.addEventListener("click", () => {
    index = (index + 1) % list.length;
    render();
    const provider = list[index];
    setOutputMessage(`KI-Modell gewechselt: ${provider.label} · ${provider.model}`);
  });

  render();
  modelPicker.textContent = "";
  modelPicker.append(button);
}

async function resetConversation() {
  setOutputMessage("Konversation wird zurückgesetzt...");

  try {
    const response = await api.fetchApi("/api/chat/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const { ok, json } = await api.parseJsonResponseSafe(response, "Reset-API");
    if (!ok || !json.success) return displayError(json.error, "Reset fehlgeschlagen");

    input.value = "";
    clearSelectedColorState();
    clearImageSelection();
    history.setPaletteHistoryItems([]);
    imagePalette.clearImagePalettePanel();
    history.clearPaletteHistoryStorage();
    renderHistoryPalettes();
    setOutputMessage("Konversation zurückgesetzt.");
  } catch (error) {
    displayError(error);
  }
}

async function submitUserPrompt(event) {
  try {
    event.preventDefault();
    if (submitButton) submitButton.disabled = true;
    setOutputMessage("Thinking...");

    const prompt = input.value;
    const trimmedPrompt = prompt.trim();
    if (trimmedPrompt.startsWith("/")) {
      await handleSlash(prompt);
      return;
    }

    const hasPrompt = trimmedPrompt.length > 0;
    const hasImage = selectedImageFiles.length > 0;
    if (!hasPrompt && !hasImage) {
      setOutputMessage("Bitte gib einen Prompt ein.");
      return;
    }

    const requestTarget = await api.resolveRequestTarget({ hasPrompt, hasImage });
    const textPrompt = buildPromptWithColorMetadata(prompt, {
      format: selectedColorFormat,
      formatConfigs: api.getColorFormatConfigs(),
      maxColors: maxOutputColors,
    });
    const imageQuestion = pendingImageQuestion || undefined;
    input.value = "";

    if (requestTarget.endpoint === "/api/replicate/image-to-color") {
      if (selectedImageFiles.length === 0) {
        setOutputMessage("Bitte lade ein Bild hoch.");
        return;
      }

      const filesToProcess = selectedImageFiles;
      selectedImageFiles = [];
      pendingImageQuestion = "";

      setOutputMessage(
        `Generiere Paletten mit Replicate (${filesToProcess.length} Bild${filesToProcess.length > 1 ? "er" : ""})...`,
      );
      await imagePalette.updateImagePalettePanel(filesToProcess, imageQuestion);
      setOutputMessage("Paletten generiert. Mit dem Slider wird nun lokal per Chroma gemischt.");
      return;
    }

    console.log(`LLM: sende Prompt an ${requestTarget.endpoint}`, textPrompt);
    // Stoppuhr: Wall-Clock-Dauer der Anfrage (für „wie lange braucht ein Prompt").
    const promptStartedAt = Date.now();
    const response = await api.fetchApi(requestTarget.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: textPrompt }],
        provider: selectedProvider,
      }),
    });

    const { ok, json: responseJSON } = await api.parseJsonResponseSafe(response, "Chat-API");
    const elapsedSeconds = ((Date.now() - promptStartedAt) / 1000).toFixed(2);
    console.log(
      `⏱️ Antwort von ${responseJSON.provider || "?"} · Modell: ${responseJSON.model || "?"} · Dauer: ${elapsedSeconds}s`,
    );
    if (!ok) return displayError(responseJSON.error || `API-Fehler (HTTP ${response.status})`);
    if (responseJSON.error) return displayError(responseJSON.error);
    if (!responseJSON.choices || !responseJSON.choices[0]) {
      setOutputMessage(`Unexpected response: ${JSON.stringify(responseJSON)}`);
      return;
    }

    const text = responseJSON.choices[0].message.content;

    const historyFormat = selectedColorFormat || "hex";
    const neutralHexColors = extractNeutralHexColorsFromText(
      text,
      maxOutputColors,
      outputUiConfig.regex_patterns || {},
    );
    if (neutralHexColors.length > 0) {
      const colorEntries = neutralHexColors
        .map((hex) => ({ hexColor: hex, code: ui.formatColorCode(hex, historyFormat) || hex }))
        .filter(Boolean)
        .slice(0, maxOutputColors);

      if (colorEntries.length > 0) {
        // Palette landet nur in der History — der Output bleibt leer.
        const paddedEntries = padColorEntriesToCount(colorEntries, historyFormat, maxOutputColors);
        history.addHistoryPalette({ format: historyFormat, colors: paddedEntries });
        renderHistoryPalettes();
        output.textContent = "";
        return;
      }
    }

    if (selectedColorFormat && selectedColorHex) {
      const fallbackColorEntries = padColorEntriesToCount(
        [
          {
            hexColor: selectedColorHex,
            code: ui.formatColorCode(selectedColorHex, selectedColorFormat) || selectedColorHex,
          },
        ],
        selectedColorFormat,
        maxOutputColors,
      );
      history.addHistoryPalette({ format: selectedColorFormat, colors: fallbackColorEntries });
      renderHistoryPalettes();
      output.textContent = "";
      return;
    }

    await renderOutput(text, output);
  } catch (error) {
    displayError(error);
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

async function handleSlash(prompt) {
  const trimmed = prompt.trim();
  if (!trimmed.startsWith("/")) return false;

  const command = trimmed.split(/\s+/)[0];
  if (command === "/reset" || command === "/new") {
    await resetConversation();
    return true;
  }

  input.value = "";
  setOutputMessage("Error: Slash-Befehl unbekannt!");
  return true;
}

function displayError(error, fallback = "Unbekannter Fehler") {
  let message = fallback;

  if (error) {
    if (typeof error === "string") message = error;
    else if (typeof error.message === "string") message = error.message;
    else message = JSON.stringify(error);
  }

  console.log(`Error: ${message}`);
  if (output) setOutputMessage(`Error: ${message}`);
}
