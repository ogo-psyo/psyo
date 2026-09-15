// Account entitlement is verified in the provider console, not inferred from a
// successful API response. This attestation is a release gate, not a billing API.
export function agentProviderConfig(
  env: Record<string, string | undefined> = process.env,
) {
  const provider = env.PSO_AGENT_PROVIDER ?? "openai";
  const model = env.PSO_AGENT_MODEL?.trim();
  if (!model) throw new Error("AGENT_NOT_CONFIGURED");
  if (provider === "groq") {
    if (!env.GROQ_API_KEY?.trim()) throw new Error("AGENT_NOT_CONFIGURED");
    if (env.PSO_GROQ_FREE_VERIFIED !== "true")
      throw new Error("GROQ_FREE_TIER_NOT_VERIFIED");
    // Compound is a search subsystem, not the custom-tool orchestrator.
    if (model.startsWith("groq/compound"))
      throw new Error("AGENT_MODEL_INCOMPATIBLE");
    if (env.PSO_AGENT_SEARCH_PROVIDER !== "groq-compound")
      throw new Error("AGENT_SEARCH_NOT_CONFIGURED");
    return {
      provider: "groq" as const,
      model,
      search: "groq-compound" as const,
    };
  }
  if (provider !== "openai") throw new Error("AGENT_PROVIDER_UNSUPPORTED");
  if (!env.OPENAI_API_KEY?.trim()) throw new Error("AGENT_NOT_CONFIGURED");
  if (
    env.PSO_AGENT_SEARCH_PROVIDER &&
    env.PSO_AGENT_SEARCH_PROVIDER !== "openai"
  )
    throw new Error("AGENT_SEARCH_NOT_CONFIGURED");
  return { provider: "openai" as const, model, search: "openai" as const };
}

export function agentProviderReady() {
  try {
    return { configured: true, provider: agentProviderConfig().provider };
  } catch {
    return { configured: false, provider: null };
  }
}
