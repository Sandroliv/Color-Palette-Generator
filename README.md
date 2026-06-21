# Color Palette AI Agent

**HSLU  Digital Ideation FS26 - DEWEB**

> This project spans **two modules**: [COMPP](#compp-module) and [DEWEB](#deweb-module). See the section below for a clear breakdown of what belongs to which module.

<img src="docs/img/01-randomizer.png" width="820" alt="Color randomizer — full-bleed palette generator with format toggle" />

---

## Screenshots

**AI agent**  prompt input, provider toggle, the six color-format buttons (HSV, RGB, HEX, CMYK, HSL, LCH) and the history palette with the color-blindness selector:

<img src="docs/img/03-agent.png" width="820" alt="AI agent chat with format buttons and history palette" />

**Mockup preview**  any palette shown across 6 designed layouts (website, poster, app, music player, gradient art, dashboard) with a harmony label:

<img src="docs/img/02-mockup.png" width="760" alt="Mockup preview overlay" />

---

## Module Overview for Lecturers

| Module | Focus | Key Files |
|--------|-------|-----------|
| **COMPP** | Image → Color Palette Generator (ML-powered) | `public/js/image/image-palette.js`, `server/replicate.js`, `public/js/color/color-parser.js` |
| **DEWEB** | Specialized AI Agent with color palettes & local design tools | `server.js`, `server/chat.js`, `tools/`, `public/js/main.js`, `public/styles/` |

Both modules share the same codebase and run as a single Bun web application. The COMPP feature (image upload → palette extraction) is embedded as a panel within the DEWEB agent interface.

On submit, the app first decides whether the input is a **text prompt** (→ LLM chat) or an **image prompt** (→ Replicate), then routes it to the matching API.

---

## COMPP Module

**Image to Color Palette Generator** — Upload one or more images and extract a harmonious color palette via a machine-learning model (Replicate API). The extracted colors feed the AI chat agent and the local design tools.

See [WIKI.md](WIKI.md#compp-module) for full documentation.

---

## DEWEB Module

**AI Color Palette Agent** — a specialized AI agent for color theory, color encoding and design palettes, with a playful web interface, CLI tools and subagent support. Around the agent sit several **local, no-LLM design tools**:

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

The agent supports **three** providers and lets the user pick one in the web UI via a **toggle / cycle button** above the prompt — there is **no automatic fallback**, so any provider error is shown directly.

| Provider | Type | Env key | Default model
|----------|------|---------|--------------|
| **OpenAI** | Cloud | `OPENAI_API_KEY` | `gpt-4o-mini` | 
| **GitHub Copilot** | Cloud | `GITHUB_COPILOT_KEY` | `gpt-4o` |
| **Ollama** | Local | `OLLAMA_BASE_URL` (no key) | `qwen3:8b` | 


A provider only appears in the toggle if it is configured (its key is set; Ollama always shows). `GET /api/providers` lists the available providers; the preferred default is `LLM_PROVIDER` (falls back to the first available).

## Replicate API

Used by COMPP to analyse uploaded images and extract palettes. The extracted colors then feed the design tools and the agent.

## Aufgabenbeschrieb / Methode / Ergebnis

- **Problem:** Eine schnelle, visuell ansprechende KI-Unterstützung für Farbentscheidungen bereitstellen.
- **Methode:** Spezialisierter Chat-Agent mit Bildanalyse, Farbextraktion, CLI-Tools und lokalen Design-Tools (Kontrast, Mockup, CVD).
- **Ergebnis:** Harmonische Farbpaletten, passende Farbcodes und klare Designempfehlungen in einem einzigen Web-Workflow.

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

- **Color naming** — uses the open-source [meodai/color-name-api](https://github.com/meodai/color-name-api) via its public instance [api.color.pizza](https://api.color.pizza). Integrated in [public/js/color/color-names.js](public/js/color/color-names.js) (with a local HSL fallback when the API is unavailable).
- **Contrast rating** — the WCAG pass/fail thresholds follow [bbc/color-contrast-checker](https://github.com/bbc/color-contrast-checker). Implemented in [public/js/tools/contrast.js](public/js/tools/contrast.js).

## AI Declaration

See [WIKI.md — AI Declaration](WIKI.md#ai-declaration).
