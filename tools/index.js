import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

import readFile from "./read_file.js";
import listFiles from "./list_files.js";
import bash from "./bash.js";
import editFile from "./edit_file.js";
import codeSearch from "./code-search.js";
import playMp3 from "./play_mp3.js";
import subagent from "./subagent.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(__dirname, "config.json"), "utf-8"));

const allTools = [readFile, listFiles, bash, editFile, codeSearch, playMp3, subagent];

export const tools = allTools.filter((tool) => config[tool.function.name] !== false);
export { readFile, listFiles, bash, editFile, codeSearch, playMp3, subagent };
