import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ROLE,completedManagedTurn } from "./policy.js";
export class Managed {
  readonly client = new Anthropic({
    maxRetries: 0,
    timeout: 120000,
    defaultHeaders: { "anthropic-beta": "managed-agents-2026-04-01" },
  });
  readonly owned: { agent?: string; environment?: string; session?: string } =
    {};
  readonly seen = new Set<string>();
  constructor(
    readonly emit: (e: any) => void,
    readonly signal: AbortSignal,
    readonly id: string = randomUUID(),
  ) {}
  observe(kind: string, detail: any) {
    this.emit({ type: "observation", observation: { kind, detail } });
  }
  async journal() {
    const folder = join(process.cwd(), ".runtime", "managed-resources");
    await mkdir(folder, { recursive: true });
    await writeFile(
      join(folder, this.id + ".json"),
      JSON.stringify(this.owned, null, 2),
      { mode: 0o600 },
    );
  }
  async setup() {
    const agent = await this.client.beta.agents.create(
      {
        name: "SDK59 classroom " + this.id,
        model: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
        system: ROLE,
        tools: [],
      },
      { signal: this.signal },
    );
    this.owned.agent = agent.id;
    await this.journal();
    const environment = await this.client.beta.environments.create(
      {
        name: "SDK59 classroom " + this.id,
        config: {
          type: "cloud",
          networking: { type: "limited", allow_package_managers: false },
        },
      },
      { signal: this.signal },
    );
    this.owned.environment = environment.id;
    await this.journal();
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
    );
    this.owned.session = session.id;
    await this.journal();
    this.observe("configuration", {
      platform: "Managed Agents",
      loopOwner: "Anthropic-hosted harness",
      ...this.owned,
      tools: [],
      betaHeader: "managed-agents-2026-04-01",
      budget: {
        amount: "50",
        currency: "USD",
        scope:
          "50 USD minor units = $0.50 maximum session list cost; not an SDK estimate",
      },
    });
  }
  async turn(prompt: string) {
    const sessionId = this.owned.session!;
    let stream = await this.client.beta.sessions.events.stream(
      sessionId,
      {},
      { signal: this.signal },
    );
    let text = "",
      idle: any = null,
      fatal = false;
    const consume = (event: any) => {
      if (event.id) {
        if (this.seen.has(event.id)) return;
        this.seen.add(event.id);
      }
      this.observe("managed-event", {
        type: event.type,
        ...(event.id ? { id: event.id } : {}),
      });
      if (event.type === "agent.message")
        for (const b of event.content)
          if (b.type === "text") {
            text += b.text;
            this.emit({ type: "text", text: b.text });
          }
      if (
        event.type === "session.error" ||
        event.type === "session.status_terminated"
      ) {
        fatal = true;
        throw new Error(
          "Managed terminal error: " +
            JSON.stringify(event.error ?? event.type),
        );
      }
      if (event.type === "session.status_idle" && text) idle = event;
    };
    try {
      // Open observation before sending; send this user event exactly once.
      await this.client.beta.sessions.events.send(
        sessionId,
        {
          events: [
            { type: "user.message", content: [{ type: "text", text: prompt }] },
          ],
        },
        { signal: this.signal },
      );
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          if (attempt > 0) {
            stream = await this.client.beta.sessions.events.stream(
              sessionId,
              {},
              { signal: this.signal },
            );
            for await (const event of this.client.beta.sessions.events.list(
              sessionId,
              { order: "asc" },
              { signal: this.signal },
            )) {
              consume(event);
              if (idle) break;
            }
          }
          if (!idle)
            for await (const event of stream) {
              consume(event);
              if (idle) break;
            }
          if (idle) break;
          throw new Error("Managed observation stream closed before idle.");
        } catch (error) {
          if (fatal || this.signal.aborted || attempt === 2) throw error;
          this.observe("managed-observation-retry", {
            attempt: attempt + 1,
            resendingUserEvent: false,
            error: String(error),
          });
          await new Promise((r) => setTimeout(r, 750));
        } finally {
          stream.controller.abort();
        }
      }
    } finally {
      stream.controller.abort();
    }
    if (!idle)
      throw new Error("No native idle event after the Managed Agents reply.");
    if(!completedManagedTurn(idle))throw new Error('Managed session stopped without a normal end_turn: '+JSON.stringify(idle.stop_reason));
    const result = {
      platform: "Managed Agents",
      sessionId,
      terminalEvent: idle.type,
      native: idle,
      answer: text,
    };
    this.emit({ type: "result", result });
    this.observe("native-path", {
      platform: "Managed Agents",
      sessionId,
      terminalEvent: idle.type,
    });
    return {
      platform: "Managed Agents",
      text,
      success: true,
      sessionId,
      native: idle,
    };
  }
  async cleanup() {
    const actions: any[] = [],
      errors: string[] = [];
    // Touch only IDs created and journalled by this Managed instance.
    for (const kind of ["session", "environment", "agent"] as const) {
      const id = this.owned[kind];
      if (!id) continue;
      try {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            if (kind === "session")
              await this.client.beta.sessions.delete(
                id,
                {},
                { timeout: 20000 },
              );
            if (kind === "environment")
              await this.client.beta.environments.delete(
                id,
                {},
                { timeout: 20000 },
              );
            if (kind === "agent")
              await this.client.beta.agents.archive(id, {}, { timeout: 20000 });
            break;
          } catch (e) {
            if ((e as any).status === 404) break;
            if (attempt === 2) throw e;
            await new Promise((r) => setTimeout(r, 750));
          }
        }
        actions.push({
          kind,
          id,
          operation: kind === "agent" ? "archived" : "deleted",
        });
        delete this.owned[kind];
        await this.journal();
      } catch (e) {
        errors.push(kind + ": " + String(e));
      }
    }
    this.observe("managed-cleanup", {
      actions,
      errors,
      scope:
        "Only this experiment’s new resources. Agent configuration is archived, not deleted.",
    });
    return errors;
  }
}
