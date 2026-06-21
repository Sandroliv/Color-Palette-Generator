import { spawnSync } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";

/**
 * Play-MP3-Tool – Plays an MP3 file using mpg123.
 */

async function execute(input) {
  const filePath = resolve(input.path);

  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${input.path}`);
  }

  const result = spawnSync("mpg123", ["-q", filePath], { stdio: "inherit" });

  if (result.error) {
    throw new Error(`Failed to play file: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`mpg123 exited with code ${result.status}`);
  }

  return `Playing finished: ${input.path}`;
}

export default {
  type: "function",
  function: {
    name: "play_mp3",
    description:
      "Play an MP3 audio file from a given file path. Use this when you want to play a sound or music file.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The relative or absolute path to the MP3 file to play.",
        },
      },
      required: ["path"],
    },
  },
  execute,
};
