# Project Wiki — Color Palette AI Agent

**HSLU Bachelor Digital Ideation — Sandro Fankhauser**

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [COMPP Module](#compp-module)
3. [DEWEB Module](#deweb-module)
4. [Local Design Tools (no LLM)](#local-design-tools-no-llm)
5. [Architecture](#architecture)
6. [Third-Party Sources / Attribution](#third-party-sources--attribution)
7. [AI Declaration](#ai-declaration)

---

## Project Overview

This project is a **Color Palette AI Agent**, a web application combining two modules:

- **COMPP**: an image-to-palette extraction tool powered by a Replicate ML model
- **DEWEB**: a specialized AI chat agent for color theory and design, with CLI tools, subagent support, a polished animated interface, and several **local design tools** (contrast check, mockup preview, color-blindness simulation)

Both modules run on a single Bun-powered server and share one frontend.

<img src="docs/img/01-randomizer.png" width="820" alt="Color randomizer — the full-bleed palette generator (landing view)" />

---

## COMPP Module

### What it does

Users upload one to three images. The app sends them to the [Replicate](https://replicate.com) API, which runs a machine-learning model to extract dominant colors. The resulting palette is shown as swatches, cached in `localStorage`, and can be fed as color context to the AI chat agent.

### Key files

| File | Role |
|------|------|
| `public/js/image/image-palette.js` | Upload UI, Replicate polling loop, palette rendering, slider blending |
| `public/js/color/color-parser.js` | Extracts/normalizes colors (hex, rgb, hsl, hsv, cmyk) from text |
| `server/replicate.js` | Replicate API proxy (prediction start + status polling) |
| `public/assets/` | UI icons |

### How it works

1. User selects images via the upload button (`#fileInput`).
2. `image-palette.js` posts the image to **`POST /api/replicate/image-to-color`**.
3. `server/replicate.js` starts a Replicate prediction; if it doesn't finish in a short window it returns `{ pending, id }`.
4. The client polls **`GET /api/replicate/predictions/:id`** until the model finishes (500 ms interval, 120 s client timeout).
5. Extracted hex colors are rendered as swatches; the palette is cached in `localStorage` until **Reset**.
6. The slider blends locally between palettes using [chroma.js](https://gka.github.io/chroma.js/) for perceptually even mixing.

### Research notes

- Replicate predictions are asynchronous — a 500 ms poll with a 120 s timeout balances responsiveness against rate limits.
- Local blending via chroma.js is near-instant once the palettes exist.

### API selection

- First tried [yuni-eng/image-to-color](https://replicate.com/yuni-eng/image-to-color) (~11B params) — too expensive and slow (~3 min).
- Switched to [lucataco/ollama-llama3.2-vision-90b](https://replicate.com/lucataco/ollama-llama3.2-vision-90b) (~90B) — cheaper and faster (~1 min).

---

## DEWEB Module

<img src="docs/img/03-agent.png" width="820" alt="AI agent — prompt, provider toggle, color-format buttons and history palette" />

### Learning Objective Checklist

The DEWEB requirement is a **specialized AI agent with a fancy web harness**. Checklist against the official criteria:

#### Specialization

**Color Palette Assistant** — specialized in color theory, color-encoding codes, design palettes and color naming. Its system prompt constrains it to this domain and it integrates palette context (from COMPP or manual selection) into its prompts via `public/js/color/color-parser.js`. The prompt asks the model for a fixed number of `[COLOR_NEUTRAL:…]` tokens; the format example is deliberately a **neutral grey** (`#808080`) so the model is not anchored to a specific hue/lightness and instead derives theme-appropriate colors (e.g. *Spiderman* → deep, saturated red, not a generic light coral).

#### LLM Provider 

The requirement is a connection to Ollama (local) **or** GitHub Copilot (cloud). This project supports **both, plus OpenAI**, and lets the user choose one at runtime via a **cycle-button toggle** above the prompt. Any provider error is shown directly (no silent fallback).

| Provider | Type | Env key(s) | Base URL | Default model |
|----------|------|-----------|-----------|---------------|
| **OpenAI** | Cloud | `OPENAI_API_KEY`, `OPENAI_MODEL` | `https://api.openai.com/v1` | `gpt-4o-mini` |
| **GitHub Copilot** | Cloud | `GITHUB_COPILOT_KEY`, `GITHUB_COPILOT_MODEL` | `https://api.githubcopilot.com` | `gpt-4o` |
| **Ollama** | Local | `OLLAMA_MODEL`, `OLLAMA_BASE_URL` | `http://localhost:11434/v1` | `qwen3:8b` |

- `server.js` builds the list of **configured** providers (a cloud provider only appears if its key is set; Ollama always appears). `LLM_PROVIDER` chooses the default.
- `server/chat.js` keeps them in a `Map` and uses **exactly** the selected provider (`maxRetries: 0`).
- **`GET /api/providers`** returns `{ default, providers:[{name,label,model}] }`; the frontend builds the toggle from it and sends the chosen `provider` with each `POST /api/chat`.
- The server response is trimmed to only `{ provider, model, choices }`, and the conversation is capped (`MAX_CONVERSATION_MESSAGES`, default 24) to keep latency/token cost bounded.

#### CLI Tools (5 + 1)

| # | Tool | File | Description |
|---|------|------|-------------|
| 1 | `read_file` | `tools/read_file.js` | Read the contents of any file |
| 2 | `list_files` | `tools/list_files.js` | List files in a directory |
| 3 | `edit_file` | `tools/edit_file.js` | Create or edit files (includes write) |
| 4 | `code_search` | `tools/code-search.js` | Search for patterns in files (ripgrep) |
| 5 | `bash` | `tools/bash.js` | Execute arbitrary shell commands |
| +1 | `play_mp3` | `tools/play_mp3.js` | **Custom tool** — play an MP3 via `mpg123` |
| bonus | `subagent` | `tools/subagent.js` | Spawn sub-agents with isolated context / custom system prompts |

Tools are toggled in `tools/config.json` (set a name to `false` to disable). A safety guard (`tools/blocklist.js` + `blocklist-files.json` / `blocklist-words.json`) blocks dangerous `bash`/`edit_file` operations.



#### Interface Effects

**Visual effects (2+):**

| Effect | Where |
|--------|-------|
| Animated loading dots | `public/styles/loader.css` — dots bounce in sequence while the agent thinks |
| Mockup overlay enter | `public/styles/mockup.css` — `mockup-fade` (backdrop) + `mockup-pop` (panel spring) |
| Color-format buttons | `public/styles/picker.css` — type grows and tilts on hover, selected state raised |
| Swatch / palette hover | `public/styles/palette.css` — swatch lift and palette-entry transitions |
| Model-toggle icon | `public/styles/form.css` — the `⇄` icon rotates on hover |

**Audio effects:**

Two browser-side cues are played via the **Web Audio API** (`public/js/audio/sound.js`). The samples are decoded once on load and played with zero latency, overlapping; the audio context is unlocked on the first user gesture (browser autoplay policy).

| Effect | Trigger | Where |
|--------|---------|-------|
| **Hover click** | Hovering a swatch / randomizer column | `public/js/audio/sound.js` → `playHoverSound()` (`assets/Click Sound Effects.wav`), wired in `public/js/tools/ui.js` and `public/js/tools/coolors.js` |
| **Swoosh** | Generating a new randomizer palette (Space / Generate) | `public/js/audio/sound.js` → `playSpaceSound()` (`assets/Swoosh.wav`), wired in `public/js/tools/coolors.js` |

| Optional (agent-side) | Where | Status |
|-----------------------|-------|--------|
| MP3 playback via agent | `tools/play_mp3.js` (`mpg123`) | **Disabled** in `tools/config.json` — set `"play_mp3": true` to enable |

#### Output Styles (2+)

`public/output/` auto-detects the response format and renders accordingly:

| Style | File | Trigger |
|-------|------|---------|
| **JSON** | `public/output/json.js` | Valid JSON → formatted, highlighted object |
| **Code block** | `public/output/code.js` | Fenced code (` ``` `) → monospace styling |
| **Markdown** | `public/output/md.js` | Headings/lists/bold → rendered HTML |
| **Plain text** | `public/output/index.js` (fallback) | No format detected → as-is |

### Subagent Architecture

Subagents are child agent processes spawned by the main agent:

- Each subagent gets a fresh context window (avoids overflow on large tasks).
- Multiple subagents run in parallel via `Promise.all` (`server/chat.js`).
- Each can receive a custom `system_prompt` for role specialization.
- Internally a subagent call runs `bun run server.js -p "..." -s "..."` as a child process.

---
## Benchmark

| Provider | Type  | Default model | Speed (measured) | Accuracy |
|----------|-------|-------------|------------------|----------|
| **OpenAI** | Cloud | `gpt-4o-mini` | Fast **~4-5 s**  | High |
| **GitHub Copilot** | Cloud | `gpt-4o` | Fast **~3-4 s**| High |
| **Ollama** | Local | `qwen3:8b` | Slow **~18 s**  | Lower |

**How the speed was measured :** with the server running locally, I sent the *same* short prompt "name 3 hex colors for a Spiderman palette"  to each provider through the app's own `POST /api/chat` endpoint and timed the full round-trip with `curl` (`%{time_total}`). OpenAI and Ollama were each run 3× and averaged;  These are **end-to-end** times (network + server + model generation) for a *short* answer on one machine longer answers take proportionally longer, so treat the numbers as rough guidance, not a formal benchmark. OpenAI is fastest because it is a small, hosted model; Ollama is slowest because it runs locally on the machine's own hardware (and `qwen3` adds a "thinking" step before the answer).

> 💡 **Measure it yourself, any time:** every chat request is timed in the app. Open the browser **DevTools → Console** and send a prompt — you'll see a line like `⏱️ Antwort von openai · Modell: gpt-4o-mini · Dauer: 2.74s`. The duration is the wall-clock time from sending the prompt to receiving the answer (`public/js/main.js`, measured with `Date.now()`).

**About accuracy (in plain words):** we did **not** really measure how *good* the colors are — the *Accuracy* column is only a best guess. Speed is easy: you start a timer and stop it. But "good colors" has no single right answer — there is no one correct Spiderman palette to compare with.

To really measure it, we could check two simple things:

- **Right shape:** did the model give the colors in the form we asked for — for example, 3 proper color codes? A small program can count this and say *yes* or *no*.
- **Right look:** do the colors fit the topic? Spiderman should be red and blue. We just look and decide, or ask a few people *"does this fit — yes or no?"*.

Then we ask each model the same things many times and count how often it is right. More right answers = more accurate. Until we run that test, the column is just a sensible guess: the big online models (`gpt-4o`, `gpt-4o-mini`) usually pick fitting colors more reliably than the smaller local one (`qwen3:8b`).


---
## Local Design Tools (no LLM)

These run entirely in the browser — no API, instant feedback. They reuse the shared color math and helpers in `public/js/core/utils.js` (`clamp`, `slugify`, `downloadBlob` were de-duplicated there from several modules).

| Tool | Files | What it does |
|------|-------|--------------|
| **Color randomizer** | `public/js/tools/coolors.js`, `styles/coolors.css` | Full-screen Coolors-style generator: spacebar / **Generate** reshuffles all unlocked columns (random pleasant HSL colors), each column can be **locked, drag-reordered, removed and copied**, with **undo/redo** (Cmd/Ctrl+Z). A coloured **format toggle** in the toolbar cycles the displayed and copied coding through HEX → RGB → HSL → HSV → CMYK → LCH (pill colour follows the format, same mapping as the history palette). Palettes can be viewed in the mockup overlay and exported as PNG. |
| **History palette** | `public/js/tools/history.js`, `public/js/tools/ui.js` | Saved palettes with the “Pigment” swatch editor, drag-reorder, format conversion, automatic naming, and **PNG export** (canvas). Color names via `public/js/color/color-names.js`, which calls the open-source [meodai/color-name-api](https://github.com/meodai/color-name-api) (public instance [api.color.pizza](https://api.color.pizza)) with a local HSL fallback. |
| **Contrast check** | `public/js/tools/contrast.js`, `styles/contrast.css` | WCAG contrast ratio between two colors with a good/medium/bad rating. |
| **Mockup preview** | `public/js/tools/mockup.js`, `public/js/color/color-roles.js`, `styles/mockup.css` | Opens a 2×3 moodboard of designed mockups (website in a browser frame · graphic editorial poster · mobile app in a phone frame · music player · abstract gradient-mesh artwork · dashboard with donut) filled with a palette’s colors, mapped to semantic roles (bg/surface/text/accent/accent2), with a **role legend** (which color sits where, incl. hex + name), **clickable swatches to set any palette color as the background** (the other roles re-derive live), an automatic harmony label (analog / complementary / triadic), and a **PNG export** of the whole sheet (self-contained SVG → canvas). Reached via the ⊞ button on each history palette. |
| **Color-blindness simulation** | `public/js/tools/cvd.js`, `styles/cvd.css` | Simulates color-vision deficiencies (protanopia, deuteranopia, tritanopia, achromatopsia) over the history palette via an SVG `feColorMatrix` filter — the real color codes stay unchanged and the choice persists in `localStorage`. When a mode is active it **carries into the rest of the app**: the same matrix is applied numerically (`simulateHex` / `getCvdMode`) so the **mockup preview**, the **mockup PNG** and the **palette PNG export** all show the simulated colors (codes/names stay real, and the export notes which simulation is baked in). |
| **Color adjust** | `public/js/color/color-adjust.js` | Saturation / contrast / brightness adjustment used by the Pigment editor. |

The mockup preview opened from a palette:

<img src="docs/img/02-mockup.png" width="760" alt="Mockup preview — one palette across 6 designed layouts with a harmony label" />

### Controls 

**Color randomizer toolbar** (top of the landing view):

<img src="docs/img/btn-toolbar.png" width="440" alt="Randomizer toolbar" />

| Button | Action |
|--------|--------|
| **Generate** (or `Space`) | Reshuffles all unlocked columns with new colors |
| **HEX** (coloured pill) | Cycles the shown/copied coding: HEX → RGB → HSL → HSV → CMYK → LCH (pill colour follows the format) |
| ↶ / ↷ | Undo / redo the last change (`Cmd/Ctrl+Z`) |
| ▦ | Open the **mockup preview** for the current palette |
| ↓ | Export the palette as **PNG** |

**Per-column tools** (appear when hovering a color column):

<img src="docs/img/btn-column-tools.png" width="170" alt="Column tools" />

| Icon | Action |
|------|--------|
| 🔓 lock | Lock the color so **Generate** keeps it |
| ⠿ grip | Drag to **reorder** columns |
| ✕ | Remove the column |
| ⧉ copy | Copy the color value (in the active format) |

**Agent controls** (below the chat input):

| Control | Image | What it does |
|---------|-------|--------------|
| Provider toggle | <img src="docs/img/btn-model.png" width="150" alt="provider toggle" /> | Cycles the active LLM (OpenAI → Copilot → Ollama) |
| Color-format buttons | <img src="docs/img/btn-formatrow.png" width="360" alt="format buttons" /> | Picks the color coding the agent should return (HSV · RGB · HEX · CMYK · HSL · LCH) |
| Colour-blindness selector | <img src="docs/img/btn-cvd.png" width="240" alt="cvd selector" /> | Simulates a color-vision deficiency over the history palette (and mockup / PNG export) |

### Where palettes are stored

All palettes live in the **browser's `localStorage`** — i.e. on the user's own device/browser, **not** on a server and **not** synced across devices. There is no database. The data survives page reloads and browser restarts, and stays until it is cleared (see below).

| What | localStorage key | Set in |
|------|------------------|--------|
| Saved **history palettes** (colors, names, order, format) | `color-palettes-history-v1` | `public/js/tools/history.js` |
| Counter for automatic palette names | `color-palettes-counter-v1` | `public/js/tools/history.js` |
| **Image palettes** from COMPP (incl. small compressed thumbnails) | `image-palette-entries-v1` | `public/js/image/image-palette.js` |
| Selected **color-blindness mode** | `history-cvd-mode-v1` | `public/js/tools/cvd.js` |

(The keys are defined in `public/js/core/constants.js`.) **How it gets cleared:** the **Reset** button removes the history and image-palette entries; clearing the browser's site data (or using a different browser / private window) also wipes everything. You can inspect or delete the values manually in **DevTools → Application → Local Storage**.

---

## Architecture

```
p08-ai-agent-with-subagents/
├── server.js               # Bun server + CLI agent loop; builds provider list, routes
├── server/
│   ├── chat.js             # Multi-provider LLM client (OpenAI/Copilot/Ollama), tool loop, /api/chat + /api/providers
│   ├── replicate.js        # Replicate API proxy (COMPP)
│   └── shared.js           # CORS / 404 / JSON helpers
├── tools/
│   ├── index.js            # Tool registry (filtered by config.json)
│   ├── read_file.js        # Tool: read file
│   ├── list_files.js       # Tool: list directory
│   ├── edit_file.js        # Tool: write/edit file
│   ├── code-search.js      # Tool: ripgrep search
│   ├── bash.js             # Tool: shell command
│   ├── play_mp3.js         # Tool: audio playback (custom)
│   ├── subagent.js         # Tool: spawn sub-agent
│   ├── blocklist.js        # Safety guard for bash/edit
│   ├── blocklist-files.json, blocklist-words.json
│   └── config.json         # Enable/disable individual tools
├── public/
│   ├── index.html          # Single-page app shell (loads js/main.js + js/output/style.css)
│   ├── assets/             # Images + audio samples
│   ├── styles/             # base, layout, form, picker, palette, image-palette,
│   │                       #   loader, responsive, cvd, contrast, mockup, coolors
│   └── js/                 # All app modules, grouped by domain
│       ├── main.js         # Entry: app orchestration, events, model toggle, history render
│       ├── core/           # utils.js (color math + shared helpers: clamp, slugify, downloadBlob),
│       │                   #   constants.js, api.js (fetch wrappers, /api/providers)
│       ├── color/          # color-parser.js, color-names.js, color-adjust.js, color-roles.js
│       ├── tools/          # ui.js, history.js, contrast.js, cvd.js, coolors.js,
│       │                   #   mockup.js, swatch-picker.js, palette-export.js
│       ├── image/          # image-palette.js, image-palette-parse.js (COMPP)
│       ├── audio/          # sound.js (Web-Audio UI cues)
│       └── output/         # index.js (dispatcher), json.js, code.js, md.js, style.css
└── .env                    # API keys & config (gitignored)
```

---

## Third-Party Sources / Attribution

External code and services this project builds on (GitHub templates / open-source projects used):

| Source | Type | Used for | Where |
|--------|------|----------|-------|
| [meodai/color-name-api](https://github.com/meodai/color-name-api) (public instance [api.color.pizza](https://api.color.pizza)) | Open-source API | Human-readable names for hex colors in the history palette (with a local HSL fallback) | `public/js/color/color-names.js` |
| [bbc/color-contrast-checker](https://github.com/bbc/color-contrast-checker) | Open-source reference | WCAG contrast pass/fail thresholds (AA / large-text rating) for the contrast tool | `public/js/tools/contrast.js` |
| [chroma.js](https://github.com/gka/chroma.js) | JS library | Perceptually even palette blending (COMPP slider) | `public/js/image/image-palette.js` |
| [Replicate](https://replicate.com) — [lucataco/ollama-llama3.2-vision-90b](https://replicate.com/lucataco/ollama-llama3.2-vision-90b) | Hosted ML model | Extracting palettes from uploaded images (COMPP) | `server/replicate.js` |


---


## AI Declaration

The following AI tools were used during this project:

| Area | Tool Used | How |
|------|-----------|-----|
| Code refactoring & cleanup | **Claude Code (Anthropic)** | Reformatting and de-duplication (shared `utils.js` helpers), CSS consolidation and design tokens, reorganising `public/js/` into domain folders. The **HTML markup, the button/UI logic and the LLM/Replicate API integration were written by hand** (see below). |
| Code review & debugging | **Claude Code (Anthropic)** | Finding bugs (e.g. the invalid `language` API arg, the `rate`/`evaluate` typo), reviewing tools and the subagent architecture |



**Written by hand (without AI):**
- The **HTML structure and markup** 
- The **button / UI event-handler functions** (color-format buttons, model toggle, palette controls, upload/submit)
- The **LLM provider and GitHub API integration** 
- Initial project setup and `.env` configuration
- Core agent loop logic in `server/chat.js`
- Tool definitions in `tools/` (structure and business logic)
- Color-extraction pipeline decisions (polling interval, cache strategy)
- First versions of designs, but I rethrowed few times


> AI was used as a coding assistant and pair-programmer, not a replacement for understanding. All AI-generated code was reviewed, tested, and adapted before use.
