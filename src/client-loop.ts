import Anthropic from "@anthropic-ai/sdk";
import { ROLE, checkPolicy } from "./policy.js";
export async function clientLoop(emit: (e: any) => void, signal: AbortSignal) {
  const client = new Anthropic({ maxRetries: 0, timeout: 60000 });
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content:
        "Use check_policy for a classroom meal of $47, then return its decision marker only.",
    },
  ];
  let calls = 0,
    last: any;
  emit({
    type: "observation",
    observation: {
      kind: "configuration",
      detail: {
        platform: "Client SDK",
        loopOwner: "this application",
        maxRounds: 3,
        tool: "check_policy",
        maxTokens: 180,
      },
    },
  });
  for (let round = 0; round < 3; round++) {
    const message = await client.messages.create(
      {
        model: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
        max_tokens: 180,
        system: ROLE + " Always call check_policy once before answering.",
        messages,
        tools: [
          {
            name: "check_policy",
            description: "Classroom meal policy; no payments.",
            input_schema: {
              type: "object",
              properties: { amount: { type: "integer" } },
              required: ["amount"],
              additionalProperties: false,
            },
          },
        ],
      },
      { signal },
    );
    last = message;
    emit({
      type: "observation",
      observation: {
        kind: "client-message",
        detail: {
          id: message.id,
          stopReason: message.stop_reason,
          usage: message.usage,
        },
      },
    });
    messages.push({ role: "assistant", content: message.content });
    const uses = message.content.filter((b) => b.type === "tool_use");
    if (!uses.length) {
      const text = message.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      emit({ type: "text", text });
      emit({
        type: "observation",
        observation: {
          kind: "native-path",
          detail: {
            platform: "Client SDK",
            loopOwner: "application",
            toolCalls: calls,
          },
        },
      });
      emit({
        type: "result",
        result: {
          platform: "Client SDK",
          nativeMessage: message,
          stop_reason: message.stop_reason,
        },
      });
      return {
        platform: "Client SDK",
        success: message.stop_reason === "end_turn",
        text,
        toolCalls: calls,
        native: message,
      };
    }
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const use of uses) {
      if (use.name !== "check_policy") throw new Error("Unregistered tool");
      const value = checkPolicy((use.input as any).amount);
      calls++;
      emit({
        type: "observation",
        observation: {
          kind: "custom-tool",
          detail: { ...value, toolUseId: use.id, loopOwner: "application" },
        },
      });
      results.push({
        type: "tool_result",
        tool_use_id: use.id,
        content: JSON.stringify(value),
      });
    }
    messages.push({ role: "user", content: results });
  }
  throw new Error("Client SDK loop reached its explicit three-round limit.");
}
