import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
export async function workspace() {
  const root = await mkdtemp(join(tmpdir(), "sdk59-"));
  const cwd = join(root, "work"),
    home = join(root, "home"),
    config = join(root, "config");
  for (const p of [cwd, home, config]) await mkdir(p);
  return {
    root,
    cwd,
    home,
    config,
    cleanup: () =>
      rm(root, {
        recursive: true,
        force: true,
        maxRetries: 8,
        retryDelay: 250,
      }),
  };
}
