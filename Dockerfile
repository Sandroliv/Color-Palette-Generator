# Bun-Server-App (Color Palette AI Agent) — Container für Render / Railway / Fly.io
# Offizielles Bun-Image, an Version pinnen für reproduzierbare Builds.
FROM oven/bun:1

WORKDIR /app

# Zuerst nur Manifest + Lockfile → Docker-Layer-Cache nutzt Install erneut,
# solange sich die Abhängigkeiten nicht ändern.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Restlichen Code kopieren
COPY . .

# server.js liest den Port aus APP_SERVER_PORT (Default 8787). Hosting-Dienste
# geben den Port über $PORT vor — beim Start darauf mappen. Bun.serve bindet
# standardmässig auf 0.0.0.0, ist also von aussen erreichbar.
ENV APP_SERVER_PORT=8787
EXPOSE 8787

CMD ["sh", "-c", "APP_SERVER_PORT=${PORT:-8787} bun run server.js"]
