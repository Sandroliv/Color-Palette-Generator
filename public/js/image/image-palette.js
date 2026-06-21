import chroma from "https://cdn.jsdelivr.net/npm/chroma-js@3.1.2/+esm";
import { rgbToHex } from "../core/utils.js";
import {
  IMAGE_PALETTE_MAX_IMAGES,
  MAX_OUTPUT_COLORS_LIMIT,
  IMAGE_PALETTE_STORAGE_KEY,
} from "../core/constants.js";
import { ensurePaletteLength, parsePaletteFromReplicateOutput } from "./image-palette-parse.js";
import * as api from "../core/api.js";

const REPLICATE_POLL_INTERVAL_MS = 500;
const REPLICATE_CLIENT_TIMEOUT_MS = 120000;

// Anweisung an das Bild-Modell: ausschließlich 6 Hex-Codes zurückgeben.
const PALETTE_INSTRUCTION =
  "Identify 6 dominant hex colors from the image. Respond ONLY with hex codes in this format: #RRGGBB #RRGGBB #RRGGBB #RRGGBB #RRGGBB #RRGGBB. Use uppercase. No other text.";

let imagePaletteEntries = [];
const imagePaletteCache = new Map();
const imagePaletteInFlight = new Map();
let imagePaletteRequestId = 0;
const imagePaletteDom = {
  panel: null,
  stage: null,
  list: null,
  slider: null,
};

function getImagePaletteDom() {
  if (!imagePaletteDom.stage) {
    imagePaletteDom.panel = document.querySelector("#image-palette-panel");
    imagePaletteDom.stage = document.querySelector("#image-palette-stage");
    imagePaletteDom.list = document.querySelector("#image-palette-list");
    imagePaletteDom.slider = document.querySelector("#image-palette-slider");
  }

  return imagePaletteDom;
}

function clientDelay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* Bild-Panel nur einblenden, wenn es etwas zu zeigen gibt;
   sonst nimmt die History-Palette das ganze Panel ein. */
function setImagePanelActive(active) {
  const container = document.querySelector(".palette-container");
  if (container) container.classList.toggle("has-image-palette", active);
}

function compressDataUrlForStorage(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 300;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.75));
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

async function saveImagePaletteToStorage(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    try {
      localStorage.removeItem(IMAGE_PALETTE_STORAGE_KEY);
    } catch {}
    return;
  }
  try {
    const toStore = (
      await Promise.all(
        entries.map(async (entry) => {
          const dataUrl = await compressDataUrlForStorage(entry.dataUrl);
          if (!dataUrl) return null;
          return {
            fileName: entry.fileName,
            dataUrl,
            palette: entry.palette,
            source: entry.source,
          };
        }),
      )
    ).filter(Boolean);
    localStorage.setItem(IMAGE_PALETTE_STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    /* quota exceeded – ignore */
  }
}

export function loadImagePaletteFromStorage() {
  try {
    const raw = localStorage.getItem(IMAGE_PALETTE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e) =>
        e &&
        typeof e.fileName === "string" &&
        typeof e.dataUrl === "string" &&
        Array.isArray(e.palette) &&
        e.palette.length > 0,
    );
  } catch {
    return [];
  }
}

export function setImagePaletteEntries(entries) {
  imagePaletteEntries = Array.isArray(entries) ? entries.slice(0, IMAGE_PALETTE_MAX_IMAGES) : [];
}

async function fetchReplicatePalette(imageUrl, question) {
  console.log(
    "Bild-AI (Replicate): sende Bild an /api/replicate/image-to-color",
    question ? `Frage: ${question}` : "",
  );
  const startResponse = await api.fetchApi("/api/replicate/image-to-color", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: imageUrl, question }),
  });

  if (!startResponse.ok) {
    const errorBody = await startResponse.json().catch(() => ({}));
    throw new Error(errorBody.details || errorBody.error || startResponse.statusText);
  }

  const startData = await startResponse.json();

  // Fast path: server completed the prediction in its quick 1s check
  if (startData.output) return startData.output;

  // Server handed off the pending prediction – poll from the client
  if (!startData.pending || !startData.id) {
    throw new Error(startData.error || "Unexpected response from image-to-color endpoint");
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < REPLICATE_CLIENT_TIMEOUT_MS) {
    await clientDelay(REPLICATE_POLL_INTERVAL_MS);

    const statusResponse = await api.fetchApi(`/api/replicate/predictions/${startData.id}`);
    if (!statusResponse.ok) continue;

    const prediction = await statusResponse.json();

    if (prediction.output) return prediction.output;
    if (prediction.status === "succeeded") return prediction.output ?? null;
    if (prediction.status === "failed" || prediction.status === "canceled") {
      throw new Error(prediction.error || `Prediction ${prediction.status}`);
    }
  }

  throw new Error("Replicate prediction timed out after 120 seconds");
}

function getImageCacheKey(file) {
  if (!file) return "";
  return [file.name || "", file.size || 0, file.type || "", file.lastModified || 0].join("::");
}

function createLoader() {
  const container = document.createElement("div");
  container.className = "loader-container";
  const loader = document.createElement("div");
  loader.className = "loader";
  for (let i = 0; i < 6; i++) {
    const dot = document.createElement("div");
    dot.className = "loader--dot";
    loader.append(dot);
  }
  const text = document.createElement("div");
  text.className = "loader--text";
  loader.append(text);
  container.append(loader);
  return container;
}

/* Idle state: an endlessly scrolling bar instead of a
   loader (nothing is actually loading while idle). */
function createIdleMarquee() {
  const container = document.createElement("div");
  container.className = "image-marquee";
  container.setAttribute("aria-label", "Bilder hochladen, um Paletten zu extrahieren");

  const track = document.createElement("div");
  track.className = "image-marquee-track";
  track.setAttribute("aria-hidden", "true");

  // Two identical halves → seamless -50% loop.
  const phrase = "Bilder hochladen · 색 추출 · Palette extrahieren · ";
  for (let i = 0; i < 2; i++) {
    const half = document.createElement("span");
    half.className = "image-marquee-half";
    half.textContent = phrase.repeat(3);
    track.append(half);
  }

  container.append(track);
  return container;
}

function createImageThumbnail(entry, index) {
  const thumb = document.createElement("button");
  thumb.type = "button";
  thumb.className = "image-palette-thumb";
  thumb.dataset.index = String(index);
  thumb.title = entry.fileName;
  thumb.setAttribute("aria-label", `Bild ${index + 1}: ${entry.fileName}`);

  const image = document.createElement("img");
  image.src = entry.dataUrl;
  image.alt = entry.fileName;
  image.loading = "lazy";

  const label = document.createElement("span");
  label.className = "image-palette-thumb-label";
  label.textContent = entry.fileName;

  thumb.append(image, label);
  return thumb;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Bild konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Bild konnte nicht geladen werden."));
    image.src = dataUrl;
  });
}

async function extractPaletteLocally(dataUrl, limit = 6) {
  const image = await loadImageFromDataUrl(dataUrl);
  const maxDimension = 72;
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return [];
  context.drawImage(image, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height).data;
  const buckets = new Map();

  for (let index = 0; index < imageData.length; index += 16) {
    const alpha = imageData[index + 3];
    if (alpha < 64) continue;
    const r = imageData[index];
    const g = imageData[index + 1];
    const b = imageData[index + 2];
    const key = `${r >> 3},${g >> 3},${b >> 3}`;
    const bucket = buckets.get(key) || { r: 0, g: 0, b: 0, count: 0 };
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  return [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((bucket) =>
      rgbToHex({
        r: bucket.r / bucket.count,
        g: bucket.g / bucket.count,
        b: bucket.b / bucket.count,
      }),
    );
}

async function loadImagePaletteEntry(file, question) {
  const cacheKey = getImageCacheKey(file);
  if (cacheKey && imagePaletteCache.has(cacheKey)) {
    const cached = imagePaletteCache.get(cacheKey);
    return {
      fileName: file.name,
      dataUrl: cached.dataUrl,
      palette: cached.palette.slice(),
      source: cached.source,
    };
  }

  if (cacheKey && imagePaletteInFlight.has(cacheKey)) {
    const pending = await imagePaletteInFlight.get(cacheKey);
    return {
      fileName: file.name,
      dataUrl: pending.dataUrl,
      palette: pending.palette.slice(),
      source: pending.source,
    };
  }

  const loadPromise = (async () => {
    const dataUrl = await fileToDataUrl(file);
    const trimmedQuestion = typeof question === "string" ? question.trim() : "";
    const promptText = trimmedQuestion
      ? `${trimmedQuestion}\n\n${PALETTE_INSTRUCTION}`
      : PALETTE_INSTRUCTION;

    const rawOutput = await fetchReplicatePalette(dataUrl, promptText);
    const replicatePalette = parsePaletteFromReplicateOutput(rawOutput, MAX_OUTPUT_COLORS_LIMIT);
    return { fileName: file.name, dataUrl, palette: replicatePalette, source: "replicate" };
  })();

  if (cacheKey) imagePaletteInFlight.set(cacheKey, loadPromise);

  try {
    const entry = await loadPromise;
    if (cacheKey) {
      imagePaletteCache.set(cacheKey, {
        dataUrl: entry.dataUrl,
        palette: entry.palette.slice(),
        source: entry.source,
      });
    }
    return entry;
  } finally {
    if (cacheKey) imagePaletteInFlight.delete(cacheKey);
  }
}

export function clearImagePalettePanel() {
  imagePaletteEntries = [];
  imagePaletteRequestId += 1;
  try {
    localStorage.removeItem(IMAGE_PALETTE_STORAGE_KEY);
  } catch {}
  renderImagePalettePanel();
}

function getBlendedPaletteAtPosition(entries, position) {
  if (!Array.isArray(entries) || entries.length === 0) return [];
  if (entries.length === 1) return entries[0].palette;

  const maxPosition = entries.length - 1;
  const boundedPosition = Math.max(0, Math.min(maxPosition, position));
  const leftIndex = Math.floor(boundedPosition);
  const rightIndex = Math.min(leftIndex + 1, maxPosition);
  const blendAmount = boundedPosition - leftIndex;
  if (leftIndex === rightIndex) return entries[leftIndex].palette;

  const leftPalette = entries[leftIndex].palette || [];
  const rightPalette = entries[rightIndex].palette || [];
  const maxCount = Math.max(leftPalette.length, rightPalette.length, MAX_OUTPUT_COLORS_LIMIT);
  const blended = [];

  for (let index = 0; index < maxCount; index += 1) {
    const leftHex =
      leftPalette[index] || leftPalette[leftPalette.length - 1] || rightPalette[0] || "#000000";
    const rightHex =
      rightPalette[index] || rightPalette[rightPalette.length - 1] || leftPalette[0] || "#000000";
    const mixedHex = chroma.mix(leftHex, rightHex, blendAmount, "lab").hex().toUpperCase();
    blended.push(mixedHex);
  }

  return blended.slice(0, MAX_OUTPUT_COLORS_LIMIT);
}

export function renderImagePalettePanel() {
  const {
    panel: imagePalettePanel,
    stage: imagePaletteStage,
    list: imagePaletteList,
    slider: imagePaletteSlider,
  } = getImagePaletteDom();

  if (!imagePalettePanel || !imagePaletteStage || !imagePaletteList || !imagePaletteSlider) return;

  setImagePanelActive(imagePaletteEntries.length > 0);

  imagePaletteStage.textContent = "";
  imagePaletteList.textContent = "";

  if (imagePaletteEntries.length === 0) {
    imagePaletteSlider.disabled = true;
    imagePaletteSlider.min = "0";
    imagePaletteSlider.max = "0";
    imagePaletteSlider.value = "0";
    imagePaletteStage.append(createIdleMarquee());
    const palettePlaceholder = document.createElement("div");
    palettePlaceholder.className = "image-palette-placeholder";
    palettePlaceholder.textContent = "Die Farbpalette erscheint unter dem Slider.";
    imagePaletteList.append(palettePlaceholder);
    return;
  }

  const maxPosition = Math.max(0, imagePaletteEntries.length - 1);
  imagePaletteSlider.disabled = maxPosition === 0;
  imagePaletteSlider.min = "0";
  imagePaletteSlider.max = String(maxPosition);
  imagePaletteSlider.step = maxPosition === 0 ? "1" : "0.01";

  const currentPosition = Number.parseFloat(imagePaletteSlider.value || "0");
  const safePosition = Number.isFinite(currentPosition)
    ? Math.max(0, Math.min(maxPosition, currentPosition))
    : 0;
  const leftIndex = Math.floor(safePosition);
  const rightIndex = Math.min(leftIndex + 1, maxPosition);
  const blendAmount = safePosition - leftIndex;

  imagePaletteSlider.value = String(safePosition);

  const thumbsRow = document.createElement("div");
  thumbsRow.className = "image-palette-thumbs";
  for (const [index, entry] of imagePaletteEntries.entries()) {
    const thumb = createImageThumbnail(entry, index);
    if (index === leftIndex || index === rightIndex) thumb.classList.add("is-active");
    thumbsRow.append(thumb);
  }
  imagePaletteStage.append(thumbsRow);

  const previewPalette = getBlendedPaletteAtPosition(imagePaletteEntries, safePosition);
  const previewEntry = document.createElement("div");
  previewEntry.className = "multi-color-output image-palette-preview";

  const title = document.createElement("div");
  title.className = "palette-title";
  title.textContent =
    imagePaletteEntries.length === 1
      ? imagePaletteEntries[0].fileName
      : `${imagePaletteEntries[leftIndex].fileName} ↔ ${imagePaletteEntries[rightIndex].fileName} (${blendAmount.toFixed(2)})`;

  const swatchRow = document.createElement("div");
  swatchRow.className = "palette-swatch-row";
  for (const hex of previewPalette) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "palette-swatch";
    btn.style.backgroundColor = hex;
    btn.dataset.code = hex;
    swatchRow.append(btn);
  }
  previewEntry.append(title, swatchRow);
  imagePaletteList.append(previewEntry);
}

export async function updateImagePalettePanel(files, question) {
  const {
    stage: imagePaletteStage,
    list: imagePaletteList,
    slider: imagePaletteSlider,
  } = getImagePaletteDom();
  if (!imagePaletteStage || !imagePaletteList) return;

  const selectedFiles = Array.isArray(files) ? files.slice(0, IMAGE_PALETTE_MAX_IMAGES) : [];
  if (selectedFiles.length === 0) {
    clearImagePalettePanel();
    return;
  }

  const requestId = ++imagePaletteRequestId;

  setImagePanelActive(true); // Panel schon während des Ladens zeigen.
  imagePaletteStage.textContent = "";
  imagePaletteStage.append(createLoader());
  imagePaletteList.textContent = "";

  // Lokale Palette aus dem Bild selbst — Fallback, wenn Replicate leer ausfällt
  // oder ganz fehlschlägt.
  const buildLocalEntry = async (file, dataUrl) => {
    const url = dataUrl || (await fileToDataUrl(file));
    const localPalette = ensurePaletteLength(
      await extractPaletteLocally(url, MAX_OUTPUT_COLORS_LIMIT),
      [],
      MAX_OUTPUT_COLORS_LIMIT,
    );
    return { fileName: file.name, dataUrl: url, palette: localPalette, source: "local" };
  };

  // Fetch each image's Replicate palette and only update UI when API responds
  const entries = [];
  for (const [idx, file] of selectedFiles.entries()) {
    try {
      const entry = await loadImagePaletteEntry(file, question);
      if (requestId !== imagePaletteRequestId) return;
      entries[idx] =
        Array.isArray(entry.palette) && entry.palette.length > 0
          ? entry
          : await buildLocalEntry(file, entry.dataUrl);
    } catch {
      // Replicate fehlgeschlagen → rein lokal versuchen; scheitert auch das, Datei überspringen.
      try {
        entries[idx] = await buildLocalEntry(file);
      } catch {
        /* beide Quellen fehlgeschlagen – Datei auslassen */
      }
    }

    // Update UI as each image completes
    if (requestId !== imagePaletteRequestId) return;
    imagePaletteEntries = entries.filter(
      (e) => e && Array.isArray(e.palette) && e.palette.length > 0,
    );
    if (imagePaletteSlider) imagePaletteSlider.value = "0";
    renderImagePalettePanel();
    saveImagePaletteToStorage(imagePaletteEntries);
  }
}
