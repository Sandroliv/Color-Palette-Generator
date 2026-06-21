/**
 * JSON Output Style – Erkennt JSON-Antworten und rendert sie formatiert mit Syntax-Highlighting.
 */

function detect(text) {
  const trimmed = text.trim();
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      JSON.parse(trimmed);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

function syntaxHighlight(json) {
  // Escapen für HTML
  json = json.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return json.replace(
    /("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = "json-number";
      if (match.startsWith('"')) {
        cls = match.endsWith(":") ? "json-key" : "json-string";
      } else if (/true|false/.test(match)) {
        cls = "json-boolean";
      } else if (match === "null") {
        cls = "json-null";
      }
      return `<span class="${cls}">${match}</span>`;
    },
  );
}

function render(text, el) {
  const parsed = JSON.parse(text.trim());
  const formatted = JSON.stringify(parsed, null, 2);
  el.innerHTML = `<pre class="json-output">${syntaxHighlight(formatted)}</pre>`;
}

export default { name: "json", detect, render };
