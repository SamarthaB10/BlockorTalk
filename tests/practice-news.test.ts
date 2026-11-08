import { beforeEach, describe, expect, it } from "vitest";
import { BATTLE_CARDS } from "../lib/practice/catalog";
import { cardFor, clearNewsCache, ftcAlerts, parseFeed } from "../lib/practice/news";

// Shape fixtures only (made-up titles): they test parsing, not FTC content.
const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>Consumer Alerts</title>
<item><title>Got a call about a package held at customs?</title><link>https://consumer.ftc.gov/consumer-alerts/2026/11/example-one</link>
<description>&lt;p&gt;Scammers say a &lt;strong&gt;delivery&lt;/strong&gt; fee is due &amp;amp; ask for your card.&lt;/p&gt;</description>
<pubDate>Fri, 06 Nov 2026 14:00:00 -0500</pubDate></item>
<item><title><![CDATA[Job offer wants you to buy gift cards]]></title><link>https://consumer.ftc.gov/consumer-alerts/2026/11/example-two</link>
<description><![CDATA[<p>No real employer asks for that.</p>]]></description><pubDate>Thu, 05 Nov 2026 10:00:00 -0500</pubDate></item>
<item><title>Bad link</title><link>javascript:alert(1)</link></item>
</channel></rss>`;

const ATOM = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Your phone carrier didn't text you</title>
<link href="https://consumer.ftc.gov/consumer-alerts/2026/11/example-three"/><updated>2026-11-04T12:00:00Z</updated>
<summary>Someone wants your SIM code.</summary></entry></feed>`;

describe("FTC news", () => {
  beforeEach(() => clearNewsCache());

  it("parses RSS items, strips markup and skips unsafe links", () => {
    const items = parseFeed(RSS);
    expect(items.map(i => i.title)).toEqual(["Got a call about a package held at customs?", "Job offer wants you to buy gift cards"]);
    expect(items[0]!.summary).toBe("Scammers say a delivery fee is due & ask for your card.");
    expect(items[0]!.date).toBe("2026-11-06T19:00:00.000Z");
    expect(items[0]!.cardId).toBe("customs-fee");
  });

  it("parses Atom entries", () => {
    const [item] = parseFeed(ATOM);
    expect(item).toMatchObject({ title: "Your phone carrier didn't text you", link: "https://consumer.ftc.gov/consumer-alerts/2026/11/example-three", cardId: "port-out-code" });
  });

  it("links every alert to a real battle card", () => {
    const ids = new Set(BATTLE_CARDS.map(c => c.id));
    for (const t of ["gift card job", "package", "phone", "utility bill", "refund order", "IRS", "anything else"]) expect(ids.has(cardFor(t)), t).toBe(true);
  });

  it("caches, serves a stale copy on failure, and throws with nothing cached", async () => {
    const ok = (async () => new Response(RSS)) as typeof fetch;
    const down = (async () => new Response("", { status: 503 })) as typeof fetch;
    await expect(ftcAlerts(down, 0)).rejects.toThrow(/503/);
    expect((await ftcAlerts(ok, 0)).items).toHaveLength(2);
    expect((await ftcAlerts(down, 4 * 60 * 60 * 1000)).items).toHaveLength(2);
  });
});
