import { z } from "zod";
import {
  agentDatabase,
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
    const result = await agentDatabase()
      .from("agent_memories")
      .select("id,memory_key,content,updated_at")
      .eq("owner_id", owner)
      .eq("pet_id", pet)
      .not("content", "is", null)
      .order("updated_at", { ascending: false })
      .limit(40);
    if (result.error) throw new Error("READ_FAILED");
    return Response.json(
      { memories: result.data },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return agentError(error);
  }
}
export async function POST(request: Request) {
  const body = z
    .object({
      petId: z.string().uuid(),
      key: z.string().trim().min(1).max(120),
      content: z.string().trim().min(1).max(2000),
    })
    .safeParse(await request.json().catch(() => null));
  if (!body.success)
    return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
  try {
    const owner = await agentPrincipal(request);
    await ownedPet(owner, body.data.petId);
    const result = await agentDatabase().rpc("agent_edit_memory", {
      p_owner: owner,
      p_pet: body.data.petId,
      p_key: body.data.key,
      p_content: body.data.content,
    });
    if (result.error) throw new Error("SAVE_FAILED");
    return Response.json({ memory: result.data });
  } catch (error) {
    return agentError(error);
  }
}
export async function DELETE(request: Request) {
  const body = z
    .object({
      petId: z.string().uuid(),
      key: z.string().trim().min(1).max(120),
    })
    .safeParse(await request.json().catch(() => null));
  if (!body.success)
    return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
  try {
    const owner = await agentPrincipal(request);
    await ownedPet(owner, body.data.petId);
    const result = await agentDatabase().rpc("agent_edit_memory", {
      p_owner: owner,
      p_pet: body.data.petId,
      p_key: body.data.key,
      p_content: null,
    });
    if (result.error) throw new Error("SAVE_FAILED");
    return Response.json({ forgotten: true });
  } catch (error) {
    return agentError(error);
  }
}
