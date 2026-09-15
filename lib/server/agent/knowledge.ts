import { request as httpsRequest } from "node:https";
import { lookup } from "node:dns";
import { BlockList, isIP } from "node:net";
import { createHash } from "node:crypto";
import { agentDatabase } from "./access";

const blocked4 = new BlockList();
const blocked6 = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["100.64.0.0", 10],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blocked4.addSubnet(address, prefix, "ipv4");
for (const [address, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["::ffff:0:0", 96],
  ["64:ff9b::", 96],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const)
  blocked6.addSubnet(address, prefix, "ipv6");
export function publicAddress(address: string) {
  const family = isIP(address);
  return family === 4
    ? !blocked4.check(address, "ipv4")
    : family === 6 && !blocked6.check(address, "ipv6");
}
export function sourceUrl(value: string, allowedHost: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== allowedHost ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    isIP(url.hostname)
  )
    throw new Error("SOURCE_URL_DENIED");
  return url;
}
export function cleanSourceHtml(html: string) {
  return html
    .replace(/<(script|style|nav|footer|header)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
/** Validate the DNS result used by the actual connection, not a separate preflight. */
export async function fetchSource(
  value: string,
  host: string,
  redirects = 0,
): Promise<string> {
  const url = sourceUrl(value, host);
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      url,
      {
        method: "GET",
        headers: {
          "User-Agent": "PsoKnowledge/1.0",
          Accept: "text/html,text/plain",
        },
        signal: AbortSignal.timeout(20000),
        lookup: (hostname, options, callback) =>
          lookup(hostname, options, (error, address, family) => {
            if (error) return callback(error, address, family);
            // Node's auto-family selection may request all resolved addresses.
            const addresses = Array.isArray(address)
              ? address
              : [{ address, family }];
            if (addresses.some((item) => !publicAddress(item.address)))
              return callback(
                new Error("SOURCE_ADDRESS_DENIED"),
                address,
                family,
              );
            callback(null, address, family);
          }),
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          if (redirects >= 3) return reject(new Error("SOURCE_REDIRECT_LIMIT"));
          fetchSource(
            new URL(res.headers.location, url).href,
            host,
            redirects + 1,
          ).then(resolve, reject);
          return;
        }
        if (
          status !== 200 ||
          !/^text\/(html|plain)/i.test(res.headers["content-type"] ?? "")
        ) {
          res.resume();
          reject(new Error("SOURCE_UNAVAILABLE"));
          return;
        }
        const chunks: Buffer[] = [];
        let bytes = 0;
        res.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > 1500000) {
            req.destroy(new Error("SOURCE_TOO_LARGE"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.end();
  });
}
export async function ingestSource(id: string, fetcher = fetchSource) {
  if (process.env.PSO_KNOWLEDGE_ENABLED !== "true") return;
  const db = agentDatabase();
  const { data: source, error } = await db
    .from("knowledge_sources")
    .select("*")
    .eq("id", id)
    .eq("enabled", true)
    .maybeSingle();
  if (error) throw new Error("SOURCE_READ_FAILED");
  if (!source) return;
  function updateSource(values: Record<string, unknown>) {
    const query = db
      .from("knowledge_sources")
      .update(values)
      .eq("id", id)
      .eq("url", source.url)
      .eq("allowed_host", source.allowed_host)
      .eq("enabled", true);
    return source.last_checked_at
      ? query.eq("last_checked_at", source.last_checked_at)
      : query.is("last_checked_at", null);
  }
  try {
    const content = cleanSourceHtml(
      await fetcher(source.url, source.allowed_host),
    ).slice(0, 200000);
    if (
      content.length < 200 ||
      /access denied|verify you are human|captcha/i.test(content.slice(0, 800))
    )
      throw new Error("SOURCE_CONTENT_INVALID");
    const hash = createHash("sha256")
      .update(source.url + "\n" + content)
      .digest("hex");
    const document = await db
      .from("knowledge_documents")
      .upsert(
        { source_id: id, source_url: source.url, content_hash: hash, content },
        { onConflict: "source_id,content_hash", ignoreDuplicates: true },
      );
    if (document.error) throw new Error("SOURCE_SAVE_FAILED");
    const revision = await db
      .from("knowledge_documents")
      .select("id")
      .eq("source_id", id)
      .eq("content_hash", hash)
      .single();
    if (revision.error) throw new Error("SOURCE_SAVE_FAILED");
    const updated = await updateSource({
      active_document_id: revision.data.id,
      last_checked_at: new Date().toISOString(),
      last_error: null,
      next_check_at: new Date(
        Date.now() + source.refresh_hours * 3600000,
      ).toISOString(),
    });
    if (updated.error) throw new Error("SOURCE_SAVE_FAILED");
  } catch {
    // Keep active revision and last successful freshness timestamp unchanged.
    const failed = await updateSource({
      last_error: "REFRESH_FAILED",
      next_check_at: new Date(Date.now() + 86400000).toISOString(),
    });
    if (failed.error) throw new Error("SOURCE_SAVE_FAILED");
  }
}
