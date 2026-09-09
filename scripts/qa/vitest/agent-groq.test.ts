import { afterEach, describe, expect, it, vi } from "vitest";
import { Agent, Runner, RunContext } from "@openai/agents";
import { agentProviderConfig } from "../../../lib/server/agent/providerConfig";
import {
  groqSearchRecords,
  searchGroqWeb,
  GROQ_CHAT_URL,
  GROQ_SEARCH_MODEL,
} from "../../../lib/server/agent/groqSearch";
import { makeAgentProvider } from "../../../lib/server/agent/provider";

const freeEnv = {
  PSO_AGENT_PROVIDER: "groq",
  PSO_AGENT_MODEL: "llama-3.3-70b-versatile",
  GROQ_API_KEY: "test-fixture-not-a-key",
  PSO_GROQ_FREE_VERIFIED: "true",
  PSO_AGENT_SEARCH_PROVIDER: "groq-compound",
};
const searchPayload = {
  choices: [
    {
      message: {
        content:
          "Generated prose must not supply evidence: https://invented.example/",
        executed_tools: [
          {
            type: "search",
            search_results: {
              results: [
                {
                  url: "https://www.gov.uk/bring-pet-to-great-britain",
                  title: "Pet travel",
                  content: "Check rules before travel.",
                },
              ],
            },
          },
        ],
      },
    },
  ],
  usage: { prompt_tokens: 20, completion_tokens: 30 },
};
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Groq agent selection and search boundaries", () => {
  it("fails closed on unverified free tier, missing search or incompatible Compound main model", () => {
    expect(agentProviderConfig(freeEnv).provider).toBe("groq");
    expect(() =>
      agentProviderConfig({ ...freeEnv, PSO_GROQ_FREE_VERIFIED: "false" }),
    ).toThrow("GROQ_FREE_TIER_NOT_VERIFIED");
    expect(() =>
      agentProviderConfig({
        ...freeEnv,
        GROQ_API_KEY: "",
        OPENAI_API_KEY: "test-fallback",
      }),
    ).toThrow("AGENT_NOT_CONFIGURED");
    expect(() =>
      agentProviderConfig({ ...freeEnv, PSO_AGENT_MODEL: "groq/compound" }),
    ).toThrow("AGENT_MODEL_INCOMPATIBLE");
    expect(() =>
      agentProviderConfig({ ...freeEnv, PSO_AGENT_SEARCH_PROVIDER: "openai" }),
    ).toThrow("AGENT_SEARCH_NOT_CONFIGURED");
    expect(() =>
      agentProviderConfig({ ...freeEnv, PSO_AGENT_PROVIDER: "typo" }),
    ).toThrow("AGENT_PROVIDER_UNSUPPORTED");
    expect(
      agentProviderConfig({
        OPENAI_API_KEY: "test-fixture",
        PSO_AGENT_MODEL: "test-model",
      }).provider,
    ).toBe("openai");
  });
  it("only accepts structured search results, not model text or tool prose", () => {
    const results = groqSearchRecords(searchPayload).results;
    expect(results).toHaveLength(1);
    expect(results[0].url).toContain("gov.uk");
    expect(() =>
      groqSearchRecords({
        choices: [{ message: { content: "https://made-up.example/" } }],
      }),
    ).toThrow("SEARCH_NO_VERIFIABLE_RESULTS");
    const unsafe = structuredClone(searchPayload);
    unsafe.choices[0].message.executed_tools[0].search_results.results = [
      { url: "javascript:alert(1)", title: "Bad", content: "x" },
      { url: "https://user:pass@example.com", title: "Bad", content: "x" },
    ];
    expect(() => groqSearchRecords(unsafe)).toThrow(
      "SEARCH_NO_VERIFIABLE_RESULTS",
    );
  });
  it("does not call provider before free entitlement; quota exhaustion has no retry/fallback", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response("provider details must stay private", { status: 429 }),
    );
    const options = {
      apiKey: "test-fixture",
      freeTierVerified: false,
      signal: new AbortController().signal,
      fetch: fetcher,
    };
    await expect(searchGroqWeb("pet travel", options)).rejects.toThrow(
      "GROQ_FREE_TIER_NOT_VERIFIED",
    );
    expect(fetcher).not.toHaveBeenCalled();
    await expect(
      searchGroqWeb("pet travel", { ...options, freeTierVerified: true }),
    ).rejects.toThrow("AGENT_QUOTA_EXHAUSTED");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe(GROQ_CHAT_URL);
  });
  it("runs the installed SDK tool loop exclusively through Groq with real Chat Completions serialization", async () => {
    for (const [key, value] of Object.entries(freeEnv)) vi.stubEnv(key, value);
    vi.stubEnv("OPENAI_API_KEY", "test-must-not-be-used");
    const sent: Array<{ url: string; body: Record<string, unknown> }> = [];
    let turns = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | Request | URL, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : String(input);
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        sent.push({ url, body });
        expect(url).toBe(GROQ_CHAT_URL);
        if (body.model === GROQ_SEARCH_MODEL) {
          expect(body.compound_custom).toEqual({
            tools: { enabled_tools: ["web_search"] },
          });
          expect(body).not.toHaveProperty("tools");
          return Response.json(searchPayload);
        }
        expect(body).not.toHaveProperty("max_tool_calls");
        expect(body).not.toHaveProperty("store");
        expect(body).not.toHaveProperty("compound_custom");
        const message =
          ++turns === 1
            ? {
                role: "assistant",
                content: null,
                tool_calls: [
                  {
                    id: "call_search",
                    type: "function",
                    function: {
                      name: "web_search",
                      arguments: '{"query":"UK pet travel official rules"}',
                    },
                  },
                ],
              }
            : {
                role: "assistant",
                content: "Проверьте официальные правила ввоза перед поездкой.",
              };
        return Response.json({
          id: `completion-${turns}`,
          object: "chat.completion",
          created: 1,
          model: freeEnv.PSO_AGENT_MODEL,
          choices: [
            {
              index: 0,
              message,
              finish_reason: turns === 1 ? "tool_calls" : "stop",
            },
          ],
          usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 },
        });
      }),
    );
    const evidence: Array<{ url: string; title: string }> = [];
    const searchUsage: Array<{ inputTokens: number; outputTokens: number }> =
      [];
    const guard = vi.fn(async () => undefined);
    const provider = makeAgentProvider({
      evidence,
      searchUsage,
      guard,
      signal: AbortSignal.timeout(5000),
    });
    const agent = new Agent({
      name: "test",
      model: provider.model,
      tools: [provider.searchTool],
      modelSettings: provider.modelSettings,
    });
    const result = await new Runner({
      modelProvider: provider.modelProvider,
      tracingDisabled: true,
      traceIncludeSensitiveData: false,
    }).run(agent, "Найди правила", { maxTurns: 3 });
    expect(result.finalOutput).toContain("официальные");
    expect(sent).toHaveLength(3);
    expect(guard).toHaveBeenCalledTimes(2);
    expect(evidence).toHaveLength(1);
    expect(searchUsage).toEqual([{ inputTokens: 20, outputTokens: 30 }]);
    expect(JSON.stringify(sent[2].body.messages)).toContain("gov.uk");
    expect(JSON.stringify(sent[1].body)).not.toContain("Найди правила");
  });
  it("caps search calls and refuses work after cancellation without another HTTP request", async () => {
    for (const [key, value] of Object.entries(freeEnv)) vi.stubEnv(key, value);
    const fetcher = vi.fn(async () => Response.json(searchPayload));
    vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController();
    const provider = makeAgentProvider({
      evidence: [],
      searchUsage: [],
      guard: async () => undefined,
      signal: controller.signal,
    });
    if (provider.searchTool.type !== "function")
      throw new Error("Expected function tool");
    const invoke = () =>
      provider.searchTool.type === "function"
        ? provider.searchTool.invoke(new RunContext(), '{"query":"pet travel"}')
        : Promise.reject(new Error("Unexpected tool"));
    await invoke();
    await invoke();
    expect(await invoke()).toEqual({ error: "SEARCH_RUN_LIMIT" });
    expect(fetcher).toHaveBeenCalledTimes(2);
    controller.abort();
    await expect(invoke()).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("does not retry main-model 429 or switch endpoints", async () => {
    for (const [key, value] of Object.entries(freeEnv)) vi.stubEnv(key, value);
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json(
        { error: { message: "Fixture quota", type: "rate_limit_error" } },
        { status: 429 },
      ),
    );
    vi.stubGlobal("fetch", fetcher);
    const provider = makeAgentProvider({
      evidence: [],
      searchUsage: [],
      guard: async () => undefined,
      signal: AbortSignal.timeout(5000),
    });
    const agent = new Agent({
      name: "test",
      model: provider.model,
      modelSettings: provider.modelSettings,
    });
    await expect(
      new Runner({
        modelProvider: provider.modelProvider,
        tracingDisabled: true,
      }).run(agent, "test"),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0][0])).toBe(GROQ_CHAT_URL);
  });
});
