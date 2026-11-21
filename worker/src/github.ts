import type { Env } from "./env";

export type Stage = "script" | "preview" | "final";

/**
 * Starts the render workflow for one job stage.
 * POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches → 204.
 * The request itself lives in R2 (jobs/<id>/request.json); only ids travel as inputs.
 */
export async function dispatch(env: Env, jobId: string, stage: Stage, workflow = "render.yml") {
  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/${workflow}/dispatches`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "ali-motion-factory-worker",
      "content-type": "application/json",
    },
    body: JSON.stringify({ ref: env.GITHUB_REF || "main", inputs: { job_id: jobId, stage } }),
  });
  if (res.status !== 204 && res.status !== 200) throw new Error(`workflow dispatch failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
}
