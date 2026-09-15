import { getRequestAuth } from "@/lib/server/auth";
import { getAppSessionFromRequest } from "@/lib/server/appSession";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { principalsAgree } from "@/lib/socialCore";

export function agentEnabled() {
  return process.env.PSO_AGENT_ENABLED === "true";
}
export function agentDatabase() {
  const db = getSupabaseAdmin();
  if (!db) throw new Error("AGENT_STORAGE_UNAVAILABLE");
  return db;
}
export async function agentPrincipal(request: Request) {
  const origin = request.headers.get("origin");
  if (
    !["GET", "HEAD"].includes(request.method) &&
    origin &&
    origin !== new URL(request.url).origin
  )
    throw new Error("AUTH_REQUIRED");
  const auth = await getRequestAuth(request);
  const session = getAppSessionFromRequest(request);
  if (
    !principalsAgree({
      bearerOwnerId: auth.user?.id,
      sessionOwnerId: session?.ownerId,
    })
  )
    throw new Error("AUTH_REQUIRED");
  const owner = auth.user?.id ?? session?.ownerId;
  if (!owner) throw new Error("AUTH_REQUIRED");
  return owner;
}
export async function ownedPet(owner: string, pet: string) {
  const result = await agentDatabase()
    .from("pets")
    .select("id,name,breed_id,custom_breed,sex,life_stage,weight_kg")
    .eq("id", pet)
    .eq("owner_id", owner)
    .maybeSingle();
  if (result.error) throw new Error("AGENT_STORAGE_UNAVAILABLE");
  if (!result.data) throw new Error("PET_NOT_FOUND");
  return result.data;
}
export async function ownedRun(owner: string, id: string) {
  const result = await agentDatabase()
    .from("agent_runs")
    .select("*")
    .eq("id", id)
    .eq("owner_id", owner)
    .maybeSingle();
  if (result.error) throw new Error("AGENT_STORAGE_UNAVAILABLE");
  if (!result.data) throw new Error("RUN_NOT_FOUND");
  await ownedPet(owner, result.data.pet_id);
  return result.data;
}
export function agentError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "AUTH_REQUIRED")
    return Response.json({ error: code }, { status: 401 });
  if (["PET_NOT_FOUND", "RUN_NOT_FOUND", "THREAD_NOT_FOUND"].includes(code))
    return Response.json({ error: code }, { status: 404 });
  if (code === "AGENT_DAILY_LIMIT")
    return Response.json({ error: code }, { status: 429 });
  if (code === "REQUEST_CONFLICT")
    return Response.json({ error: code }, { status: 409 });
  return Response.json({ error: "AGENT_UNAVAILABLE" }, { status: 503 });
}
