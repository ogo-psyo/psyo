import {
  agentDatabase,
  agentEnabled,
  agentError,
  agentPrincipal,
  ownedPet,
} from "@/lib/server/agent/access";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const owner = await agentPrincipal(request);
    const pet = new URL(request.url).searchParams.get("petId") ?? "";
    await ownedPet(owner, pet);
    if (!agentEnabled()) return Response.json({ enabled: false });
    const result = await agentDatabase()
      .from("agent_runs")
      .select("id,status,question,thread_id,created_at")
      .eq("owner_id", owner)
      .eq("pet_id", pet)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (result.error) throw new Error("READ_FAILED");
    return Response.json(
      { enabled: true, latest: result.data },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return agentError(error);
  }
}
