import { sleep } from "workflow";
export async function agentWorkflow(runId: string) {
  "use workflow";
  try {
    for (let attempt = 0; attempt < 8; attempt++) {
      await execute(runId);
      if (await settled(runId)) return;
      await sleep("2m");
    }
  } catch {
    // A failed durable step must not leave the UI permanently queued.
    await exhaust(runId);
    return;
  }
  await exhaust(runId);
}

async function exhaust(runId: string) {
  "use step";
  const { agentDatabase } = await import("@/lib/server/agent/access");
  const result = await agentDatabase()
    .from("agent_runs")
    .update({ status: "failed", error_code: "WORKER_INTERRUPTED" })
    .eq("id", runId)
    .in("status", ["queued", "running"]);
  if (result.error) throw new Error("RUN_RECOVERY_FAILED");
}

async function execute(runId: string) {
  "use step";
  const { executeAgentRun } = await import("@/lib/server/agent/runner");
  await executeAgentRun(runId);
}

async function settled(runId: string) {
  "use step";
  const { agentDatabase } = await import("@/lib/server/agent/access");
  const db = agentDatabase();
  const { data, error } = await db
    .from("agent_runs")
    .select("status,updated_at,attempts")
    .eq("id", runId)
    .single();
  if (error) throw new Error("RUN_READ_FAILED");
  if (["succeeded", "failed", "cancelled"].includes(data.status)) return true;
  if (
    data.status === "running" &&
    Date.now() - Date.parse(data.updated_at) > 110000
  ) {
    const updated = await db
      .from("agent_runs")
      .update({
        status: data.attempts >= 3 ? "failed" : "queued",
        error_code: data.attempts >= 3 ? "WORKER_INTERRUPTED" : null,
      })
      .eq("id", runId)
      .eq("status", "running")
      .eq("attempts", data.attempts);
    if (updated.error) throw new Error("RUN_RECOVERY_FAILED");
  }
  return false;
}
