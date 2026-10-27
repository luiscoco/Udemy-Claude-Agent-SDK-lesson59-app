import { sdk, cli } from "./local.js";
import { clientLoop } from "./client-loop.js";
import { Managed } from "./managed.js";
import { workspace } from "./workspace.js";
import { TASK, PROFILES, MAPPINGS } from "./policy.js";
import { legacy } from "./migrations.js";
import type { Mode } from "./protocol.js";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
export async function runCase(
  caseId: Mode,
  emit: (e: any) => void,
  controller: AbortController,
) {
  const observations: any[] = [],
    results: any[] = [],
    outcomes: any[] = [],
    checks: Record<string, boolean> = {},
    w = await workspace();
  const relay = (e: any) => {
    if (e.type === "observation") observations.push(e.observation);
    if (e.type === "result") results.push(e.result);
    emit(e);
  };
  const observe = (kind: string, detail: any) =>
    relay({ type: "observation", observation: { kind, detail } });
  const managed = new Managed(relay, controller.signal);
  let exception: string | null = null,
    cleanupErrors: string[] = [],
    migration: any = null;
  const local = async (prompt = TASK, resume?: string, custom = false) => {
    const result = await sdk(
      w,
      relay,
      controller.signal,
      prompt,
      resume,
      custom,
    );
    outcomes.push(result);
    return result;
  };
  const remote = async (prompt = TASK) => {
    const result = await managed.turn(prompt);
    outcomes.push(result);
    return result;
  };
  try {
    if (caseId === "sdk") await local();
    if (caseId === "cli") outcomes.push(await cli(w, relay, controller.signal));
    if (caseId === "client") {
      const r = await clientLoop(relay, controller.signal);
      outcomes.push(r);
      checks.applicationDispatchedTool = r.toolCalls > 0;
    }
    if (["managed", "compare", "session"].includes(caseId))
      await managed.setup();
    if (caseId === "managed") await remote();
    if (caseId === "compare") {
      await local();
      await remote();
      checks.bothPlatformsObserved = outcomes.length === 2;
    }
    if (caseId === "decision") {
      observe("decision", {
        profiles: PROFILES,
        asOf: "2026-10-26",
        basis:
          "Reviewed lesson and official docs; not a latency or price benchmark.",
      });
      checks.conflictNotHidden =
        PROFILES[2].choice === "Review data requirements first";
      const explanation = await local(
        "Explain these three fixed classroom platform decisions in three short Markdown bullets. Preserve the exact labels SDK-59, MANAGED-59 and REVIEW-DATA-59 respectively. Do not claim either platform automatically guarantees compliance. Profiles: " +
          JSON.stringify(PROFILES),
      );
      checks.fixedDecisionsExplained = [
        "SDK-59",
        "MANAGED-59",
        "REVIEW-DATA-59",
      ].every((x) => explanation.text.includes(x));
    }
    if (caseId === "legacy") {
      migration = await legacy();
      observe("migration-audit", migration);
      checks.migrationChecks = Object.values(migration.checks).every(Boolean);
      await local();
    }
    if (caseId === "toolport") {
      const before = await readFile(
        new URL("../fixtures/openai-agent.py.txt", import.meta.url),
        "utf8",
      );
      migration = {
        before,
        mappings: MAPPINGS,
        scope:
          "OpenAI fixture is illustrative only. Only the Claude tool(), MCP server, hook and query run live. No automatic handoff equivalence is claimed.",
      };
      observe("migration-audit", migration);
      const r = await local(
        "Call check_policy exactly once with amount 47. Return its decision marker only.",
        undefined,
        true,
      );
      checks.realMcpHandler = r.handlerCalls > 0;
      checks.realHook = r.hookCalls > 0;
    }
    if (caseId === "session") {
      const code = "STATE59-" + randomUUID().slice(0, 8),
        first =
          "Remember the classroom code " +
          code +
          ". Reply with that code only.",
        next =
          "What classroom code did I ask you to remember? Reply with that code only.";
      const a = await local(first);
      const b = await local(next, a.sessionId);
      const c = await remote(first);
      const d = await remote(next);
      checks.sdkRecall = b.text.includes(code) && a.sessionId === b.sessionId;
      checks.managedRecall =
        d.text.includes(code) && c.sessionId === d.sessionId;
      checks.distinctSessionSystems = a.sessionId !== c.sessionId;
    }
    checks.nativeResultsSuccessful =
      outcomes.length > 0 && outcomes.every((o) => o.success);
    if (caseId !== "session" && caseId !== "decision")
      checks.sharedBusinessOutcome = outcomes.every((o) =>
        o.text.includes("APPROVE-59"),
      );
  } catch (e) {
    exception = String(e);
  } finally {
    cleanupErrors = await managed.cleanup();
    try {
      await w.cleanup();
    } catch (e) {
      cleanupErrors.push(String(e));
    }
  }
  checks.ownedResourcesCleaned = cleanupErrors.length === 0;
  const passed =
    !exception &&
    Object.keys(checks).length >= 3 &&
    Object.values(checks).every(Boolean);
  return {
    caseId,
    result: results.at(-1),
    results,
    outcomes,
    tools: observations
      .filter((o) => o.kind === "native-tool")
      .map((o) => o.detail),
    observations,
    checks,
    grade: { passed, checks },
    exception,
    cleanupErrors,
    workspaceId: w.root,
    fixturesValid: passed,
    fixtureUnchanged: true,
    deployment: {
      externalRows: outcomes.map((o) => ({
        platform: o.platform,
        sessionId: o.sessionId ?? null,
        success: o.success,
      })),
      migration,
      mappings: MAPPINGS,
      profiles: caseId === "decision" ? PROFILES : undefined,
    },
  };
}
