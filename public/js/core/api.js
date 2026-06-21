import { API_BASE_CANDIDATES } from "./constants.js";

const COLOR_FORMAT_CONFIGS = [
  { id: "hex", label: "HEX", button_id: "btn-hex", request_target: "hex" },
  { id: "rgb", label: "RGB", button_id: "btn-rgb", request_target: "rgb" },
  { id: "hsv", label: "HSV", button_id: "btn-hsv", request_target: "hsv" },
  { id: "hsl", label: "HSL", button_id: "btn-hsl", request_target: "hsl" },
  { id: "cmyk", label: "CMYK", button_id: "btn-cmyk", request_target: "cmyk" },
  { id: "lch", label: "LCH", button_id: "btn-lch", request_target: "lch" },
];

const OUTPUT_UI_CONFIG = {
  history: {
    max_entries: 12,
    placeholder_text: "Noch keine Farbcodierung ausgewählt.",
  },
  display: {
    max_colors: 6,
  },
  regex_patterns: {
    neutral_token: "\\[\\s*COLOR_NEUTRAL\\s*:\\s*(#[0-9a-fA-F]{3,6})\\s*\\]",
    hex: "#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\\b",
    rgb: "rgb\\s*\\(\\s*([0-9]{1,3})\\s*,\\s*([0-9]{1,3})\\s*,\\s*([0-9]{1,3})\\s*\\)",
    hsl: "hsl\\s*\\(\\s*([-+]?[0-9]*\\.?[0-9]+)\\s*,\\s*([-+]?[0-9]*\\.?[0-9]+)%\\s*,\\s*([-+]?[0-9]*\\.?[0-9]+)%\\s*\\)",
    hsv: "hsv\\s*\\(\\s*([-+]?[0-9]*\\.?[0-9]+)\\s*,\\s*([-+]?[0-9]*\\.?[0-9]+)%\\s*,\\s*([-+]?[0-9]*\\.?[0-9]+)%\\s*\\)",
    cmyk: "cmyk\\s*\\(\\s*([-+]?[0-9]*\\.?[0-9]+)%\\s*,\\s*([-+]?[0-9]*\\.?[0-9]+)%\\s*,\\s*([-+]?[0-9]*\\.?[0-9]+)%\\s*,\\s*([-+]?[0-9]*\\.?[0-9]+)%\\s*\\)",
  },
};

const colorFormatConfigs = new Map();
let apiBaseResolvePromise;

export function getColorFormatConfigs() {
  return colorFormatConfigs;
}

// Anzeigename einer Farbcodierung (z.B. "HEX"); Fallback = Großschreibung der ID.
export function getFormatLabel(formatId) {
  return colorFormatConfigs.get(formatId)?.label || String(formatId).toUpperCase();
}

export function getOutputUiConfig() {
  return OUTPUT_UI_CONFIG;
}

export function initializeColorConfiguration() {
  COLOR_FORMAT_CONFIGS.forEach((config) => colorFormatConfigs.set(config.id, config));
}

export function resolveRequestTarget({ hasImage }) {
  if (hasImage) return { endpoint: "/api/replicate/image-to-color" };
  return { endpoint: "/api/chat" };
}

async function resolveApiBaseUrl() {
  if (!apiBaseResolvePromise) {
    apiBaseResolvePromise = (async () => {
      for (const baseUrl of new Set(API_BASE_CANDIDATES)) {
        try {
          const probeResponse = await fetch(`${baseUrl}/api/chat`, { method: "GET" });
          if (!(probeResponse.headers.get("content-type") || "").includes("application/json"))
            continue;
          if (typeof JSON.parse(await probeResponse.text()) === "object") return baseUrl;
        } catch {
          // ignore
        }
      }

      throw new Error(
        "Keine API gefunden. Starte den Bun-Server (bun run server.js). Hinweis: VS Code Live Preview belegt oft 3000/3001; nutze den Server auf Port 8787 oder setze APP_SERVER_PORT explizit.",
      );
    })().catch((error) => {
      // Fehlversuch nicht dauerhaft cachen: Wird der Server erst nach dem
      // Laden der Seite gestartet, soll der nächste Aufruf erneut suchen.
      apiBaseResolvePromise = null;
      throw error;
    });
  }

  return apiBaseResolvePromise;
}

export async function fetchApi(path, options) {
  const baseUrl = await resolveApiBaseUrl();
  return fetch(`${baseUrl}${path}`, options);
}

// Verfügbare LLM-Provider für den Modell-Toggle: { default, providers: [{name,label,model}] }.
export async function fetchProviders() {
  const response = await fetchApi("/api/providers", { method: "GET" });
  const { json } = await parseJsonResponseSafe(response, "Providers-API");
  return json;
}

export async function parseJsonResponseSafe(response, contextLabel = "API") {
  const contentType = response.headers.get("content-type") || "";
  const rawText = await response.text();

  if (!rawText) return { ok: response.ok, status: response.status, json: {} };

  if (!contentType.includes("application/json")) {
    const preview = rawText.slice(0, 140).replace(/\s+/g, " ").trim();
    throw new Error(
      `${contextLabel} antwortet nicht als JSON (Status ${response.status}). Antwort beginnt mit: ${preview}`,
    );
  }

  try {
    const parsed = JSON.parse(rawText);
    return { ok: response.ok, status: response.status, json: parsed };
  } catch {
    throw new Error(`${contextLabel} hat ungültiges JSON geliefert (Status ${response.status}).`);
  }
}
