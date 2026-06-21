/**
 * Code Output Style – Erkennt Antworten, die vollständig in ``` eingewickelt sind,
 * und rendert sie mit einfachem Syntax-Highlighting.
 */

const CODE_FENCE_REGEX = /^\s*```(\w*)\n([\s\S]*?)\n```\s*$/;

function detect(text) {
  return CODE_FENCE_REGEX.test(text.trim());
}

const KEYWORDS = [
  "function",
  "const",
  "let",
  "var",
  "return",
  "if",
  "else",
  "for",
  "while",
  "class",
  "import",
  "export",
  "from",
  "default",
  "async",
  "await",
  "try",
  "catch",
  "throw",
  "new",
  "this",
  "typeof",
  "switch",
  "case",
  "break",
  "continue",
  "do",
  "in",
  "of",
  "yield",
  "def",
  "print",
  "elif",
  "lambda",
  "with",
  "as",
  "pass",
  "raise",
  "True",
  "False",
  "None",
];

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function highlightCode(code) {
  // HTML escapen
  code = escapeHtml(code);

  // Strings (double and single quotes)
  code = code.replace(/(["'`])(?:(?!\1|\\).|\\.)*\1/g, '<span class="code-string">$&</span>');

  // Einzeilige Kommentare
  code = code.replace(
    /(\/\/.*$|#(?!include|define|if).*$)/gm,
    '<span class="code-comment">$&</span>',
  );

  // Keywords (nur ganze Wörter, nicht innerhalb von bereits markierten spans)
  const kwPattern = new RegExp(`\\b(${KEYWORDS.join("|")})\\b`, "g");
  code = code.replace(kwPattern, (match, kw, offset, str) => {
    // Prüfen, ob wir uns bereits innerhalb eines <span> befinden
    const before = str.substring(0, offset);
    const openTags = (before.match(/<span[^>]*>/g) || []).length;
    const closeTags = (before.match(/<\/span>/g) || []).length;
    if (openTags > closeTags) return match;
    return `<span class="code-keyword">${match}</span>`;
  });

  // Zahlen
  code = code.replace(/\b(\d+\.?\d*)\b/g, (match, num, offset, str) => {
    const before = str.substring(0, offset);
    const openTags = (before.match(/<span[^>]*>/g) || []).length;
    const closeTags = (before.match(/<\/span>/g) || []).length;
    if (openTags > closeTags) return match;
    return `<span class="code-number">${match}</span>`;
  });

  return code;
}

function render(text, el) {
  const match = text.trim().match(CODE_FENCE_REGEX);
  const lang = match[1] || "";
  const code = match[2];

  const langLabel = lang ? `<span class="code-lang">${escapeHtml(lang)}</span>` : "";
  el.innerHTML = `<div class="code-output">${langLabel}<pre><code>${highlightCode(code)}</code></pre></div>`;
}

export default { name: "code", detect, render };
