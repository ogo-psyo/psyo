import {
  agentDatabase,
  agentError,
  agentPrincipal,
  ownedRun,
} from "@/lib/server/agent/access";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const run = await ownedRun(
      await agentPrincipal(request),
      (await context.params).id,
    );
    return Response.json(
      {
        runId: run.id,
        threadId: run.thread_id,
        question: run.question,
        status: run.status,
        result: run.result,
        error: run.error_code,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return agentError(error);
  }
}
export async function DELETE(request: Request, context: Context) {
  try {
    const owner = await agentPrincipal(request);
    const run = await ownedRun(owner, (await context.params).id);
    const result = await agentDatabase()
      .from("agent_runs")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", run.id)
      .eq("owner_id", owner)
      .in("status", ["queued", "running"]);
    if (result.error) throw new Error("CANCEL_FAILED");
    return Response.json({ ok: true });
  } catch (error) {
    return agentError(error);
  }
}
