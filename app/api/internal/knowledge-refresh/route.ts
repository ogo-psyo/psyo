import { start } from "workflow/api";
import { knowledgeWorkflow } from "@/workflows/knowledge";
import { agentDatabase } from "@/lib/server/agent/access";
export const runtime = "nodejs";
export async function GET(request: Request) {
  if (
    !process.env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  )
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (process.env.PSO_KNOWLEDGE_ENABLED !== "true")
    return Response.json({ status: "disabled" });
  const { data, error } = await agentDatabase()
    .from("knowledge_sources")
    .select("id")
    .eq("enabled", true)
    .lte("next_check_at", new Date().toISOString())
    .limit(20);
  if (error)
    return Response.json({ error: "SOURCE_READ_FAILED" }, { status: 503 });
  for (const source of data ?? []) await start(knowledgeWorkflow, [source.id]);
  return Response.json({ queued: data?.length ?? 0 });
}
