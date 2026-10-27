export const MODES = [
  "sdk",
  "cli",
  "client",
  "managed",
  "compare",
  "decision",
  "legacy",
  "toolport",
  "session",
] as const;
export type Mode = (typeof MODES)[number];
export type RunConfig = { mode: Mode };
export type LabEvent = { type: string; [key: string]: any };
export function validateConfig(value: any): RunConfig {
  if (
    !value ||
    Object.keys(value).some((k) => k !== "mode") ||
    !MODES.includes(value.mode)
  )
    throw new Error("Choose a listed platform or migration experiment.");
  return { mode: value.mode };
}
