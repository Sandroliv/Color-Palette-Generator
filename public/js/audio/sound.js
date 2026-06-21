/* ── UI-Sounds (Web Audio API) ────────────────────
   Samples werden EINMAL dekodiert und bei Bedarf sofort
   (null Latenz) und überlappend abgespielt — kein Warten.
   - Hover über Farbflächen  → Klick-Sound
   - Palette randomisieren    → Space-Sound */

const AudioCtx = window.AudioContext || window.webkitAudioContext;

let ctx = null;
const buffers = {}; // name -> AudioBuffer

function loadSample(name, url) {
  fetch(url)
    .then((res) => res.arrayBuffer())
    .then((data) => ctx.decodeAudioData(data))
    .then((decoded) => {
      buffers[name] = decoded;
    })
    .catch(() => {
      /* Asset fehlt / nicht dekodierbar → still */
    });
}

if (AudioCtx) {
  ctx = new AudioCtx();
  loadSample("hover", "assets/Click Sound Effects.wav");
  loadSample("space", "assets/Swoosh.wav");
}

function play(name, volume) {
  const buffer = buffers[name];
  if (!ctx || !buffer) return;
  if (ctx.state !== "running") ctx.resume(); // nach erster Geste freigeschaltet
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start();
}

export function playHoverSound() {
  play("hover", 0.35);
}
export function playSpaceSound() {
  play("space", 0.8);
}

// Der Audio-Kontext startet (Browser-Policy) suspendiert; erste Nutzergeste schaltet ihn frei.
const resume = () => {
  if (ctx && ctx.state !== "running") ctx.resume();
};
["pointerdown", "keydown", "touchstart"].forEach((evt) =>
  window.addEventListener(evt, resume, { passive: true }),
);
