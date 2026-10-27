export const TASK =
  "Classify a classroom meal expense of $47. The meal policy limit is $75. Reply with APPROVE-59 if amount <= limit, otherwise REVIEW-59. Return the marker only.";
export const ROLE =
  "You are a concise classroom expense assistant. Follow the supplied policy. Never perform payments or call external business systems.";
export function completedManagedTurn(event:any){return event?.type==='session.status_idle'&&event?.stop_reason?.type==='end_turn';}
export function checkPolicy(amount: number) {
  if (!Number.isInteger(amount) || amount < 0 || amount > 10000)
    throw new Error("Invalid classroom amount.");
  return {
    amount,
    limit: 75,
    decision: amount <= 75 ? "APPROVE-59" : "REVIEW-59",
  };
}
export const PROFILES = [
  {
    name: "Embedded application",
    inProcess: true,
    async: false,
    zdr: false,
    choice: "Agent SDK",
    reason:
      "Keep in-process tools and callbacks on infrastructure you operate.",
  },
  {
    name: "Long asynchronous work",
    inProcess: false,
    async: true,
    zdr: false,
    choice: "Managed Agents",
    reason:
      "Use hosted sessions when server-side state and managed execution fit your requirements.",
  },
  {
    name: "Strict retention review",
    inProcess: false,
    async: true,
    zdr: true,
    choice: "Review data requirements first",
    reason:
      "Managed Agents is stateful and not currently ZDR-eligible. Agent SDK also requires review of provider eligibility and your own storage; it does not automatically guarantee ZDR.",
  },
] as const;
export const MAPPINGS = [
  [
    "Agent instructions",
    "systemPrompt",
    "Review defaults and role text explicitly.",
  ],
  [
    "Function tool",
    "tool() + createSdkMcpServer()",
    "Keep business logic, declare a schema and tool permissions.",
  ],
  [
    "Input/output guardrail",
    "Host checks, hooks and permissions",
    "Separate validation, lifecycle observations and approval decisions.",
  ],
  [
    "Session/memory",
    "session_id + resume + persistence",
    "Keep transcript storage and process lifecycle explicit.",
  ],
  [
    "Handoff/specialist",
    "agents option + Agent tool",
    "Delegation is not automatically identical to handing over conversation ownership.",
  ],
];
