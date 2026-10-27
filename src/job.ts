import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { validateConfig } from "./protocol.js";
import { runCase } from "./runner.js";
import { redact } from "./processes.js";
const { mode } = validateConfig({ mode: process.argv[2] });
const emit = (e: any) => process.stdout.write(redact(JSON.stringify(e)) + "\n");
const controller = new AbortController(),
  deadline = setTimeout(() => controller.abort(), 540000);
process.on("message", (m) => {
  if ((m as any)?.type === "abort") controller.abort();
});
const run = await runCase(mode, emit, controller);
clearTimeout(deadline);
const passed = run.grade.passed;
const report = {
  passed,
  pipelineExitCode: passed ? 0 : 1,
  groups: [
    {
      caseId: mode,
      passed: passed ? 1 : 0,
      runs: 1,
      passRate: passed ? 1 : 0,
      avgCostUsd: null,
      avgTurns: null,
      wilson95: null,
    },
  ],
  note: "Different native result and usage shapes are retained separately. No universal billing total or benchmark is inferred.",
};
const evidence = {
  mode,
  runs: [run],
  report,
  complete: !run.exception,
  exception: run.exception,
  pipelineExitCode: report.pipelineExitCode,
  results: run.results,
  tools: run.tools,
  observations: run.observations,
  fixturesValid: passed,
  fixtureUnchanged: true,
  scope:
    "Four actual execution paths. Agent SDK and CLI run locally; Client SDK tool dispatch is written by this app; Managed Agents runs a hosted harness. Historical fixtures are never installed or evaluated. Migration demonstrations cover selected primitives, not an automatic port or handoff equivalence. Only this run’s Managed sessions/environments are deleted and its agent configuration archived. No schedule, public service, payment or OpenAI request is created.",
};
const dir = join(process.cwd(), ".runtime", "runs", randomUUID());
await mkdir(dir, { recursive: true });
await writeFile(
  join(dir, "evidence.json"),
  redact(JSON.stringify(evidence, null, 2)),
);
emit({ type: "job-evidence", evidence });
process.exitCode = evidence.pipelineExitCode;
if (process.connected) process.disconnect();
