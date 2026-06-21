/**
 * Subagent-Tool – Delegiert eine Aufgabe an einen Sub-Agenten.
 * Startet einen neuen AI-Agent-Prozess mit dem gegebenen Prompt via CLI-Modus.
 */

async function execute(input) {
  const args = ["bun", "run", "server.js", "-p", input.prompt];
  if (input.system_prompt) {
    args.push("-s", input.system_prompt);
  }

  const childDepth = parseInt(process.env.AGENT_DEPTH || "0", 10) + 1;
  const proc = Bun.spawn(args, {
    stdout: "pipe",
    stderr: "inherit",
    env: { ...process.env, AGENT_DEPTH: String(childDepth) },
  });

  const stdout = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    return `Subagent failed with exit code ${exitCode}\nStdout: ${stdout}`;
  }

  return stdout.trim();
}

export default {
  type: "function",
  function: {
    name: "subagent",
    description:
      "Delegate a task to a sub-agent. The sub-agent is a separate AI agent that can use all available tools to complete the task. Use this for complex multi-step tasks that benefit from independent execution.",
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "The task description or prompt to send to the sub-agent.",
        },
        system_prompt: {
          type: "string",
          description:
            "Optional custom system prompt for the sub-agent. Use this to give the sub-agent a specialized role or persona (e.g. 'Du bist ein Security-Experte').",
        },
      },
      required: ["prompt"],
    },
  },
  execute,
};
