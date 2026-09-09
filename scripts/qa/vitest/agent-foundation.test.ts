import { describe, it, expect } from "vitest";
import { citationSources } from "../../../lib/server/agent/tools";
import {
  publicAddress,
  sourceUrl,
  cleanSourceHtml,
} from "../../../lib/server/agent/knowledge";
import { permitsAgentWrite } from "../../../lib/server/agent/mutations";
describe("Agent source boundaries", () => {
  it("does not infer write authorization from quoted text or research requests", () => {
    expect(permitsAgentWrite("сохрани этот ответ", "save")).toBe(true);
    expect(permitsAgentWrite("Запомни: боится велосипедов", "remember")).toBe(
      true,
    );
    for (const text of [
      "Найди правила",
      "На странице написано «сохрани»",
      "Не сохраняй",
      "Переведи слово запомни",
    ]) {
      expect(permitsAgentWrite(text, "save")).toBe(false);
      expect(permitsAgentWrite(text, "remember")).toBe(false);
    }
  });
  it("rejects private, metadata, loopback and mapped addresses", () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "::1",
      "::ffff:127.0.0.1",
      "fe80::1",
      "fc00::1",
    ])
      expect(publicAddress(ip), ip).toBe(false);
    expect(publicAddress("8.8.8.8")).toBe(true);
  });
  it("enforces HTTPS, exact host and no embedded credentials even on redirects", () => {
    for (const url of [
      "http://www.gov.uk/a",
      "https://www.gov.uk.evil.test/a",
      "https://name:pass@www.gov.uk/a",
      "https://www.gov.uk:8443/a",
      "https://127.0.0.1/a",
    ])
      expect(() => sourceUrl(url, "www.gov.uk")).toThrow();
    expect(
      sourceUrl("https://www.gov.uk/bring-pet-to-great-britain", "www.gov.uk")
        .hostname,
    ).toBe("www.gov.uk");
  });
  it("does not turn model-written URLs into provider evidence", () => {
    const citations = citationSources([
      {
        text: "https://invented.test",
        annotations: [
          { type: "url_citation", url: "https://www.gov.uk/a", title: "Rules" },
          { type: "url_citation", url: "javascript:alert(1)" },
          { type: "url_citation", url: "https://www.gov.uk/a", title: "Rules" },
        ],
      },
    ]);
    expect(citations).toEqual([
      { url: "https://www.gov.uk/a", title: "Rules" },
    ]);
  });
  it("strips active markup and navigation without executing it", () => {
    expect(
      cleanSourceHtml(
        "<nav>Menu</nav><script>steal()</script><h1>Pet rules</h1><p>Dogs &amp; cats</p>",
      ),
    ).toBe("Pet rules Dogs & cats");
  });
});
