// Gemeinsame Lint-Regeln für Browser- (public/) und Server-/Tool-Code (Bun).
const sharedRules = {
  "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
  "no-undef": "error",
  "no-constant-condition": "error",
};

// Web-APIs, die im Browser (public/) global verfügbar sind.
const browserGlobals = {
  window: "readonly",
  document: "readonly",
  localStorage: "readonly",
  navigator: "readonly",
  alert: "readonly",
  console: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  requestAnimationFrame: "readonly",
  fetch: "readonly",
  URL: "readonly",
  Blob: "readonly",
  FileReader: "readonly",
  Image: "readonly",
  Audio: "readonly",
};

// Globals der Bun/Node-Laufzeit (Server + CLI-Tools).
const nodeGlobals = {
  Bun: "readonly",
  process: "readonly",
  console: "readonly",
  fetch: "readonly",
  URL: "readonly",
  Response: "readonly",
  Request: "readonly",
  setTimeout: "readonly",
};

export default [
  {
    files: ["public/**/*.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "module", globals: browserGlobals },
    rules: sharedRules,
  },
  {
    files: ["server.js", "server/**/*.js", "tools/**/*.js", "programmable/**/*.js", "*.mjs"],
    languageOptions: { ecmaVersion: 2022, sourceType: "module", globals: nodeGlobals },
    rules: sharedRules,
  },
];
