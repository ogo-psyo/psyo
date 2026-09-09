export async function knowledgeWorkflow(id: string) {
  "use workflow";
  await ingest(id);
}
async function ingest(id: string) {
  "use step";
  const { ingestSource } = await import("@/lib/server/agent/knowledge");
  await ingestSource(id);
}
