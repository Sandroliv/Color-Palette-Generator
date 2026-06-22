# *Wiki* Color Palette AI Agent

**HSLU Bachelor Digital Ideation Computer Science**
---
Sandro Fankhauser
FS26 - DEWEB - COMPP

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

This project is a **Color Palette AI Agent**, a single web app that brings two modules together:

- **COMPP**: pulls a color palette out of an image, using a Replicate ML model.
- **DEWEB**: a chat agent that really only talks about one thing, color theory and design. It comes with CLI tools, subagents, a lively animated interface and a handful of **local design tools** (contrast check, mockup preview, color blindness simulation).

Both run on one Bun server and share the same frontend, so it all feels like a single app.

---

## COMPP Module

### What it does

You upload up to three images. The app hands them to the [Replicate](https://replicate.com) API, where a machine learning model figures out the dominant colors. What comes back is shown as swatches, kept in `localStorage`, and can be passed on to the chat agent as color context.

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

- Replicate predictions run asynchronously, so I poll every 500 ms with a 120 s timeout. That keeps it feeling responsive without hammering the rate limits.
- Once the palettes exist, blending them locally with chroma.js is basically instant.

### API selection

- I first tried [yuni-eng/image-to-color](https://replicate.com/yuni-eng/image-to-color) (~11B params), but it was too expensive and too slow (around 3 min).
- So I switched to [lucataco/ollama-llama3.2-vision-90b](https://replicate.com/lucataco/ollama-llama3.2-vision-90b) (~90B), which turned out cheaper and faster (around 1 min).

---

## DEWEB Module

#### Specialization

**Color Palette Assistant**, focused on color theory, color codes, design palettes and color naming. Its system prompt keeps it inside that topic, and any palette context (from COMPP or picked by hand) gets folded into the prompt through `public/js/color/color-parser.js`. The prompt asks the model for a fixed number of `[COLOR_NEUTRAL:…]` tokens. The example colour is a plain **neutral grey** (`#808080`) on purpose, so the model is not nudged toward a particular hue or lightness and instead works out colors that actually fit the theme (ask for *Spiderman* and you get a deep, saturated red, not some generic light coral).

#### LLM Provider 

The requirement was a connection to Ollama (local) **or** GitHub Copilot (cloud). This project does both, and throws in OpenAI on top. You pick the one you want at runtime with the cycle button above the prompt. If a provider errors out, you see it right away, nothing quietly steps in for it.

| Provider | Type | Env key(s) | Base URL | Default model |
|----------|------|-----------|-----------|---------------|
| **OpenAI** | Cloud | `OPENAI_API_KEY`, `OPENAI_MODEL` | `https://api.openai.com/v1` | `gpt-4o-mini` |
| **GitHub Copilot** | Cloud | `GITHUB_COPILOT_KEY`, `GITHUB_COPILOT_MODEL` | `https://api.githubcopilot.com` | `gpt-4o` |
| **Ollama** | Local | `OLLAMA_MODEL`, `OLLAMA_BASE_URL` | `http://localhost:11434/v1` | `qwen3:8b` |

- `server.js` builds the list of **configured** providers (a cloud provider only appears if its key is set; Ollama always appears). `LLM_PROVIDER` chooses the default.
- `server/chat.js` keeps them in a `Map` and uses **exactly** the selected provider (`maxRetries: 0`).
- **`GET /api/providers`** returns `{ default, providers:[{name,label,model}] }`; the frontend builds the toggle from it and sends the chosen `provider` with each `POST /api/chat`.
- The server response is trimmed to only `{ provider, model, choices }`, and the conversation is capped (`MAX_CONVERSATION_MESSAGES`, default 24) to keep latency/token cost bounded.





#### Interface Effects

**Visual effects (2+):**

| Effect | Where |
|--------|-------|
| Animated loading dots | `public/styles/loader.css` — dots bounce in sequence while the agent thinks in image palette generator |
| Mockup overlay enter | `public/styles/mockup.css` — `mockup-fade` (backdrop) + `mockup-pop` (panel spring) |
| Color-format buttons | `public/styles/picker.css` — type grows and tilts on hover, selected state raised |
| Swatch / palette hover | `public/styles/palette.css` — swatch lift and palette-entry transitions |


**Audio effects:**

Two little cues play in the browser through the **Web Audio API** (`public/js/audio/sound.js`). The samples get decoded once when the page loads, so they fire instantly and can overlap. The audio context only wakes up on the first click, since browsers block autoplay until you interact with the page.

| Effect | Trigger | Where |
|--------|---------|-------|
| **Hover click** | Hovering a swatch / randomizer column | `public/js/audio/sound.js` → `playHoverSound()` (`assets/Click Sound Effects.wav`), wired in `public/js/tools/ui.js` and `public/js/tools/coolors.js` |
| **Swoosh** | Generating a new randomizer palette (Space / Generate) | `public/js/audio/sound.js` → `playSpaceSound()` (`assets/Swoosh.wav`), wired in `public/js/tools/coolors.js` |

There is also an agent-side `play_mp3` (`tools/play_mp3.js`, via `mpg123`) that can play an MP3 from a path. I keep it around as an extra audio capability, but I do **not** count it as one of the agent's tools, since it needs `mpg123` installed and an MP3 file to point at. The real interface audio is the Web Audio cues above.

#### Output Styles 

`public/output/` auto-detects the response format and renders accordingly:

| Style | File | Trigger |
|-------|------|---------|
| **JSON** | `public/output/json.js` | Valid JSON → formatted, highlighted object |
| **Code block** | `public/output/code.js` | Fenced code (` ``` `) → monospace styling |
| **Markdown** | `public/output/md.js` | Headings/lists/bold → rendered HTML |
| **Plain text** | `public/output/index.js` (fallback) | No format detected → as-is |

### Subagent Architecture

Subagents are child agent processes that the main agent spins up when it needs help:

- Each one starts with a fresh context window, so big tasks do not overflow.
- Several can run at the same time through `Promise.all` (`server/chat.js`).
- Each can get its own `system_prompt`, so you can give it a specific role.
- Behind the scenes, a subagent call just runs `bun run server.js -p "..." -s "..."` as a child process.

---
## Benchmark

| Provider | Type  | Default model | Speed (measured) | Accuracy |
|----------|-------|-------------|------------------|----------|
| **OpenAI** | Cloud | `gpt-4o-mini` | Fast **~4-5 s**  | High |
| **GitHub Copilot** | Cloud | `gpt-4o` | Fast **~3-4 s**| High |
| **Ollama** | Local | `qwen3:8b` | Slow **~18 s**  | Lower |

**How I measured the speed:** with the server running locally, I sent the *same* short prompt, "Do a spiderman palette", to each provider through the app's own `POST /api/chat` endpoint and timed the full round trip with `curl` (`%{time_total}`). OpenAI and Ollama were each run three times and averaged. These are **end to end** times (network plus server plus model generation) for a *short* answer on one machine. Longer answers take proportionally longer, so treat the numbers as rough guidance, not a formal benchmark. OpenAI comes out fastest because it is a small hosted model, and Ollama is slowest because it runs on my own hardware (and `qwen3` does a little "thinking" step before it answers).



**About accuracy:** I did **not** really measure how *good* the colors are, the *Accuracy* column is only a best guess. Speed is easy: you start a timer and stop it. But "good colors" has no single right answer, there is no one correct Spiderman palette to compare with.

To really measure it, we could check two simple things:

- **Right shape:** did the model give the colors in the form we asked for — for example, 3 proper color codes? A small program can count this and say *yes* or *no*.
- **Right look:** do the colors fit the topic? Spiderman should be red and blue. We just look and decide, or ask a few people *"does this fit — yes or no?"*.

Then we ask each model the same things many times and count how often it is right. More right answers = more accurate. Until we run that test, the column is just a sensible guess: the big online models (`gpt-4o`, `gpt-4o-mini`) usually pick fitting colors more reliably than the smaller local one (`qwen3:8b`).


---
<!-- ## Local Design Tools (no LLM)

These all run right in the browser, no API call, instant feedback. They share the same color math and helpers from `public/js/core/utils.js` (I pulled `clamp`, `slugify` and `downloadBlob` together there instead of repeating them across modules).

| Tool | Files | What it does |
|------|-------|--------------|
| **Color randomizer** | `public/js/tools/coolors.js`, `styles/coolors.css` | Full-screen Coolors-style generator: spacebar / **Generate** reshuffles all unlocked columns, each column can be **locked, drag-reordered, removed and copied**, with **undo/redo** (Cmd/Ctrl+Z). A coloured **format toggle** in the toolbar cycles the displayed and copied coding through HEX → RGB → HSL → HSV → CMYK → LCH (pill colour follows the format, same mapping as the history palette). Palettes can be viewed in the mockup overlay and exported as PNG. |
| **History palette** | `public/js/tools/history.js`, `public/js/tools/ui.js` | Saved palettes with the “Pigment” swatch editor, drag-reorder, format conversion, automatic naming, and **PNG export** (canvas). Color names via `public/js/color/color-names.js`, which calls the open-source [meodai/color-name-api](https://github.com/meodai/color-name-api) (public instance [api.color.pizza](https://api.color.pizza)) with a local HSL fallback. |
| **Contrast check** | `public/js/tools/contrast.js`, `styles/contrast.css` | WCAG contrast ratio between two colors with a good/medium/bad rating. |
| **Mockup preview** | `public/js/tools/mockup.js`, `public/js/color/color-roles.js`, `styles/mockup.css` | Opens a 2×3 moodboard of designed mockups (website in a browser frame · graphic editorial poster · mobile app in a phone frame · music player · abstract gradient-mesh artwork · dashboard with donut) filled with a palette’s colors, mapped to semantic roles (bg/surface/text/accent/accent2), with a **role legend** (which color sits where, incl. hex + name), **clickable swatches to set any palette color as the background** (the other roles re-derive live), an automatic harmony label (analog / complementary / triadic), and a **PNG export** of the whole sheet (self-contained SVG → canvas). Reached via the ⊞ button on each history palette. |
| **Color-blindness simulation** | `public/js/tools/cvd.js`, `styles/cvd.css` | Simulates color-vision deficiencies (protanopia, deuteranopia, tritanopia, achromatopsia) over the history palette via an SVG `feColorMatrix` filter — the real color codes stay unchanged and the choice persists in `localStorage`. When a mode is active it **carries into the rest of the app**: the same matrix is applied numerically (`simulateHex` / `getCvdMode`) so the **mockup preview**, the **mockup PNG** and the **palette PNG export** all show the simulated colors (codes/names stay real, and the export notes which simulation is baked in). |
| **Color adjust** | `public/js/color/color-adjust.js` | Saturation / contrast / brightness adjustment used by the Pigment editor. | -->


### Where palettes are stored

All palettes live in the **browser's `localStorage`**, meaning on your own device and browser, **not** on a server and **not** synced anywhere. There is no database. The data sticks around through page reloads and browser restarts, and stays until you clear it (see below).

| What | localStorage key | Set in |
|------|------------------|--------|
| Saved **history palettes** (colors, names, order, format) | `color-palettes-history-v1` | `public/js/tools/history.js` |
| Counter for automatic palette names | `color-palettes-counter-v1` | `public/js/tools/history.js` |
| **Image palettes** from COMPP (incl. small compressed thumbnails) | `image-palette-entries-v1` | `public/js/image/image-palette.js` |
| Selected **color-blindness mode** | `history-cvd-mode-v1` | `public/js/tools/cvd.js` |


---

<!-- ## Architecture

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
│   ├── subagent.js         # Tool: spawn sub-agent (custom +1)
│   ├── play_mp3.js         # Extra: agent-side MP3 playback (mpg123, not counted as a tool)
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
``` -->

---

## Third-Party Sources / Attribution

The external code and services this project leans on (GitHub templates and open source projects):

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
| Code refactoring & cleanup | **Claude Code (Anthropic)** | Reformatting and de-duplication (shared `utils.js` helpers), CSS consolidation and design tokens, reorganising `public/js/` into domain folders. The **HTML markup, the button/UI logic and the LLM/Replicate API integration were written by hand** (see below). As well as supporting me with Readme, Wiki and documentation writing. |
| Code review & debugging | **Claude Code (Anthropic)** | Finding bugs (e.g. the invalid `language` API arg, the `rate`/`evaluate` typo), reviewing tools and the subagent architecture |
| Color encoding process | **Claude Code (Anthropic)** | Using regular expressions to detect and parse color values, then converting them from HEX into the requested color format (RGB, HSL, HSV, CMYK, LCH) |




**Written by hand (without AI):**
- The **HTML structure and markup** 
- The **button / UI event-handler functions** (color-format buttons, model toggle, palette controls, upload/submit)
- The **LLM provider integration** 
- Initial project setup and `.env` configuration
- Core agent loop logic in `server/chat.js`
- Tool definitions in `tools/` (structure and business logic)
- Color-extraction pipeline decisions (polling interval, cache strategy)
- First versions of designs
  

