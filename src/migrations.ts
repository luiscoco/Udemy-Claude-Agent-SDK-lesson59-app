import { readFile } from "node:fs/promises";
export async function legacy() {
  const before = await readFile(
    new URL("../fixtures/legacy-agent.ts.txt", import.meta.url),
    "utf8",
  );
  const after = before
    .replace("@anthropic-ai/claude-code", "@anthropic-ai/claude-agent-sdk")
    .replace(
      "/* REVIEW_SYSTEM_PROMPT_AND_SETTINGS */",
      'systemPrompt: "Classroom expense assistant", settingSources: [], tools: [], permissionMode: "dontAsk", maxTurns: 3',
    );
  const checks = {
    modernImport: after.includes("@anthropic-ai/claude-agent-sdk"),
    explicitPrompt: after.includes("systemPrompt:"),
    explicitSettings: after.includes("settingSources: []"),
    noHistoricalImport: !after.includes("@anthropic-ai/claude-code"),
  };
  return {
    before,
    after,
    checks,
    scope:
      "A bounded illustrative source transformation, not a general-purpose codemod. The fixture is never evaluated; the real modern SDK runner executes the regression task.",
  };
}
