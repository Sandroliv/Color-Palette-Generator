import jsonStyle from "./json.js";
import codeStyle from "./code.js";
import mdStyle from "./md.js";

// json → code → md: most specific first
const allStyles = [jsonStyle, codeStyle, mdStyle];

export async function renderOutput(text, el) {
  for (const style of allStyles) {
    if (style.detect(text)) {
      style.render(text, el);
      return;
    }
  }

  el.textContent = text;
}
