/**
 * Markdown Output Style – Erkennt Markdown-Muster und rendert sie als HTML.
 * Leichtgewichtige, regex-basierte Implementierung ohne externe Abhängigkeiten.
 */

const MD_PATTERNS = [
  /^#{1,6}\s+/m, // Headings
  /\*\*[^*]+\*\*/, // Bold
  /\*[^*]+\*/, // Italic
  /^[-*]\s+/m, // Unordered list
  /^\d+\.\s+/m, // Ordered list
  /`[^`]+`/, // Inline code
  /```[\s\S]*?```/, // Code block
  /\[.+?\]\(.+?\)/, // Links
];

function detect(text) {
  let matchCount = 0;
  for (const pattern of MD_PATTERNS) {
    if (pattern.test(text)) matchCount++;
    if (matchCount >= 2) return true;
  }
  return false;
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function render(text, el) {
  let html = text;

  // 1. Code-Blöcke extrahieren und schützen (vor allen anderen Transformationen)
  const codeBlocks = [];
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(`<pre class="md-code-block"><code>${escapeHtml(code.trim())}</code></pre>`);
    return `%%CODEBLOCK_${idx}%%`;
  });

  // 2. Inline-Code schützen
  const inlineCodes = [];
  html = html.replace(/`([^`]+)`/g, (_, code) => {
    const idx = inlineCodes.length;
    inlineCodes.push(`<code class="md-inline-code">${escapeHtml(code)}</code>`);
    return `%%INLINECODE_${idx}%%`;
  });

  // 3. HTML-Escaping für den restlichen Text
  html = escapeHtml(html);

  // 4. Headings (Level = Anzahl der #)
  html = html.replace(/^(#{1,6})\s+(.+)$/gm, (_, hashes, content) => {
    const level = hashes.length;
    return `<h${level}>${content}</h${level}>`;
  });

  // 5. Bold und Italic
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  // 6. Links (nur http/https erlaubt, um javascript: URIs zu verhindern)
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, (_, label, url) => {
    if (/^https?:\/\//i.test(url)) {
      return `<a href="${url}" target="_blank" rel="noopener">${label}</a>`;
    }
    return `${label} (${url})`;
  });

  // 7. Ungeordnete Listen
  html = html.replace(/(^[-*]\s+.+(\n|$))+/gm, (block) => {
    const items = block
      .trim()
      .split("\n")
      .map((line) => `<li>${line.replace(/^[-*]\s+/, "")}</li>`)
      .join("");
    return `<ul>${items}</ul>`;
  });

  // 8. Geordnete Listen
  html = html.replace(/(^\d+\.\s+.+(\n|$))+/gm, (block) => {
    const items = block
      .trim()
      .split("\n")
      .map((line) => `<li>${line.replace(/^\d+\.\s+/, "")}</li>`)
      .join("");
    return `<ol>${items}</ol>`;
  });

  // 9. Horizontale Linie
  html = html.replace(/^---$/gm, "<hr>");

  // 10. Absätze (doppelte Zeilenumbrüche)
  html = html.replace(/\n{2,}/g, "</p><p>");
  html = `<p>${html}</p>`;

  // Leere <p>-Tags bereinigen
  html = html.replace(/<p>\s*<\/p>/g, "");
  html = html.replace(/<p>\s*(<h[1-6]>)/g, "$1");
  html = html.replace(/(<\/h[1-6]>)\s*<\/p>/g, "$1");
  html = html.replace(/<p>\s*(<ul>)/g, "$1");
  html = html.replace(/(<\/ul>)\s*<\/p>/g, "$1");
  html = html.replace(/<p>\s*(<ol>)/g, "$1");
  html = html.replace(/(<\/ol>)\s*<\/p>/g, "$1");
  html = html.replace(/<p>\s*(<hr>)/g, "$1");
  html = html.replace(/(<hr>)\s*<\/p>/g, "$1");
  html = html.replace(/<p>\s*(<pre)/g, "$1");
  html = html.replace(/(<\/pre>)\s*<\/p>/g, "$1");

  // 11. Einzelne Zeilenumbrüche → <br>
  html = html.replace(/\n/g, "<br>");

  // 12. Code-Blöcke und Inline-Code zurücksetzen
  codeBlocks.forEach((block, idx) => {
    html = html.replace(`%%CODEBLOCK_${idx}%%`, block);
  });
  inlineCodes.forEach((code, idx) => {
    html = html.replace(`%%INLINECODE_${idx}%%`, code);
  });

  el.innerHTML = `<div class="md-output">${html}</div>`;
}

export default { name: "md", detect, render };
