import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
const state = vi.hoisted(() => ({
  writes: [] as Array<{ table: string; data: Record<string, unknown> }>,
  source: {
    id: "gov",
    url: "https://www.gov.uk/bring-pet-to-great-britain",
    allowed_host: "www.gov.uk",
    refresh_hours: 168,
    active_document_id: "previous",
    last_checked_at: "2026-09-01T00:00:00Z",
  },
}));
vi.mock("../../../lib/server/agent/access", () => ({
  agentDatabase: () => ({
    from(table: string) {
      const result =
        table === "knowledge_sources"
          ? { data: state.source, error: null }
          : { data: { id: "next-revision" }, error: null };
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => result,
        single: async () => result,
        upsert: (data: Record<string, unknown>) => {
          state.writes.push({ table, data });
          return query;
        },
        update: (data: Record<string, unknown>) => {
          state.writes.push({ table, data });
          return query;
        },
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ error: null }).then(resolve),
      };
      return query;
    },
  }),
}));
import { ingestSource } from "../../../lib/server/agent/knowledge";
beforeEach(() => {
  state.writes = [];
  vi.stubEnv("PSO_KNOWLEDGE_ENABLED", "true");
});
afterEach(() => vi.unstubAllEnvs());
describe("Versioned source ingestion", () => {
  it("retains the last good version and freshness on fetch failure", async () => {
    await ingestSource("gov", async () => {
      throw new Error("unavailable");
    });
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0].data.last_error).toBe("REFRESH_FAILED");
    expect(state.writes[0].data).not.toHaveProperty("active_document_id");
    expect(state.writes[0].data).not.toHaveProperty("last_checked_at");
  });
  it("rejects a short error page instead of replacing useful knowledge", async () => {
    await ingestSource("gov", async () => "<html>Access denied</html>");
    expect(
      state.writes.every((write) => write.table === "knowledge_sources"),
    ).toBe(true);
    expect(state.writes[0].data.last_error).toBe("REFRESH_FAILED");
  });
  it("writes a sourced revision before activating it", async () => {
    await ingestSource(
      "gov",
      async () =>
        `<h1>Pet travel rules</h1><p>${"Check official vaccination requirements. ".repeat(15)}</p>`,
    );
    expect(state.writes[0].table).toBe("knowledge_documents");
    expect(state.writes[0].data.source_url).toBe(state.source.url);
    expect(state.writes[1].data.active_document_id).toBe("next-revision");
    expect(state.writes[1].data.last_error).toBeNull();
  });
  it("honours the kill switch before any request or write", async () => {
    vi.stubEnv("PSO_KNOWLEDGE_ENABLED", "false");
    const fetcher = vi.fn();
    await ingestSource("gov", fetcher);
    expect(fetcher).not.toHaveBeenCalled();
    expect(state.writes).toEqual([]);
  });
});
