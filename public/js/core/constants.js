export const DEFAULT_MAX_HISTORY_ENTRIES = 10;
export const MAX_OUTPUT_COLORS_LIMIT = 6;
export const IMAGE_PALETTE_MAX_IMAGES = 3;
export const PALETTE_HISTORY_STORAGE_KEY = "color-palettes-history-v1";
export const PALETTE_COUNTER_KEY = "color-palettes-counter-v1";
export const IMAGE_PALETTE_STORAGE_KEY = "image-palette-entries-v1";

export const API_BASE_CANDIDATES = [
  `http://${window.location.hostname}:8787`,
  "http://localhost:8787",
  `http://${window.location.hostname}:3000`,
  "http://localhost:3000",
  `http://${window.location.hostname}:3001`,
  "http://localhost:3001",
  `https://${window.location.hostname}:8787`,
  "https://localhost:8787",
  `https://${window.location.hostname}:3000`,
  "https://localhost:3000",
  `https://${window.location.hostname}:3001`,
  "https://localhost:3001",
];
