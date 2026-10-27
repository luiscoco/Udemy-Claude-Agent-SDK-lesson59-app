import {
  query,
  tool,
  createSdkMcpServer,
  type SDKUserMessage,
  type Options,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { privateEnv, cliExecutable, runProcess } from "./processes.js";
import { ROLE, TASK, checkPolicy } from "./policy.js";
export async function sdk(
  w: any,
  emit: (e: any) => void,
  signal: AbortSignal,
  prompt = TASK,
  resume?: string,
  custom = false,
) {
  const observe = (kind: string, detail: any) =>
    emit({ type: "observation", observation: { kind, detail } });
  let handlerCalls = 0,
    hookCalls = 0;
  const server = createSdkMcpServer({
    name: "expense59",
    version: "1.0.0",
    tools: [
      tool(
        "check_policy",
        "Classroom meal policy lookup. No payment side effects.",
        { amount: z.number().int().min(0).max(10000) },
        async ({ amount }) => {
          handlerCalls++;
          const value = checkPolicy(amount);
          observe("custom-tool", value);
          return { content: [{ type: "text", text: JSON.stringify(value) }] };
        },
      ),
    ],
  });
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  const options: Options = {
    cwd: w.cwd,
    env: privateEnv(w),
    model: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
    tools: [],
    allowedTools: custom ? ["mcp__expense59__check_policy"] : [],
    permissionMode: "dontAsk",
    settingSources: [],
    systemPrompt: ROLE,
    maxTurns: 6,
    maxBudgetUsd: 0.2,
    effort: "low",
    thinking: { type: "disabled" },
    abortController: controller,
    resume,
    ...(custom
      ? {
          mcpServers: { expense59: server },
          hooks: {
            PreToolUse: [
              {
                hooks: [
                  async () => {
                    hookCalls++;
                    observe("hook", {
                      event: "PreToolUse",
                      decision: "continue through native permissions",
                    });
                    return {};
                  },
                ],
              },
            ],
          },
        }
      : {}),
  };
  observe("configuration", {
    platform: "Agent SDK",
    loopOwner: "SDK runtime on this host",
    cwd: w.cwd,
    resume: resume ?? null,
    tools: [],
    allowedTools: options.allowedTools,
    settingSources: [],
    maxTurns: 6,
    maxBudgetUsd: 0.2,
  });
  observe("native-path", { platform: "Agent SDK", pid: process.pid });
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  async function* input(): AsyncGenerator<SDKUserMessage> {
    yield {
      type: "user",
      session_id: "",
      parent_tool_use_id: null,
      message: { role: "user", content: prompt },
    };
    await gate;
  }
  const run = query({ prompt: custom ? input() : prompt, options });
  let result: any;
  try {
    for await (const m of run) {
      if (m.type === "assistant")
        for (const b of m.message.content) {
          if (b.type === "text") emit({ type: "text", text: b.text });
          if (b.type === "tool_use")
            observe("native-tool", { name: b.name, input: b.input });
        }
      if (m.type === "result") {
        result = m;
        emit({ type: "result", result: m });
        if (custom) {
          release();
          break;
        }
      }
    }
  } finally {
    release();
    run.close();
    signal.removeEventListener("abort", abort);
  }
  if (!result) throw new Error("SDK produced no terminal result.");
  return {
    platform: "Agent SDK",
    text: result.subtype === "success" ? result.result : "",
    success: result.subtype === "success",
    sessionId: result.session_id,
    native: result,
    handlerCalls,
    hookCalls,
  };
}
export async function cli(w: any, emit: (e: any) => void, signal: AbortSignal) {
  const args = [
    "-p",
    TASK,
    "--output-format",
    "json",
    "--model",
    process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
    "--tools",
    "",
    "--permission-mode",
    "dontAsk",
    "--max-turns",
    "3",
    "--max-budget-usd",
    "0.20",
    "--no-session-persistence",
    "--system-prompt",
    ROLE,
    "--setting-sources",
    "",
  ];
  emit({
    type: "observation",
    observation: {
      kind: "configuration",
      detail: {
        platform: "Claude Code CLI",
        loopOwner: "local CLI subprocess",
        args,
        key: "inherited privately, never printed",
      },
    },
  });
  const p = await runProcess(cliExecutable(), args, {
    cwd: w.cwd,
    env: privateEnv(w),
    signal,
  });
  if (p.exitCode !== 0)
    throw new Error("CLI exited " + p.exitCode + ": " + p.stderr.slice(-600));
  const native = JSON.parse(p.stdout);
  emit({ type: "text", text: native.result || "" });
  emit({ type: "result", result: native });
  emit({
    type: "observation",
    observation: {
      kind: "native-path",
      detail: { platform: "CLI", actualExitCode: p.exitCode, signal: p.signal },
    },
  });
  return {
    platform: "Claude Code CLI",
    success: !native.is_error,
    text: native.result || "",
    sessionId: native.session_id,
    native,
    actualExitCode: p.exitCode,
  };
}
