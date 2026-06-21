import path from "path";
import {
  initChat,
  chatWithAI,
  handleChat,
  handleResetChat,
  handleChatHealth,
  handleProviders,
} from "./server/chat.js";
import {
  handleReplicateImageToColor,
  handleReplicateStartPrediction,
  handleReplicatePredictionStatus,
} from "./server/replicate.js";
import { handleOptions, handleNotFound } from "./server/shared.js";

const promptArgIdx = Bun.argv.indexOf("-p");
const cliPrompt = promptArgIdx !== -1 ? Bun.argv[promptArgIdx + 1] : null;

const systemArgIdx = Bun.argv.indexOf("-s");
const cliSystemPrompt = systemArgIdx !== -1 ? Bun.argv[systemArgIdx + 1] : null;

// LLM-Auswahl für den CLI-Prompt: -m openai|copilot|ollama (Alias: --provider).
const providerArgIdx = Math.max(Bun.argv.indexOf("-m"), Bun.argv.indexOf("--provider"));
const cliProvider = providerArgIdx !== -1 ? Bun.argv[providerArgIdx + 1] : null;

const CLIENT_DIR = path.resolve(import.meta.dir, "public");

// OpenAI (Cloud) — null, wenn kein Key gesetzt ist.
function buildOpenAIConfig() {
  const key = process.env.OPENAI_API_KEY || process.env.OpenAI_API_KEY || "";
  if (!key) return null;
  return {
    name: "openai",
    apiKey: key,
    // Das OpenAI-SDK spricht den /v1-Pfad an; Basis ist api.openai.com.
    baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    timeout: 30000,
    defaultHeaders: undefined,
  };
}

// Copilot (Cloud, Kontingent) — null, wenn kein Key gesetzt ist.
function buildCopilotConfig() {
  const key = process.env.GITHUB_COPILOT_KEY || "";
  if (!key) return null;
  return {
    name: "copilot",
    apiKey: key,
    baseURL: "https://api.githubcopilot.com",
    model: process.env.GITHUB_COPILOT_MODEL || "gpt-4o",
    timeout: 20000, // schnell scheitern → schneller Fallback
    // Copilot verlangt diese Editor-Header (sonst 412 Precondition Failed).
    defaultHeaders: {
      "Editor-Version": process.env.COPILOT_EDITOR_VERSION || "vscode/1.95.0",
      "Editor-Plugin-Version": process.env.COPILOT_PLUGIN_VERSION || "copilot-chat/0.23.0",
      "Copilot-Integration-Id": process.env.COPILOT_INTEGRATION_ID || "vscode-chat",
    },
  };
}

// Ollama (lokal, OpenAI-kompatibel unter /v1) — kein Kontingent.
function buildOllamaConfig() {
  return {
    name: "ollama",
    apiKey: process.env.OLLAMA_API_KEY || "ollama", // von Ollama ignoriert, SDK braucht aber einen Wert
    baseURL: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
    model: process.env.OLLAMA_MODEL || "llama3.1",
    timeout: 150000, // lokales Modell darf langsamer sein
    defaultHeaders: undefined,
  };
}

// LLM_PROVIDER = bevorzugter Anbieter. Standard-Reihenfolge: OpenAI zuerst,
// danach Copilot, danach Ollama. Schlägt ein Provider zur Laufzeit fehl
// (z.B. 401/429 quota), wird automatisch der nächste in der Kette genutzt.
const builders = {
  openai: buildOpenAIConfig,
  copilot: buildCopilotConfig,
  ollama: buildOllamaConfig,
};
// Alle konfigurierten Provider (mit Key / lokal). Reihenfolge = Anzeige im
// Web-Toggle. KEIN automatischer Fallback mehr — der Nutzer wählt im UI.
const DEFAULT_ORDER = ["openai", "copilot", "ollama"];

// Bevorzugter Provider (Standardwahl im Toggle). Per LLM_PROVIDER setzbar.
const PREFERRED_PROVIDER = process.env.LLM_PROVIDER || DEFAULT_ORDER[0];

const APP_SERVER_PORT = Number(process.env.APP_SERVER_PORT || "8787");

// Spezialisierung des Agenten: Farb- & Paletten-Designer (SAEK Pigment).
// Per -s / cliSystemPrompt überschreibbar (z.B. für Subagenten mit anderer Rolle).
const DEFAULT_SYSTEM_PROMPT = [
  "Du bist „Pigment“, ein spezialisierter Farb- und Paletten-Designer für SAEK Pigment.",
  "Deine Spezialgebiete: Farbpaletten, Farbharmonien (analog, komplementär, triadisch),",
  "Kontrast & Barrierefreiheit (WCAG), Farbpsychologie und Design-Systeme.",
  "Antworte präzise, freundlich und verspielt (Sprache: de-ch, Du-Form).",
  "Wenn nach Farben gefragt wird, schlage konkrete, harmonische Paletten vor und begründe die Farbwahl kurz.",
].join(" ");
const SYSTEM_PROMPT = cliSystemPrompt || DEFAULT_SYSTEM_PROMPT;

// Konfigurierte Provider in Anzeige-Reihenfolge aufbauen; null-Einträge
// (kein Key) werden in initChat herausgefiltert.
const providerConfigs = DEFAULT_ORDER.map((name) => builders[name]());

if (!providerConfigs.some(Boolean)) {
  throw new Error(
    "Kein LLM-Provider konfiguriert. Setze z.B. OPENAI_API_KEY oder starte Ollama (OLLAMA_BASE_URL).",
  );
}

initChat({
  providers: providerConfigs,
  defaultProvider: PREFERRED_PROVIDER,
  systemPrompt: SYSTEM_PROMPT,
});

async function handleStaticFiles(req) {
  const url = new URL(req.url);
  const fileName = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.resolve(CLIENT_DIR, "." + fileName);
  if (!filePath.startsWith(CLIENT_DIR)) return new Response("Forbidden", { status: 403 });
  const file = Bun.file(filePath);
  if (await file.exists()) return new Response(file);
  return new Response("404 – Not Found", { status: 404, headers: { "Content-Type": "text/html" } });
}

if (cliPrompt) {
  try {
    const { content } = await chatWithAI(cliPrompt, cliProvider);
    console.log(content);
    process.exit(0);
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
} else {
  Bun.serve({
    port: APP_SERVER_PORT,
    idleTimeout: 120,
    routes: {
      "/api/chat": { GET: handleChatHealth, POST: handleChat, OPTIONS: handleOptions },
      "/api/chat/reset": { POST: handleResetChat, OPTIONS: handleOptions },
      "/api/providers": { GET: handleProviders, OPTIONS: handleOptions },
      "/api/replicate/image-to-color": {
        POST: handleReplicateImageToColor,
        OPTIONS: handleOptions,
      },
      "/api/replicate/predictions": {
        POST: handleReplicateStartPrediction,
        OPTIONS: handleOptions,
      },
      "/api/replicate/predictions/:id": {
        GET: handleReplicatePredictionStatus,
        OPTIONS: handleOptions,
      },
      "/api/*": handleNotFound,
      "/*": { GET: handleStaticFiles },
    },
  });

  const configured = providerConfigs
    .filter(Boolean)
    .map((p) => p.name)
    .join(", ");
  console.log(`Server running at http://localhost:${APP_SERVER_PORT}`);
  console.log(`Provider: ${configured} (Standard: ${PREFERRED_PROVIDER})`);
}
