import { start } from "workflow/api";
import { z } from "zod";
import { agentWorkflow } from "@/workflows/agent";
import { agentDatabase, agentError, agentPrincipal, ownedPet } from "./access";
import { agentProviderConfig } from "./providerConfig";

const command = z.object({
  petId: z.string().uuid(),
  threadId: z.string().uuid().optional(),
  requestId: z.string().uuid(),
  question: z.string().trim().min(1).max(8000),
});

export async function submitAgent(request: Request, body: unknown) {
  const parsed = command.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: "INVALID_AGENT_REQUEST" }, { status: 400 });
  try {
    const owner = await agentPrincipal(request);
    await ownedPet(owner, parsed.data.petId);
    agentProviderConfig();
    const db = agentDatabase();
    const admitted = await db.rpc("agent_admit_run", {
      p_owner: owner,
      p_pet: parsed.data.petId,
      p_thread: parsed.data.threadId ?? null,
      p_request: parsed.data.requestId,
      p_question: parsed.data.question,
    });
    if (admitted.error) {
      if (admitted.error.code === "23505")
        return Response.json({ error: "THREAD_BUSY" }, { status: 409 });
      throw new Error(admitted.error.message);
    }
    const run = admitted.data;
    if (run.status === "succeeded") return Response.json(run.result);
    if (run.status === "queued" && !run.workflow_id) {
      // Concurrent/repeated dispatch is safe: worker admission is compare-and-swap.
      const workflow = await start(agentWorkflow, [run.id]);
      const saved = await db
        .from("agent_runs")
        .update({ workflow_id: workflow.runId })
        .eq("id", run.id)
        .eq("owner_id", owner);
      if (saved.error) throw new Error("DISPATCH_RECORD_FAILED");
    }
    return Response.json(
      { runId: run.id, threadId: run.thread_id, status: run.status },
      { status: 202 },
    );
  } catch (error) {
    return agentError(error);
  }
}
