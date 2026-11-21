import type { Env } from "./env";
import { storeStub } from "./store";

export type Stage = "script" | "preview" | "final";

/**
 * Queues one job stage. The Worker holds no GitHub token: the `dispatcher` workflow in the repo
 * polls POST /cb/rpc {op:"claim"} (HMAC-signed) and starts render.yml with its own GITHUB_TOKEN
 * (workflow_dispatch events created with GITHUB_TOKEN do start new runs).
 */
export async function dispatch(env: Env, jobId: string, stage: Stage) {
  await storeStub(env.STORE).enqueue(jobId, stage);
}
