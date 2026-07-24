# Deployment — Color Palette AI Agent (Bun-Server)

Diese drei Dateien gehören ins **Repo-Root** von `Color-Palette-Generator`:
`Dockerfile`, `.dockerignore`, `render.yaml`.

Der Server (`server.js`) läuft über Bun und bindet auf den Port aus `APP_SERVER_PORT`.
Das Dockerfile mappt den vom Hoster vorgegebenen `$PORT` automatisch darauf.
**Ohne API-Keys** startet der Server trotzdem: statische UI + lokale Design-Tools
funktionieren, nur Chat/Bildanalyse brauchen Keys.

## Variante A — Render (empfohlen, Gratis-Stufe)

1. Die 3 Dateien ins Repo legen, committen, pushen.
2. Auf https://render.com anmelden → **New → Blueprint** → das Repo auswählen.
   Render liest `render.yaml` und erstellt den Web-Service automatisch.
3. Optional unter **Environment** die Keys setzen (`OPENAI_API_KEY`,
   `GITHUB_COPILOT_KEY`, `REPLICATE_API_TOKEN`). Ohne sie läuft die Seite auch,
   nur ohne KI-Chat.
4. Nach dem ersten Deploy bekommst du eine URL wie
   `https://color-palette-generator.onrender.com`.

Hinweis Gratis-Stufe: der Dienst schläft nach ~15 Min Inaktivität ein, der erste
Aufruf danach dauert ~30-50s (Cold Start). Für ein Portfolio-Preview meist okay.

## Variante B — Railway

1. Dieselben 3 Dateien ins Repo (Railway nutzt das Dockerfile automatisch).
2. https://railway.app → **New Project → Deploy from GitHub repo** → Repo wählen.
3. Keys unter **Variables** setzen (optional). Public URL unter **Settings → Networking → Generate Domain**.

## Variante C — Fly.io

Braucht `flyctl`: `fly launch` im Repo-Root erkennt das Dockerfile, dann
`fly deploy`. Keys via `fly secrets set OPENAI_API_KEY=...`.

## Danach: Live-Preview im Portfolio aktivieren

Sobald die App online ist, im Portfolio in `pages/school/projects.js` beim
Color-Palette-Projekt eintragen (statt Screenshot):

```js
preview: 'https://DEINE-DEPLOY-URL/',   // z. B. https://color-palette-generator.onrender.com/
ratio: 0.62,                            // Querformat für die Web-Vorschau
```

Dann läuft die echte App als eingebettete Live-Vorschau in Kachel + Overlay.
Bei der Render-Gratis-Stufe kann die erste Anzeige durch den Cold-Start kurz
dauern — `image` als Fallback stehen lassen schadet nicht.
