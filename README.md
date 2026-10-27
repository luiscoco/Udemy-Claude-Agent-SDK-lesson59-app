# Claude Agent SDK · Lesson 59 · SDK vs Managed Agents and migrations

Five student pages, thirteen source-linked UML steps and nine actual platform and migration experiments.

## What you will learn

- Distinguish four execution paths: Agent SDK and Claude Code CLI supply a local agent runtime. A Client SDK calls the Messages API; your application dispatches tools. Managed Agents hosts the harness and retains session events server-side.
- Create a Managed Agents lifecycle: Create a dedicated agent, cloud environment and session; open the event stream, send a user event and observe the native idle event after the reply. The model key stays on the server.
- Compare ownership before benchmarks: Inspect who owns the loop, process, tools and state. Run the same small expense policy on two platforms, but do not infer general quality, latency or price rankings from one classroom sample.
- Choose from workload constraints: Embedded callbacks and in-process tools favor operating the Agent SDK. Long asynchronous work may fit Managed Agents. Conflicting retention requirements need review before a platform choice; neither a label nor local hosting guarantees compliance.
- Review historical SDK migration: Inspect an obsolete import as text, replace the package reference and review explicit prompts, settings, tools and permissions. The old package is never installed. A real modern SDK run checks the small regression task.
- Map primitives and verify state: Port a small function into an actual tool() / MCP handler, observe a real hook and distinguish delegation from conversation handoff. Compare SDK session_id/resume with a remote retained Managed session. Working files need their own persistence plan.

## Configure and run

```powershell
git clone https://github.com/luiscoco/Udemy-Claude-Agent-SDK-lesson59-app.git
cd .\Udemy-Claude-Agent-SDK-lesson59-app
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
npm start
```

From presentations: `cd .\agent-sdk\lesson59-platform-migrations`. Open http://127.0.0.1:3159. Node 24+, model API credit, and Windows Git Bash if required.

## Create your .env file

Preserve the real file locally and enter your own key. Restart after edits. Existing shell values take precedence. No secret is included in source.

```dotenv
ANTHROPIC_API_KEY=your_api_key
CLAUDE_MODEL=claude-sonnet-4-6
PORT=3159
# CLAUDE_CODE_GIT_BASH_PATH=C:/Program Files/Git/bin/bash.exe
```

## Run source and migration checks

Unit tests verify policy boundaries, fixed inputs, retention conflicts and the historical source transformation without a model call. Legacy fixtures are never evaluated or installed.

```powershell
npm test
```

## Compare real execution paths

These commands make real model requests. Managed modes create dedicated short-lived resources, delete their own sessions/environments and archive their own agent configuration. IDs are journalled privately under .runtime for audit. Existing lesson resources are never used or changed.

```powershell
npm run pipeline -- sdk
npm run pipeline -- cli
npm run pipeline -- client
npm run pipeline -- managed
npm run eval
```

## Inspect migrations, state and cleanup

Toolport executes the actual modern Claude tool/MCP/hook path, not OpenAI. Session makes four actual turns and compares recall of an unpredictable code. The SDK transcript lives in a temporary local workspace; Managed history is remote until cleanup. No cron schedule, public service, payment or remote business-system integration is created.

```powershell
npm run pipeline -- decision
npm run pipeline -- legacy
npm run pipeline -- toolport
npm run pipeline -- session
npm run cleanup
# .runtime/runs/<run-id>/evidence.json
# .runtime/managed-resources/<owner-id>.json
```

## How the app was built


### 1. Choose a fixed experiment

The browser selects a reviewed experiment. Validate the mode and reject arbitrary commands, paths and foreign session IDs.

Source: src/protocol.ts

```typescript
if (
    !value ||
    Object.keys(value).some((k) => k !== "mode") ||
    !MODES.includes(value.mode)
  )
    throw new Error("Choose a listed platform or migration experiment.");
  return { mode: value.mode };
}
```

### 2. Configure the local SDK boundary

Run the SDK in a fresh temporary workspace with explicit settings, tools, permissions and finite limits. The SDK runtime owns local orchestration; these settings are not a complete operating-system sandbox.

Source: src/local.ts

```typescript
const options: Options = {
    cwd: w.cwd,
    env: privateEnv(w),
    model: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
    tools: [],
    allowedTools: custom ? ["mcp__expense59__check_policy"] : [],
    permissionMode: "dontAsk",
    settingSources: [],
    systemPrompt: ROLE,
```

### 3. Run the actual Agent SDK loop

Consume real SDK messages and terminal results. In-process MCP mode keeps streaming input open while the tool handler runs. A new query can resume a retained local session ID.

Source: src/local.ts

```typescript
const run = query({ prompt: custom ? input() : prompt, options });
  let result: any;
  try {
    for await (const m of run) {
      if (m.type === "assistant")
        for (const b of m.message.content) {
          if (b.type === "text") emit({ type: "text", text: b.text });
          if (b.type === "tool_use")
```

### 4. Invoke the actual headless CLI

Spawn the installed native CLI without a shell, pass fixed arguments and observe its actual exit code. The private launching environment supplies the API key; stdout contains native JSON.

Source: src/local.ts

```typescript
const p = await runProcess(cliExecutable(), args, {
    cwd: w.cwd,
    env: privateEnv(w),
    signal,
  });
  if (p.exitCode !== 0)
    throw new Error("CLI exited " + p.exitCode + ": " + p.stderr.slice(-600));
  const native = JSON.parse(p.stdout);
```

### 5. Make a Client SDK model request

The Client SDK sends a Messages request and returns content blocks. It does not execute application business functions for you. This app bounds the tool loop to three rounds.

Source: src/client-loop.ts

```typescript
const message = await client.messages.create(
      {
        model: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
        max_tokens: 180,
        system: ROLE + " Always call check_policy once before answering.",
        messages,
        tools: [
          {
```

### 6. Dispatch a tool and preserve its ID

Validate the requested tool name and its amount, call trusted business logic, then return a tool_result linked to the original tool_use ID. This dispatch loop belongs to the application.

Source: src/client-loop.ts

```typescript
for (const use of uses) {
      if (use.name !== "check_policy") throw new Error("Unregistered tool");
      const value = checkPolicy((use.input as any).amount);
      calls++;
      emit({
        type: "observation",
        observation: {
          kind: "custom-tool",
          detail: { ...value, toolUseId: use.id, loopOwner: "application" },
```

### 7. Create a dedicated hosted agent

Create only this experiment’s named agent with no tools for the text-only comparison. The official Client SDK calls the Managed Agents API; Anthropic hosts the harness.

Source: src/managed.ts

```typescript
const agent = await this.client.beta.agents.create(
      {
        name: "SDK59 classroom " + this.id,
        model: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
        system: ROLE,
        tools: [],
      },
      { signal: this.signal },
    );
```

### 8. Create the cloud environment

Create a dedicated limited-network cloud configuration and journal its new ID immediately. No supplied IDs from older lessons or other users are accepted.

Source: src/managed.ts

```typescript
const environment = await this.client.beta.environments.create(
      {
        name: "SDK59 classroom " + this.id,
        config: {
          type: "cloud",
          networking: { type: "limited", allow_package_managers: false },
        },
      },
      { signal: this.signal },
```

### 9. Create a bounded retained session

Reference the new agent and environment. The Managed budget uses integer USD minor units: amount 50 means fifty cents, not fifty dollars. Its list-cost limit differs from the SDK estimate threshold.

Source: src/managed.ts

```typescript
const session = await this.client.beta.sessions.create(
      {
        agent: agent.id,
        environment_id: environment.id,
        budget: {
          type: "limit",
          max_list_cost: { amount: "50", currency: "USD" },
        },
      },
      { signal: this.signal },
```

### 10. Open observation before sending

Open the actual session SSE stream before sending the user event. Observe native event IDs and avoid replaying already seen events across turns.

Source: src/managed.ts

```typescript
let stream = await this.client.beta.sessions.events.stream(
      sessionId,
      {},
      { signal: this.signal },
    );
    let text = "",
      idle: any = null,
```

### 11. Observe the hosted answer

Render actual agent.message text and wait for a real idle event after the reply. Do not treat an initial idle status or a local fake result as a completed hosted turn.

Source: src/managed.ts

```typescript
if (event.type === "agent.message")
        for (const b of event.content)
          if (b.type === "text") {
            text += b.text;
            this.emit({ type: "text", text: b.text });
          }
      if (
        event.type === "session.error" ||
```

### 12. Review a small legacy transformation

Transform a historical fixture as text and review explicit modern configuration. This is a narrow illustration, not a general codemod. The separate modern SDK runner executes the regression task.

Source: src/migrations.ts

```typescript
const after = before
    .replace("@anthropic-ai/claude-code", "@anthropic-ai/claude-agent-sdk")
    .replace(
      "/* REVIEW_SYSTEM_PROMPT_AND_SETTINGS */",
      'systemPrompt: "Classroom expense assistant", settingSources: [], tools: [], permissionMode: "dontAsk", maxTurns: 3',
    );
  const checks = {
    modernImport: after.includes("@anthropic-ai/claude-agent-sdk"),
```

### 13. Grade the task and owned cleanup

Require observed native success and experiment-specific checks, including actual handlers, recall or cleanup. SDK, CLI, Messages and Managed result shapes remain distinct in the evidence.

Source: src/runner.ts

```typescript
checks.ownedResourcesCleaned = cleanupErrors.length === 0;
  const passed =
    !exception &&
    Object.keys(checks).length >= 3 &&
    Object.values(checks).every(Boolean);
  return {
```

### What is real

All nine modes make actual model calls. SDK invokes query; CLI spawns the native runtime; Client SDK implements its own tool dispatch; Managed modes create real remote resources and consume actual events. No response is simulated.

### Four choices, four responsibilities

Agent SDK and CLI share a local runtime family, but their invocation surfaces differ. A Client SDK is an API library and needs an application tool loop. Managed Agents moves harness operation and retained session events to Anthropic. Its sandbox may be cloud or self-hosted; this app demonstrates a cloud configuration.

### State and cost are not interchangeable

Session IDs belong to different systems and are never reused across platforms. Local SDK transcripts need a persistence design to outlive the workspace; Managed history is server-side. Native usage and budget shapes differ. This app preserves them without inventing a universal billed total or an apples-to-apples benchmark.

### Retention and beta status

Reviewed 2026-10-26: the official Managed Agents overview lists the managed-agents-2026-04-01 beta header and states the feature is not currently ZDR-eligible or covered by HIPAA BAA. Verify the current policy before a deployment decision. Operating the SDK locally does not automatically make API traffic or retained data compliant.

### Migration is a behavioral port

Legacy demonstrates selected import/configuration edits and executes the modern regression task. Toolport maps a small business function to a real Claude MCP handler and hook. OpenAI fixture code is not installed or executed. Subagent delegation is not claimed to be identical to a conversation handoff.

### Owned resources and interruptions

The app journals IDs it creates, deletes its own Managed sessions and environments, and archives its agent configuration. Archived metadata remains on the platform. Normal failures and cancellations attempt cleanup; a hard host crash or network outage can leave IDs in the private journal for operator review. No existing lesson resources are modified. The bounded observation recovery reads native history after opening a replacement stream; it never resends an accepted user event. Run npm run cleanup to recover ownership-verified non-empty journals after an outage.

### Primary references

https://platform.claude.com/docs/en/managed-agents/overview ; https://platform.claude.com/docs/en/managed-agents/quickstart ; https://platform.claude.com/docs/en/agent-sdk/overview ; https://platform.claude.com/cookbook/claude-agent-sdk-04-migrating-from-openai-agents-sdk ; https://platform.claude.com/docs/en/agent-sdk/migration-guide ; Original deck: Lesson59_Agent_SDK_vs_Managed_Agents_and_Migrations.pptx
