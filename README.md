# Color Palette AI Agent
Sandro Fankhauser - Digital Ideation focus computer science

**FS26 - DEWEB**

**Kurzbeschrieb:** Ein spezialisierter KI-Agent rund um Farben: er schlägt harmonische Paletten und Farbcodes vor. Dazu kommen CLI-Tools, Bildanalyse und lokale Design-Helfer wie Kontrast, Mockup und Farbblindheit.

> This project covers two modules at once, [COMPP](#compp-module) and [DEWEB](#deweb-module). The overview further down shows which part belongs where.
>
> Screenshots are in the project documentation, see [dokument.md](dokument.md#abgegebene-bilder).

---

## Module Overview for Lecturers

| Module | Focus | Key Files |
|--------|-------|-----------|
| **COMPP** | Image → Color Palette Generator (ML-powered) | `public/js/image/image-palette.js`, `server/replicate.js`, `public/js/color/color-parser.js` |
| **DEWEB** | Specialized AI Agent with color palettes & local design tools | `server.js`, `server/chat.js`, `tools/`, `public/js/main.js`, `public/styles/` |

Both modules live in the same codebase and run as one Bun web app. The COMPP part, image upload to palette extraction, simply shows up as a panel inside the DEWEB agent.

When you hit submit, the app looks at what you gave it: plain text goes to the LLM chat, an image goes to Replicate. From there it lands at the matching API.

---

## COMPP Module

**Image to Color Palette Generator.** Drop in one or more images and a machine learning model (Replicate API) pulls a harmonious palette out of them. Those colors then flow straight into the chat agent and the local design tools.

See [WIKI.md](WIKI.md#compp-module) for full documentation.

---

## DEWEB Module

### Projektbeschrieb

I did not want to build yet another general purpose chatbot, but an agent that is genuinely good at one thing: colors. It knows color theory and color encoding, suggests harmonious palettes and hands you the matching codes right away. All of it lives inside a playful interface that is meant to be fun rather than feel like a tool. Whoever uses the agent picks which language model answers: OpenAI or GitHub Copilot from the cloud, or Ollama running locally on your own machine. If one of them fails, nothing quietly takes over, so you see the error straight away. Under the hood the agent has five built in tools plus one of its own, so it can read files, search through the project and even send off several subagents at once. Around the chat sit small helpers that run without any model: a Coolors style randomizer, a WCAG contrast check, a mockup preview and a color blindness simulation. Sounds and animations round it all off.

### Local Design Tools

These all run right in the browser, no language model involved:

- **Color-format buttons** 
HEX · RGB · HSV · HSL · CMYK · LCH
- **Color randomizer**  
full-screen Coolors-style palette generator: spacebar/Generate reshuffles unlocked colors, per-column lock · drag-reorder · remove · copy, undo/redo, and a coloured **format toggle** that switches the displayed/copied coding through HEX · RGB · HSL · HSV · CMYK · LCH (`public/js/tools/coolors.js`)
- **History palette**
saved palettes with inline “Pigment” swatch editor, drag-reorder, PNG export and automatic color naming

- **Contrast check**
WCAG contrast rating between two colors (`public/js/tools/contrast.js`)

- **Mockup preview** 
shows any palette across 6 designed mockups (website in a browser · graphic editorial poster · mobile app in a phone frame · music player · gradient-mesh artwork · dashboard) with a role legend (which color sits where), a harmony label, and PNG export (`public/js/tools/mockup.js`, `public/js/color/color-roles.js`)
- **Color-blindness simulation**
CVD filter (protanopia · deuteranopia · tritanopia · achromatopsia) over the history palette that **also carries into the mockup preview and both PNG exports** when active (`public/js/tools/cvd.js`)
- **UI sounds** 
two Web-Audio cues: a hover click on swatches/columns and a swoosh when generating a palette (`public/js/audio/sound.js`)

See [WIKI.md](WIKI.md#deweb-module) for the full learning-objective checklist.

---

## LLM Providers (cloud + local, user-selectable)

You can choose between three providers right in the web UI, using the toggle button above the prompt. There is no automatic fallback, and that is on purpose: if a provider runs into an error, you see it directly instead of silently getting answers from somewhere else.

| Provider | Type | Env key | Default model
|----------|------|---------|--------------|
| **OpenAI** | Cloud | `OPENAI_API_KEY` | `gpt-4o-mini` | 
| **GitHub Copilot** | Cloud | `GITHUB_COPILOT_KEY` | `gpt-4o` |
| **Ollama** | Local | `OLLAMA_BASE_URL` (no key) | `qwen3:8b` | 


A provider only shows up in the toggle once it is actually set up (its key is present; Ollama is always there). `GET /api/providers` lists what is available, and the default comes from `LLM_PROVIDER`, falling back to the first one it finds.

## Replicate API

COMPP uses this to look at uploaded images and pull palettes out of them. The colors it finds then feed into the design tools and the agent.

## Aufgabenbeschrieb / Methode / Ergebnis

- **Problem:** Farbentscheidungen kosten oft Zeit. Ich wollte eine schnelle Hilfe, die auch noch Spass macht und gut aussieht.
- **Methode:** Ein spezialisierter Chat-Agent, der Bilder analysiert, Farben herausliest und mit eigenen Tools sowie lokalen Helfern (Kontrast, Mockup, Farbblindheit) arbeitet.
- **Ergebnis:** Stimmige Paletten, die passenden Farbcodes und konkrete Designtipps, alles an einem Ort im Browser.

---

## Installation

```bash
git clone https://gitlab.switch.ch/hslu/edu/bachelor-in-digital-ideation/modul-deweb-f26/p08-ai-agent-with-subagents.git
cd p08-ai-agent-with-subagents
bun install
```

### Create `.env`

Create a `.env` file in the project root and set at least one LLM provider:

```bash
# --- LLM providers (set at least one cloud key, or use local Ollama) ---
OPENAI_API_KEY=sk-...            # OpenAI (default provider)
OPENAI_MODEL=gpt-4o-mini

GITHUB_COPILOT_KEY=gho_...        # GitHub Copilot OAuth token
GITHUB_COPILOT_MODEL=gpt-4o

OLLAMA_MODEL=qwen3:8b             # local Ollama (run `ollama serve`)
# OLLAMA_BASE_URL=http://localhost:11434/v1

LLM_PROVIDER=openai              # preferred default in the toggle

# --- COMPP image palettes ---
REPLICATE_API_TOKEN=r8_...
```

> `.env` holds real secrets and is gitignored. For a fully local setup, install [Ollama](https://ollama.com), `ollama pull qwen3:8b`, and set `LLM_PROVIDER=ollama`.

### Run

```bash
bun run server.js
```

Open [http://localhost:8787](http://localhost:8787) in your browser. The startup log prints the available providers and the default.

---

## CLI / Agent Mode

```bash
# Basic prompt (uses the default provider)
bun run server.js -p "Suggest a warm color palette for a bakery website"

# With custom system prompt
bun run server.js -p "..." -s "You are a strict minimalist designer."
```

### Subagent examples

```bash
# Parallel file analysis via subagents
bun run server.js -p "For each .js file in tools/, use a subagent to read and summarize it (max 3 sentences). Save all summaries to summary.md."

# Two subagents racing to solve the same problem differently
bun run server.js -p "Compare two solutions for Fibonacci up to 100: Subagent 1 solves it recursively (fib_recursive.js), Subagent 2 iteratively (fib_iterative.js). Run both and compare output."

# Specialized reviewers via different system prompts
bun run server.js -p "Review server.js with two subagents: Subagent 1 is a security reviewer, Subagent 2 is a clean-code reviewer. Summarize both."
```

---

## Credits / Third-Party Sources

- **Color naming:** the names come from the open source [meodai/color-name-api](https://github.com/meodai/color-name-api), through its public instance [api.color.pizza](https://api.color.pizza). It is wired up in [public/js/color/color-names.js](public/js/color/color-names.js), with a small local HSL fallback for when the API is down.
- **Contrast rating:** the WCAG pass and fail thresholds follow [bbc/color-contrast-checker](https://github.com/bbc/color-contrast-checker), implemented in [public/js/tools/contrast.js](public/js/tools/contrast.js).

## AI Declaration

See [WIKI.md — AI Declaration](WIKI.md#ai-declaration).
