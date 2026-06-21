import React, { useMemo, useState } from "react";

type PaletteCard = {
  name: string;
  hex: string;
  rgb: string;
  score: number;
  prompt: string;
  cta?: string;
};

const seedPalettes: PaletteCard[] = [
  {
    name: "Warm Ivory",
    hex: "#F4EBDD",
    rgb: "244, 235, 221",
    score: 92,
    prompt: "Soft editorial neutrals, warm paper, restrained contrast.",
  },
  {
    name: "Ink Signal",
    hex: "#121212",
    rgb: "18, 18, 18",
    score: 88,
    prompt: "Technical minimalism, Swiss grid, crisp hierarchy.",
  },
  {
    name: "Dust Blue",
    hex: "#AFC2D4",
    rgb: "175, 194, 212",
    score: 84,
    prompt: "Muted ambient blue, studio calm, subtle depth.",
  },
  {
    name: "Clay Light",
    hex: "#D7C0A4",
    rgb: "215, 192, 164",
    score: 81,
    prompt: "Warm mineral tone, quiet surface, tactile softness.",
  },
  {
    name: "Signal Lime",
    hex: "#C9D96A",
    rgb: "201, 217, 106",
    score: 76,
    prompt: "Single vivid accent for emphasis and scanability.",
  },
  {
    name: "Fog Grey",
    hex: "#E7E3DC",
    rgb: "231, 227, 220",
    score: 89,
    prompt: "Neutral field color, background support, no noise.",
  },
];

const randomMix = [
  "Quiet contrast",
  "Warm minimalism",
  "Swiss editorial",
  "Monochrome discipline",
  "Soft paper grain",
  "Signal clarity",
];

function formatContrast(score: number) {
  return `${score}/100`;
}

export default function AIColorPaletteGenerator() {
  const [locked, setLocked] = useState(false);
  const [activeIndex, setActiveIndex] = useState(1);
  const [paletteSeed, setPaletteSeed] = useState(0);

  const palettes = useMemo(() => {
    const shift = paletteSeed % seedPalettes.length;
    return seedPalettes.map((entry, index) => seedPalettes[(index + shift) % seedPalettes.length]);
  }, [paletteSeed]);

  const activePalette = palettes[activeIndex];

  function handleGenerate() {
    if (locked) return;
    setPaletteSeed((value) => value + 1);
    setActiveIndex((value) => (value + 1) % seedPalettes.length);
  }

  function handleLockToggle() {
    setLocked((value) => !value);
  }

  return (
    <div className="min-h-screen bg-[#F6F1E8] text-[#111111]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-4 py-4 md:px-6 md:py-6">
        <header className="mb-4 border-b border-neutral-300/50 pb-4 md:mb-6">
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.28em] text-neutral-500">
                AI Color Palette Generator
              </p>
              <h1 className="mt-2 max-w-4xl font-sans text-4xl font-medium uppercase leading-[0.88] tracking-[-0.06em] md:text-6xl lg:text-7xl">
                Technical minimalism meets Swiss editorial precision.
              </h1>
            </div>
            <div className="hidden text-right md:block">
              <p className="font-mono text-[11px] uppercase tracking-tight text-neutral-500">Status</p>
              <p className="mt-1 font-mono text-[11px] tracking-tight text-neutral-900">
                {locked ? "LOCKED" : "READY"}
              </p>
            </div>
          </div>
        </header>

        <div className="grid flex-1 gap-4 md:grid-cols-[340px_minmax(0,1fr)] md:gap-5">
          <aside className="border border-neutral-300/50 bg-white/55 p-4 shadow-[0_24px_80px_rgba(17,17,17,0.05)] backdrop-blur-[10px] md:p-5">
            <div className="flex items-center justify-between border-b border-neutral-300/50 pb-3">
              <div>
                <p className="font-sans text-[11px] uppercase tracking-[0.24em] text-neutral-500">Control panel</p>
                <h2 className="mt-2 font-sans text-2xl font-medium uppercase tracking-[-0.04em]">Generate</h2>
              </div>
              <span className="font-mono text-[11px] tracking-tight text-neutral-500">v01</span>
            </div>

            <div className="mt-5 space-y-5">
              <div className="border border-neutral-300/50 bg-[#FBF8F2] p-4">
                <div className="flex items-baseline justify-between gap-4 border-b border-neutral-300/50 pb-2">
                  <span className="font-sans text-[11px] uppercase tracking-[0.24em] text-neutral-500">Active palette</span>
                  <span className="font-mono text-[11px] tracking-tight text-neutral-900">{activeIndex + 1}/{palettes.length}</span>
                </div>
                <div className="mt-4 space-y-2">
                  <p className="font-sans text-2xl uppercase tracking-[-0.05em]">{activePalette.name}</p>
                  <p className="font-mono text-[11px] tracking-tight text-neutral-700">HEX {activePalette.hex}</p>
                  <p className="font-mono text-[11px] tracking-tight text-neutral-700">RGB {activePalette.rgb}</p>
                  <p className="font-mono text-[11px] tracking-tight text-neutral-700">CONTRAST {formatContrast(activePalette.score)}</p>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="group inline-flex w-full items-center justify-between border border-neutral-300/50 px-4 py-3 text-left font-sans text-sm uppercase tracking-[0.18em] transition duration-200 hover:bg-[#111111] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={locked}
                >
                  <span>Generate</span>
                  <span className="font-mono text-[11px] tracking-tight">{locked ? "inactive" : "run"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleLockToggle}
                  className="group inline-flex w-full items-center justify-between border border-neutral-300/50 px-4 py-3 text-left font-sans text-sm uppercase tracking-[0.18em] transition duration-200 hover:bg-[#111111] hover:text-white"
                >
                  <span>{locked ? "Unlock" : "Lock"}</span>
                  <span className="font-mono text-[11px] tracking-tight">{locked ? "frozen" : "editable"}</span>
                </button>
              </div>

              <div className="border-t border-neutral-300/50 pt-4">
                <p className="font-sans text-[11px] uppercase tracking-[0.24em] text-neutral-500">Prompt</p>
                <p className="mt-3 font-mono text-[11px] leading-5 tracking-tight text-neutral-800">
                  {activePalette.prompt}
                </p>
              </div>

              <div className="border-t border-neutral-300/50 pt-4">
                <p className="font-sans text-[11px] uppercase tracking-[0.24em] text-neutral-500">Mood tokens</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {randomMix.map((token) => (
                    <span
                      key={token}
                      className="border border-neutral-300/50 px-2 py-1 font-mono text-[11px] tracking-tight text-neutral-700"
                    >
                      {token}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          <main className="border border-neutral-300/50 bg-white/50 p-4 shadow-[0_24px_80px_rgba(17,17,17,0.05)] backdrop-blur-[8px] md:p-5">
            <div className="flex items-center justify-between border-b border-neutral-300/50 pb-3">
              <div>
                <p className="font-sans text-[11px] uppercase tracking-[0.24em] text-neutral-500">Interactive palette field</p>
                <h2 className="mt-2 font-sans text-2xl font-medium uppercase tracking-[-0.04em]">Color cards</h2>
              </div>
              <p className="max-w-[16rem] text-right font-mono text-[11px] tracking-tight text-neutral-500">
                Hover a card to reveal data, then lock the chosen direction.
              </p>
            </div>

            <div className="mt-5 grid gap-px bg-neutral-300/50 md:grid-cols-2 xl:grid-cols-3">
              {palettes.map((palette, index) => {
                const isActive = index === activeIndex;
                return (
                  <button
                    key={`${palette.hex}-${palette.name}`}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    className={[
                      "group relative aspect-[4/3] overflow-hidden border-0 rounded-none text-left transition duration-300",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-0",
                      isActive ? "z-10" : "",
                    ].join(" ")}
                    style={{ backgroundColor: palette.hex }}
                  >
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(17,17,17,0.08))]" />
                    <div className="absolute inset-x-0 top-0 h-px bg-black/20 transition-all duration-300 group-hover:h-1 group-hover:bg-black/35" />
                    <div className="absolute inset-x-0 bottom-0 flex translate-y-2 items-end justify-between border-t border-black/10 bg-[rgba(255,255,255,0.62)] px-4 py-3 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                      <div>
                        <p className="font-sans text-[11px] uppercase tracking-[0.26em] text-neutral-600">{palette.name}</p>
                        <p className="mt-1 font-mono text-[11px] tracking-tight text-neutral-900">HEX {palette.hex}</p>
                      </div>
                      <p className="font-mono text-[11px] tracking-tight text-neutral-900">{formatContrast(palette.score)}</p>
                    </div>

                    <div className="flex h-full flex-col justify-between p-4 text-[#111111] mix-blend-difference">
                      <div className="flex items-start justify-between gap-4">
                        <span className="font-sans text-[11px] uppercase tracking-[0.26em]">{isActive ? "Selected" : `Card ${index + 1}`}</span>
                        <span className="font-mono text-[11px] tracking-tight">{formatContrast(palette.score)}</span>
                      </div>

                      <div className="space-y-2">
                        <h3 className="max-w-[10ch] font-sans text-2xl uppercase leading-[0.9] tracking-[-0.05em] md:text-[2.4rem]">
                          {palette.name}
                        </h3>
                        <div className="h-px w-full bg-current opacity-30 transition-all duration-300 group-hover:opacity-60" />
                        <div className="overflow-hidden">
                          <div className="translate-y-0 transition-transform duration-300 group-hover:-translate-y-5">
                            <p className="font-mono text-[11px] tracking-tight">HEX {palette.hex}</p>
                            <p className="font-mono text-[11px] tracking-tight">RGB {palette.rgb}</p>
                            <p className="font-mono text-[11px] tracking-tight">AI {palette.prompt}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
