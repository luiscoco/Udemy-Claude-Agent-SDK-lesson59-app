import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Managed } from "./managed.js";
const folder = join(process.cwd(), ".runtime", "managed-resources");
let failures = 0;
for (const name of await readdir(folder).catch(() => [])) {
  if (!/^[a-f0-9-]{36}\.json$/.test(name)) continue;
  const owner = name.slice(0, -5),
    owned = JSON.parse(await readFile(join(folder, name), "utf8"));
  if (!Object.keys(owned).length) continue;
  const m = new Managed(
    (e) => {
      if (e.type === "observation") console.log(JSON.stringify(e));
    },
    new AbortController().signal,
    owner,
  );
  try {
    if (owned.agent) {
      const agent = await m.client.beta.agents.retrieve(owned.agent);
      if (agent.name !== "SDK59 classroom " + owner)
        throw new Error("Agent ownership mismatch");
    }
    if (owned.environment) {
      const environment = await m.client.beta.environments.retrieve(
        owned.environment,
      );
      if (environment.name !== "SDK59 classroom " + owner)
        throw new Error("Environment ownership mismatch");
    }
    if (owned.session) {
      const session = await m.client.beta.sessions.retrieve(owned.session);
      if (session.environment_id !== owned.environment)
        throw new Error("Session ownership mismatch");
    }
    Object.assign(m.owned, owned);
    if ((await m.cleanup()).length) failures++;
  } catch (e) {
    console.error("Journal " + name + ": " + String(e));
    failures++;
  }
}
process.exitCode = failures ? 1 : 0;
