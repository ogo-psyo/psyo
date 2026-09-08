import { z } from "zod";
import {
  agentDatabase,
  agentError,
  agentPrincipal,
  ownedPet,
  ownedRun,
} from "@/lib/server/agent/access";
import { saveAgentResult } from "@/lib/server/agent/mutations";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const owner = await agentPrincipal(request);
    const pet = new URL(request.url).searchParams.get("petId") ?? "";
    await ownedPet(owner, pet);
    const result = await agentDatabase()
      .from("agent_artifacts")
      .select("id,title,content,sources,saved_at,run_id")
      .eq("owner_id", owner)
      .eq("pet_id", pet)
      .not("saved_at", "is", null)
      .order("saved_at", { ascending: false })
      .limit(30);
    if (result.error) throw new Error("READ_FAILED");
    return Response.json(
      { results: result.data },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return agentError(error);
  }
}
export async function POST(request: Request) {
  const body = z
    .object({ runId: z.string().uuid() })
    .safeParse(await request.json().catch(() => null));
  if (!body.success)
    return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
  try {
    const owner = await agentPrincipal(request);
    const run = await ownedRun(owner, body.data.runId);
    if (run.status !== "succeeded" || !run.result?.answer)
      return Response.json({ error: "RESULT_NOT_READY" }, { status: 409 });
    return Response.json({ saved: await saveAgentResult(owner, run.id) });
  } catch (error) {
    return agentError(error);
  }
}
