import OpenAI from "openai";
import { tools } from "../tools/index.js";
import { jsonResponse, readJsonBody } from "./shared.js";

const AGENT_DEPTH = parseInt(process.env.AGENT_DEPTH || "0", 10);
const LOG_INDENT = "  ".repeat(AGENT_DEPTH);

// Lesbare Anzeigenamen für die Logs / die Antwort an den Client.
const PROVIDER_LABELS = {
  openai: "OpenAI",
  copilot: "GitHub Copilot",
  ollama: "Ollama",
};
const providerLabel = (name) => PROVIDER_LABELS[name] || name;

// Auswählbare Provider: name -> { name, label, model, client }. KEIN Fallback —
// der Client wählt den Provider per Toggle, Fehler werden direkt gemeldet.
let providers = new Map();
let defaultProvider = null;
let lastUsed = null; // { provider, model } — zuletzt erfolgreich genutzt
let SYSTEM_PROMPT;
let conversation = [];

// Gespräch deckeln, sonst wächst es unbegrenzt und wird jede Anfrage
// komplett mitgeschickt (steigende Latenz + Token-Kosten).
const MAX_CONVERSATION_MESSAGES = Number(process.env.MAX_CONVERSATION_MESSAGES || "24");

function trimConversation() {
  if (conversation.length <= MAX_CONVERSATION_MESSAGES) return;
  conversation = conversation.slice(-MAX_CONVERSATION_MESSAGES);
  // Ein führendes tool-Result ohne sein assistant(tool_calls) wäre ungültig.
  while (conversation[0]?.role === "tool") conversation.shift();
}

function makeClient({ apiKey, baseURL, defaultHeaders, timeout }) {
  // maxRetries: 0 — sonst wiederholt der SDK 429-Fehler und respektiert dabei
  // Copilots „retry-after" (~14 Tage), was den Fallback ewig blockiert.
  return new OpenAI({
    apiKey,
    baseURL,
    maxRetries: 0,
    ...(timeout ? { timeout } : {}),
    ...(defaultHeaders ? { defaultHeaders } : {}),
  });
}

export function initChat({ providers: configs, defaultProvider: preferred, systemPrompt }) {
  providers = new Map(
    (configs || []).filter(Boolean).map((p) => [
      p.name,
      {
        name: p.name,
        label: providerLabel(p.name),
        model: p.model,
        client: makeClient(p),
      },
    ]),
  );
  defaultProvider = providers.has(preferred) ? preferred : [...providers.keys()][0] || null;
  SYSTEM_PROMPT = systemPrompt;
}

// Liste für die UI (Toggle): verfügbare Provider + Standardwahl.
export function listProviders() {
  return {
    default: defaultProvider,
    providers: [...providers.values()].map(({ name, label, model }) => ({ name, label, model })),
  };
}

function resolveProvider(name) {
  return providers.get(name) || providers.get(defaultProvider) || null;
}

/* Genau den gewählten Provider nutzen — KEIN automatischer Fallback.
   Schlägt er fehl (401/429/412 …), wird der Fehler an den Client gemeldet,
   der dann per Toggle einen anderen Provider wählen kann. */
async function createChatCompletion(messages, providerName) {
  const provider = resolveProvider(providerName);
  if (!provider) throw new Error("Kein LLM-Provider verfügbar");

  console.error(`${LOG_INDENT}🤖 LLM: ${provider.label} · Modell: ${provider.model}`);
  const response = await provider.client.chat.completions.create({
    model: provider.model,
    messages,
    tools,
    stream: false,
  });
  lastUsed = { provider: provider.label, model: provider.model };
  return response;
}

function extractAssistantMessage(responseJSON) {
  const choices = responseJSON.choices || [];
  let content = "";
  let toolCalls = [];

  for (const choice of choices) {
    const msg = choice.message;
    if (!msg) continue;
    if (msg.content) content += (content ? "\n" : "") + msg.content;
    if (msg.tool_calls?.length > 0) toolCalls.push(...msg.tool_calls);
  }

  return { content, toolCalls };
}

function toolSummary(name, input) {
  const truncate = (s, n = 80) => (s && s.length > n ? s.slice(0, n) + "…" : s);
  switch (name) {
    case "read_file":
    case "list_files":
    case "edit_file":
    case "play_mp3":
      return input.path || ".";
    case "bash":
      return truncate(input.command);
    case "code_search":
      return `pattern:"${truncate(input.pattern, 60)}"${input.path ? ` path:${input.path}` : ""}`;
    case "subagent":
      return truncate(input.prompt);
    default:
      return "";
  }
}

async function executeToolCalls(toolCalls) {
  const subagentCalls = toolCalls.filter((tc) => tc.function.name === "subagent");
  const otherCalls = toolCalls.filter((tc) => tc.function.name !== "subagent");

  const executeOne = async (toolCall) => {
    const toolName = toolCall.function.name;
    const toolInput = JSON.parse(toolCall.function.arguments);
    const summary = toolSummary(toolName, toolInput);
    console.error(`${LOG_INDENT}🔧 ${toolName}${summary ? ` — ${summary}` : ""}`);
    const tool = tools.find((t) => t.function.name === toolName);

    let content;
    if (tool) {
      try {
        content = await tool.execute(toolInput);
      } catch (err) {
        content = `Error: ${err.message}`;
      }
    } else {
      content = `Error: tool '${toolName}' not found`;
    }

    return { role: "tool", tool_call_id: toolCall.id, content };
  };

  const results = [];
  for (const toolCall of otherCalls) {
    results.push(await executeOne(toolCall));
  }

  if (subagentCalls.length > 0) {
    const subagentResults = await Promise.all(subagentCalls.map(executeOne));
    results.push(...subagentResults);
  }

  return results;
}

export async function chatWithAI(userMessage, providerName) {
  conversation.push({ role: "user", content: userMessage });
  const buildMessages = () => [{ role: "system", content: SYSTEM_PROMPT }, ...conversation];

  let responseJSON = await createChatCompletion(buildMessages(), providerName);
  let extracted = extractAssistantMessage(responseJSON);

  while (extracted.toolCalls.length > 0) {
    conversation.push({
      role: "assistant",
      content: extracted.content || "",
      tool_calls: extracted.toolCalls,
    });

    const toolResults = await executeToolCalls(extracted.toolCalls);
    conversation.push(...toolResults);

    responseJSON = await createChatCompletion(buildMessages(), providerName);
    extracted = extractAssistantMessage(responseJSON);
  }

  conversation.push({ role: "assistant", content: extracted.content });
  trimConversation();
  return { content: extracted.content };
}

export function handleChatHealth() {
  return jsonResponse({ ok: true, endpoint: "/api/chat" });
}

export function handleProviders() {
  return jsonResponse(listProviders());
}

export function handleResetChat() {
  conversation = [];
  return jsonResponse({ success: true });
}

export async function handleChat(req) {
  const { body, error } = await readJsonBody(req);
  if (error) return error;

  const userMessage = body.message || body.messages?.[body.messages.length - 1]?.content;
  if (!userMessage) {
    return jsonResponse({ error: "No message provided" }, 400);
  }

  try {
    const { content } = await chatWithAI(userMessage, body.provider);
    // Nur das zurückgeben, was der Client wirklich liest (Provider, Modell, Text).
    return jsonResponse({
      provider: lastUsed?.provider,
      model: lastUsed?.model,
      choices: [{ finish_reason: "stop", message: { role: "assistant", content } }],
    });
  } catch (providerError) {
    const status = providerError?.status || 502;
    const details = providerError?.error || providerError?.message || String(providerError);
    return jsonResponse({ error: `LLM request failed with status ${status}`, details }, status);
  }
}
