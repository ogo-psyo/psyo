import { agentDatabase, ownedRun } from "./access";

export async function saveAgentResult(
  owner: string,
  resultRun: string,
  actingRun: string | null = null,
) {
  const run = await ownedRun(owner, resultRun);
  if (run.status !== "succeeded" || !run.result?.answer)
    throw new Error("RESULT_NOT_READY");
  const result = await agentDatabase().rpc("agent_save_result", {
    p_owner: owner,
    p_result: resultRun,
    p_acting: actingRun,
  });
  if (result.error) throw new Error("SAVE_FAILED");
  return result.data;
}

export function permitsAgentWrite(
  question: string,
  operation: "save" | "remember",
) {
  return operation === "save"
    ? /^\s*сохрани(?:\s|[.!?,]|$)/iu.test(question)
    : /^\s*запомни(?:\s|[.!?,:]|$)/iu.test(question);
}
