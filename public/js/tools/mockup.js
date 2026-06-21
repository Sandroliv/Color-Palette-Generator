import { deriveRoles, classifyHarmony } from "../color/color-roles.js";
import { localColorName } from "../color/color-names.js";
import { getCvdMode, simulateEntries, CVD_MODES } from "./cvd.js";
import { slugify, downloadBlob } from "../core/utils.js";

/* ── Mockup-Vorschau ──────────────────────────────
   Overlay mit 2×3-Moodboard (Website im Browser, grafisches
   Editorial-Poster, Mobile-App im Phone-Frame, Music-Player,
   abstraktes Gradient-Mesh-Artwork, Dashboard), eingefärbt mit
   den Rollen-Farben einer Palette. Zeigt zusätzlich eine
   Legende (welche Farbe = welche Rolle) und exportiert
   die Komposition als PNG. Rein lokal, kein API. */

// Rolle → Anzeigename (für Legende + PNG).
const ROLE_DEFS = [
  ["bg", "Hintergrund"],
  ["surface", "Fläche"],
  ["text", "Text"],
  ["accent", "Akzent"],
  ["accent2", "Akzent 2"],
];

let activeOverlay = null;

function onKeydown(event) {
  if (event.key === "Escape") closeMockupOverlay();
}

export function closeMockupOverlay() {
  if (!activeOverlay) return;
  activeOverlay.remove();
  activeOverlay = null;
  document.removeEventListener("keydown", onKeydown, true);
}

function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html != null) node.innerHTML = html;
  return node;
}

// ── DOM-Vorlagen (statisches Markup; eingefärbt via --mk-* Variablen) ──

// Landing-Page in einem Browser-Fenster (mit Chrome, Nav, Hero, Verlaufs-Grafik).
function buildWebsite() {
  return el(
    "div",
    "mk-card mk-web",
    `
    <div class="mk-browser">
      <span class="mk-traffic"></span><span class="mk-traffic"></span><span class="mk-traffic"></span>
      <span class="mk-url">pigment.studio</span>
    </div>
    <div class="mk-web-body">
      <div class="mk-web-nav">
        <span class="mk-logo"><span class="mk-logo-dot"></span>Pigment</span>
        <span class="mk-web-links"><i></i><i></i><i></i></span>
      </div>
      <div class="mk-web-hero">
        <div class="mk-web-copy">
          <div class="mk-eyebrow">Design Studio</div>
          <div class="mk-headline">Farbe<br>in Form.</div>
          <button class="mk-btn mk-btn-sm" type="button" tabindex="-1">Entdecken</button>
        </div>
        <div class="mk-web-art"><span class="mk-web-ring"></span></div>
      </div>
    </div>`,
  );
}

// Grafisches Editorial-Poster mit überlappenden Formen und grosser Typo.
function buildPoster() {
  return el(
    "div",
    "mk-card mk-poster",
    `
    <span class="mk-poster-circle"></span>
    <span class="mk-poster-bar"></span>
    <div class="mk-poster-index">№01</div>
    <div class="mk-poster-word">PIG<br>MENT</div>
    <div class="mk-poster-foot">Farb-Edition · MMXXVI</div>`,
  );
}

// Mobile-App im Phone-Frame (Notch, Hero-Balance, Tiles, Bottom-Nav).
function buildApp() {
  return el(
    "div",
    "mk-card mk-app",
    `
    <div class="mk-phone">
      <span class="mk-notch"></span>
      <div class="mk-phone-screen">
        <div class="mk-app-head"><span class="mk-cap">Willkommen</span><span class="mk-strong">Übersicht</span></div>
        <div class="mk-app-hero"><span class="mk-app-balance">CHF 1’240</span></div>
        <div class="mk-app-tiles"><span></span><span></span></div>
        <div class="mk-app-nav"><i></i><i></i><i></i><i></i></div>
      </div>
    </div>`,
  );
}

// Music-Player mit Verlaufs-Cover, Waveform und Steuer-Buttons.
function buildMusic() {
  return el(
    "div",
    "mk-card mk-music",
    `
    <div class="mk-cover"><span class="mk-cover-ring"></span><span class="mk-cover-dot"></span></div>
    <div class="mk-music-meta"><span class="mk-strong">Spektrum</span><span class="mk-cap">SAEK · Pigment</span></div>
    <div class="mk-wave">${"<span></span>".repeat(14)}</div>
    <div class="mk-controls"><span class="mk-ctrl"></span><span class="mk-ctrl mk-play"></span><span class="mk-ctrl"></span></div>`,
  );
}

// Abstraktes Gradient-Mesh-Artwork — die Palette als reine Grafik.
function buildArt() {
  return el(
    "div",
    "mk-card mk-art",
    `
    <span class="mk-art-blob mk-art-b1"></span>
    <span class="mk-art-blob mk-art-b2"></span>
    <span class="mk-art-blob mk-art-b3"></span>
    <div class="mk-art-label"><span class="mk-eyebrow">Verlauf</span><span class="mk-art-title">Gradient<br>Mesh</span></div>`,
  );
}

// Dashboard mit Donut-Diagramm, Stat-Tiles und Balken.
function buildDashboard() {
  return el(
    "div",
    "mk-card mk-dashboard",
    `
    <div class="mk-row"><span class="mk-dot"></span><span class="mk-strong">Analytics</span></div>
    <div class="mk-dash-body">
      <div class="mk-donut"><span class="mk-donut-hole">87%</span></div>
      <div class="mk-dash-tiles">
        <div class="mk-tile"><span class="mk-num">42</span><span class="mk-cap">Aktiv</span></div>
        <div class="mk-tile mk-tile-accent"><span class="mk-num">8.6</span><span class="mk-cap">Score</span></div>
      </div>
    </div>
    <div class="mk-chart">
      <span style="height:45%"></span><span style="height:72%"></span><span style="height:58%"></span>
      <span style="height:90%"></span><span style="height:38%"></span><span style="height:66%"></span>
    </div>`,
  );
}

// ── Eine Legenden-Zeile: Rolle → Farbe (Hex + Name) ──
function legendItem(label, hex) {
  const item = el("div", "mockup-legend-item");
  const chip = el("span", "mockup-legend-chip");
  chip.style.background = hex;
  const meta = el("div", "mockup-legend-meta");
  meta.append(
    el("span", "mockup-legend-role", label),
    el("span", "mockup-legend-hex", `${hex} · ${localColorName(hex)}`),
  );
  item.append(chip, meta);
  return item;
}

export function openMockupOverlay({ colorEntries, name } = {}) {
  closeMockupOverlay();

  // Falls eine Sehsimulation aktiv ist: Farben rechnerisch simulieren, damit
  // Vorschau und PNG dieselbe Wirkung wie die History-Palette zeigen.
  const cvdMode = getCvdMode();
  const cvdLabel = CVD_MODES.find((mode) => mode.id === cvdMode)?.label;
  const entries = simulateEntries(colorEntries, cvdMode);

  const harmony = classifyHarmony(entries);
  const title = name || "Palette";
  let forcedBg = null; // null = Hintergrund automatisch; sonst gewählte Farbe

  const overlay = el("div", "mockup-overlay");
  const panel = el("div", "mockup-panel");

  // ── Kopf: Name, Harmonie-Label, klickbarer Strip, Schliessen ──
  const head = el("div", "mockup-head");
  const titleWrap = el("div", "mockup-title-wrap");
  const titleEl = el("div", "mockup-title");
  titleEl.textContent = title;
  const sub = el("div", "mockup-sub");
  sub.textContent =
    cvdMode !== "none"
      ? `Mockup-Vorschau · ${harmony} · Sehsimulation: ${cvdLabel}`
      : `Mockup-Vorschau · ${harmony}`;
  titleWrap.append(titleEl, sub);

  // Strip: jede Farbe ist ein Button → als Hintergrund wählbar.
  const strip = el("div", "mockup-strip");
  const stripDots = [];
  (entries || []).forEach((entry) => {
    const dot = el("button", "mockup-strip-dot");
    dot.type = "button";
    dot.style.background = entry.hexColor;
    dot.dataset.hex = entry.hexColor;
    dot.title = `${entry.code || entry.hexColor} — als Hintergrund verwenden`;
    dot.addEventListener("click", () => {
      forcedBg = entry.hexColor;
      render();
    });
    strip.append(dot);
    stripDots.push(dot);
  });
  const autoBtn = el("button", "mockup-strip-auto", "Auto");
  autoBtn.type = "button";
  autoBtn.title = "Hintergrund automatisch wählen";
  autoBtn.addEventListener("click", () => {
    forcedBg = null;
    render();
  });
  strip.append(autoBtn);

  const close = el("button", "mockup-close", "&#x2715;");
  close.type = "button";
  close.title = "Schliessen (Esc)";
  close.setAttribute("aria-label", "Mockup-Vorschau schliessen");
  close.addEventListener("click", closeMockupOverlay);

  head.append(titleWrap, strip, close);

  const gallery = el("div", "mockup-gallery");
  gallery.append(
    buildWebsite(),
    buildPoster(),
    buildApp(),
    buildMusic(),
    buildArt(),
    buildDashboard(),
  );

  // ── Legende (Inhalt wird bei jeder Hintergrund-Wahl neu gefüllt) ──
  const legend = el("div", "mockup-legend");
  legend.append(
    el(
      "div",
      "mockup-legend-title",
      "Farbrollen — Klick auf eine Farbe oben setzt den Hintergrund",
    ),
  );
  const legendItemsBox = el("div", "mockup-legend-items");
  legend.append(legendItemsBox);

  // ── Fuss: PNG-Download ──
  const footer = el("div", "mockup-footer");
  const hint = el(
    "span",
    "mockup-footer-hint",
    "Klick auf eine Farbe oben = Hintergrund · Rest automatisch.",
  );
  const download = el(
    "button",
    "mockup-download",
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m6 11 6 6 6-6"/><path d="M5 21h14"/></svg> PNG herunterladen',
  );
  download.type = "button";
  const pngHarmony = cvdMode !== "none" ? `${harmony} · Sehsimulation: ${cvdLabel}` : harmony;
  download.addEventListener("click", () =>
    downloadMockupPng({
      roles: deriveRoles(entries, forcedBg),
      colorEntries: entries,
      title,
      harmony: pngHarmony,
    }),
  );
  footer.append(hint, download);

  // Färbt Galerie (CSS-Variablen), Legende und Strip-Markierung neu.
  function render() {
    const roles = deriveRoles(entries, forcedBg);
    for (const [key, value] of Object.entries({
      "--mk-bg": roles.bg,
      "--mk-surface": roles.surface,
      "--mk-text": roles.text,
      "--mk-accent": roles.accent,
      "--mk-accent2": roles.accent2,
      "--mk-on-accent": roles.onAccent,
      "--mk-on-accent2": roles.onAccent2,
    })) {
      panel.style.setProperty(key, value);
    }
    legendItemsBox.replaceChildren(
      ...ROLE_DEFS.map(([key, label]) => legendItem(label, roles[key])),
    );
    stripDots.forEach((dot) => dot.classList.toggle("is-bg", dot.dataset.hex === roles.bg));
    autoBtn.classList.toggle("is-active", forcedBg === null);
  }

  panel.append(head, gallery, legend, footer);
  render();

  overlay.append(panel);
  overlay.addEventListener("pointerdown", (event) => {
    if (event.target === overlay) closeMockupOverlay();
  });

  document.body.append(overlay);
  activeOverlay = overlay;
  document.addEventListener("keydown", onKeydown, true);
}

/* ── PNG-Export ───────────────────────────────────
   Eigenständige SVG-Komposition (unabhängig vom DOM,
   damit der Export ohne externe Library zuverlässig
   funktioniert) → Canvas → PNG-Download. */

const SVG_W = 824;
const SVG_H = 1060;

function escapeXml(str) {
  return String(str).replace(
    /[<>&'"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c],
  );
}

function rect(x, y, w, h, fill, rx = 0) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"/>`;
}
function txt(x, y, str, fill, size, weight = 400, anchor = "start") {
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${escapeXml(str)}</text>`;
}
function circ(cx, cy, r, fill, extra = "") {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${extra}/>`;
}

// Attraktive, wiedererkennbare SVG-Kacheln je Vorlage — auf die Kachel geclippt,
// damit überstehende Formen (Kreise, Blobs) nicht in die Nachbarn laufen.
function svgTile(type, x, y, w, h, r, idx) {
  const pad = 16;
  const ix = x + pad,
    iw = w - pad * 2;
  let body = "";

  if (type === "website") {
    body += rect(x, y, w, h, r.surface, 0);
    body += `<rect x="${x}" y="${y}" width="${w}" height="30" fill="#000" opacity="0.05"/>`;
    body += circ(x + 16, y + 15, 4, r.accent);
    body += circ(x + 28, y + 15, 4, "#000", 'opacity="0.16"');
    body += circ(x + 40, y + 15, 4, "#000", 'opacity="0.16"');
    body += `<rect x="${x + 56}" y="${y + 9}" width="${w - 96}" height="12" rx="6" fill="#000" opacity="0.05"/>`;
    body += circ(ix + 5, y + 52, 5, r.accent);
    body += txt(ix + 16, y + 56, "Pigment", r.text, 12, 700);
    [0, 1, 2].forEach((i) => {
      body += `<rect x="${x + w - pad - 64 + i * 22}" y="${y + 49}" width="16" height="5" rx="2.5" fill="#000" opacity="0.16"/>`;
    });
    body += txt(ix, y + 110, "Farbe", r.text, 27, 800);
    body += txt(ix, y + 142, "in Form.", r.text, 27, 800);
    body += rect(ix, y + h - 42, 86, 24, r.accent, 12);
    body += txt(ix + 43, y + h - 26, "Entdecken", r.onAccent, 10, 700, "middle");
    body += rect(x + w - pad - 88, y + 80, 88, 88, "url(#mkGrad)", 22);
    body += `<circle cx="${x + w - pad - 44}" cy="${y + 124}" r="22" fill="none" stroke="${r.onAccent}" stroke-width="6" opacity="0.85"/>`;
  } else if (type === "poster") {
    body += rect(x, y, w, h, r.text, 0);
    body += circ(x + w - 16, y + 26, 60, r.accent);
    body += `<rect x="${x - 8}" y="${y + 50}" width="120" height="14" rx="7" fill="${r.accent2}" transform="rotate(-18 ${x + 52} ${y + 57})"/>`;
    body += txt(ix, y + 104, "№01", r.bg, 11, 600);
    body += txt(ix, y + 152, "PIG", r.bg, 40, 800);
    body += txt(ix, y + 196, "MENT", r.bg, 40, 800);
    body += txt(ix, y + h - 18, "FARB-EDITION · MMXXVI", r.bg, 9, 700);
  } else if (type === "app") {
    body += rect(x, y, w, h, "url(#mkGrad)", 0);
    const pw = 134,
      ph = h - 24,
      px = x + (w - pw) / 2,
      py = y + 12;
    body += rect(px, py, pw, ph, r.text, 24);
    body += rect(px + 9, py + 11, pw - 18, ph - 22, r.surface, 17);
    body += `<rect x="${px + pw / 2 - 18}" y="${py + 7}" width="36" height="7" rx="3.5" fill="${r.surface}" opacity="0.55"/>`;
    const sx = px + 20,
      sw = pw - 40,
      sy = py + 26;
    body += txt(sx, sy + 4, "Willkommen", r.text, 8, 600);
    body += txt(sx, sy + 18, "Übersicht", r.text, 12, 800);
    body += rect(sx, sy + 28, sw, 46, "url(#mkGrad)", 12);
    body += txt(sx + 9, sy + 58, "CHF 1’240", r.onAccent, 11, 800);
    body += rect(sx, sy + 84, sw / 2 - 4, 24, r.accent, 8);
    body += `<rect x="${sx + sw / 2 + 4}" y="${sy + 84}" width="${sw / 2 - 4}" height="24" rx="8" fill="#000" opacity="0.08"/>`;
    [0, 1, 2, 3].forEach((i) => {
      body += circ(
        sx + 6 + i * ((sw - 12) / 3),
        py + ph - 22,
        4,
        i === 0 ? r.accent : "#000",
        i === 0 ? "" : 'opacity="0.2"',
      );
    });
  } else if (type === "music") {
    body += rect(x, y, w, h, r.surface, 0);
    body += rect(ix, y + pad, iw, 92, "url(#mkGrad)", 14);
    body += `<circle cx="${x + w / 2}" cy="${y + pad + 46}" r="26" fill="none" stroke="${r.onAccent}" stroke-width="8" opacity="0.9"/>`;
    body += circ(x + w / 2, y + pad + 46, 5, r.onAccent);
    body += txt(ix, y + pad + 122, "Spektrum", r.text, 14, 700);
    body += txt(ix, y + pad + 140, "SAEK · PIGMENT", r.accent, 9, 700);
    const wy = y + pad + 150,
      wh = 26,
      n = 14,
      bw = (iw - (n - 1) * 4) / n;
    const pat = [0.5, 0.8, 0.4, 1, 0.6, 0.85, 0.45, 0.7, 0.95, 0.5, 0.75, 0.4, 0.9, 0.55];
    for (let i = 0; i < n; i++) {
      const bh = wh * pat[i];
      body += rect(ix + i * (bw + 4), wy + (wh - bh) / 2, bw, bh, i % 2 ? r.accent : r.accent2, 2);
    }
    const cy = y + h - 24;
    body += circ(x + w / 2 - 36, cy, 6, "#000", 'opacity="0.28"');
    body += circ(x + w / 2, cy, 13, r.accent);
    body += `<path d="M ${x + w / 2 - 4} ${cy - 6} L ${x + w / 2 + 6} ${cy} L ${x + w / 2 - 4} ${cy + 6} Z" fill="${r.onAccent}"/>`;
    body += circ(x + w / 2 + 36, cy, 6, "#000", 'opacity="0.28"');
  } else if (type === "art") {
    body += rect(x, y, w, h, r.bg, 0);
    body += `<g filter="url(#mkBlur)">`;
    body += circ(x + 60, y + 60, 84, r.accent);
    body += circ(x + w - 40, y + h - 24, 76, r.accent2);
    body += circ(x + w / 2 + 16, y + h / 2, 50, r.surface, 'opacity="0.75"');
    body += `</g>`;
    body += txt(ix, y + h - 30, "VERLAUF", r.text, 9, 700);
    body += txt(ix, y + h - 8, "Gradient Mesh", r.text, 17, 800);
  } else if (type === "dashboard") {
    body += rect(x, y, w, h, r.surface, 0);
    body += circ(ix + 5, y + 24, 5, r.accent);
    body += txt(ix + 16, y + 28, "Analytics", r.text, 13, 700);
    const dcx = ix + 42,
      dcy = y + 102,
      dr = 34,
      clen = 2 * Math.PI * dr;
    body += `<circle cx="${dcx}" cy="${dcy}" r="${dr}" fill="none" stroke="#000" stroke-opacity="0.1" stroke-width="13"/>`;
    body += `<circle cx="${dcx}" cy="${dcy}" r="${dr}" fill="none" stroke="${r.accent}" stroke-width="13" stroke-linecap="round" stroke-dasharray="${(clen * 0.78).toFixed(1)} ${clen.toFixed(1)}" transform="rotate(-90 ${dcx} ${dcy})"/>`;
    body += txt(dcx, dcy + 5, "87%", r.text, 14, 800, "middle");
    const tx = ix + 96,
      tw2 = iw - 96;
    body += `<rect x="${tx}" y="${y + 60}" width="${tw2}" height="36" rx="10" fill="#000" opacity="0.06"/>`;
    body += txt(tx + 12, y + 83, "42", r.text, 17, 800);
    body += rect(tx, y + 104, tw2, 36, r.accent, 10);
    body += txt(tx + 12, y + 127, "8.6", r.onAccent, 17, 800);
    const heights = [22, 36, 28, 44, 18, 32];
    heights.forEach((bh, i) => {
      const bw = (iw - 5 * 6) / 6;
      body += rect(ix + i * (bw + 6), y + h - 28 - bh, bw, bh, i % 2 ? r.accent : r.accent2, 3);
    });
  }

  return (
    `<clipPath id="mkc${idx}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16"/></clipPath>` +
    `<g clip-path="url(#mkc${idx})">${body}</g>`
  );
}

function buildMockupSvg({ roles, colorEntries, title, harmony }) {
  const PAD = 40,
    TW = 360,
    TH = 240,
    GAP = 24,
    top = 140;
  const types = ["website", "poster", "app", "music", "art", "dashboard"];
  let tiles = "";
  types.forEach((type, i) => {
    const col = i % 2,
      row = Math.floor(i / 2);
    tiles += svgTile(type, PAD + col * (TW + GAP), top + row * (TH + GAP), TW, TH, roles, i);
  });

  // Mini-Strip oben rechts.
  let stripSvg = "";
  const entries = colorEntries || [];
  entries.forEach((entry, i) => {
    stripSvg +=
      rect(SVG_W - PAD - (entries.length - i) * 24, 52, 18, 18, entry.hexColor, 4) +
      `<rect x="${SVG_W - PAD - (entries.length - i) * 24}" y="52" width="18" height="18" rx="4" fill="none" stroke="rgba(0,0,0,0.12)"/>`;
  });

  // Legende unten.
  const legendY = top + 3 * TH + 2 * GAP + 28;
  let legend = txt(PAD, legendY, "FARBROLLEN — WELCHE FARBE SITZT WO", "#6b6b6b", 12, 700);
  const colW = (SVG_W - PAD * 2) / ROLE_DEFS.length;
  ROLE_DEFS.forEach(([key, label], i) => {
    const cx = PAD + i * colW,
      cy = legendY + 22;
    legend +=
      rect(cx, cy, 18, 18, roles[key], 4) +
      `<rect x="${cx}" y="${cy}" width="18" height="18" rx="4" fill="none" stroke="rgba(0,0,0,0.12)"/>`;
    legend += txt(cx + 26, cy + 8, label, "#0A0A0A", 12, 700);
    legend += txt(cx + 26, cy + 23, roles[key], "#6b6b6b", 11, 400);
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_W}" height="${SVG_H}" viewBox="0 0 ${SVG_W} ${SVG_H}">
    <defs>
      <linearGradient id="mkGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${roles.accent}"/><stop offset="1" stop-color="${roles.accent2}"/></linearGradient>
      <filter id="mkBlur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="8"/></filter>
    </defs>
    ${rect(0, 0, SVG_W, SVG_H, "#FAFAF7")}
    ${txt(PAD, 74, title, "#0A0A0A", 28, 800)}
    ${txt(PAD, 100, `Mockup-Vorschau · ${harmony}`, "#6b6b6b", 13, 600)}
    ${stripSvg}
    ${tiles}
    ${legend}
    ${txt(PAD, SVG_H - 24, "© SAEK Pigment - Sandro Fankhauser", "#9a9a9a", 12, 400)}
  </svg>`;
}

function downloadMockupPng(payload) {
  const svg = buildMockupSvg(payload);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  const img = new Image();

  img.onload = () => {
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = SVG_W * scale;
    canvas.height = SVG_H * scale;
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);

    canvas.toBlob((png) => downloadBlob(png, `${slugify(payload.title)}-mockup.png`), "image/png");
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    alert("PNG-Export fehlgeschlagen.");
  };
  img.src = url;
}
