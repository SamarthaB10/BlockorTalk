import { beforeEach, describe, expect, it } from "vitest";
import { clearNewsCache } from "../lib/practice/news";
import { clearNewsApiCache, latestNews, newsApiArticles, parseNewsApi, themeOf } from "../lib/practice/newsapi";

// Shape fixtures only (made-up headlines): they test parsing, not real coverage.
const BODY = {
  status: "ok",
  articles: [
    { source: { name: "Example Wire" }, title: "Fake recruiters ask applicants to buy gift cards", description: "Job seekers report a new <b>hiring</b> scam.", url: "https://example.com/a", publishedAt: "2026-11-06T10:00:00Z" },
    { source: { name: "Example Wire" }, title: "Bank fraud team callers ask for one-time codes", description: "Callers pose as a bank.", url: "https://example.com/b", publishedAt: "2026-11-07T10:00:00Z" },
    { source: { name: "Example Wire" }, title: "[Removed]", description: "[Removed]", url: "https://removed.com", publishedAt: "2026-11-07T10:00:00Z" },
    { source: { name: "Bad" }, title: "Unsafe link", description: "x", url: "javascript:alert(1)", publishedAt: "2026-11-07T10:00:00Z" },
  ],
};

const FTC_RSS = `<rss><channel><item><title>Your bank card was frozen? Not so fast</title><link>https://consumer.ftc.gov/consumer-alerts/2026/11/x</link>
<description>Scammers call about your account.</description><pubDate>Fri, 06 Nov 2026 14:00:00 -0500</pubDate></item></channel></rss>`;

describe("NewsAPI", () => {
  beforeEach(() => { clearNewsApiCache(); clearNewsCache(); });

  it("parses articles, drops removed and unsafe ones, strips markup", () => {
    const items = parseNewsApi(BODY);
    expect(items.map(i => i.link)).toEqual(["https://example.com/a", "https://example.com/b"]);
    expect(items[0]).toMatchObject({ source: "Example Wire", summary: "Job seekers report a new hiring scam.", date: "2026-11-06T10:00:00.000Z" });
  });

  it("tags a headline with the scenario theme it matches", () => {
    expect(themeOf({ title: "Fake recruiters want gift cards", summary: "" })).toBe("Jobs");
    expect(themeOf({ title: "Bank fraud team asks for your code", summary: "" })).toBe("Banking");
    expect(themeOf({ title: "Lottery winner", summary: "" })).toBeUndefined();
  });

  it("sends the key in a header and asks for one query per theme", async () => {
    const calls: { url: string; key: string | null }[] = [];
    const fake = (async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), key: new Headers(init?.headers).get("X-Api-Key") });
      return Response.json(BODY);
    }) as unknown as typeof fetch;
    await newsApiArticles("secret", fake, 0);
    expect(calls).toHaveLength(2);
    expect(calls.every(c => c.key === "secret" && c.url.startsWith("https://newsapi.org/v2/everything?"))).toBe(true);
    expect(calls.every(c => !c.url.includes("secret"))).toBe(true);
  });

  it("caches within the window and serves stale copy when the API fails", async () => {
    let n = 0;
    const ok = (async () => { n++; return Response.json(BODY); }) as unknown as typeof fetch;
    const down = (async () => new Response("", { status: 429 })) as unknown as typeof fetch;
    await newsApiArticles("k", ok, 0);
    await newsApiArticles("k", ok, 1000);
    expect(n).toBe(2); // two themes fetched once, second call cached
    expect((await newsApiArticles("k", down, 4 * 60 * 60 * 1000)).length).toBeGreaterThan(0);
  });

  it("keeps one theme's results when the other query fails", async () => {
    let n = 0;
    const half = (async () => (n++ === 0 ? Response.json(BODY) : new Response("", { status: 429 }))) as unknown as typeof fetch;
    expect((await newsApiArticles("k", half, 0)).length).toBeGreaterThan(0);
  });

  it("backs off after a failure instead of retrying on every request", async () => {
    let n = 0;
    const down = (async () => { n++; return new Response("", { status: 429 }); }) as unknown as typeof fetch;
    await expect(newsApiArticles("k", down, 0)).rejects.toThrow();
    const after = n;
    await expect(newsApiArticles("k", down, 60_000)).rejects.toThrow();
    expect(n).toBe(after);
    await expect(newsApiArticles("k", down, 31 * 60_000)).rejects.toThrow();
    expect(n).toBeGreaterThan(after);
  });

  it("does not tag a job story as Banking just for saying 'account' or 'card'", () => {
    expect(themeOf({ title: "Recruiter scam: fake hiring manager wants a gift card", summary: "Create an account to apply, then pay by card." })).toBe("Jobs");
  });

  it("merges FTC and NewsAPI newest first, de-duplicates by link, and tags themes", async () => {
    const fake = (async (url: string) => String(url).includes("ftc.gov") ? new Response(FTC_RSS) : Response.json(BODY)) as unknown as typeof fetch;
    const { items } = await latestNews({ fetchFn: fake, apiKey: "k", now: 0 });
    const links = items.map(i => i.link);
    expect(new Set(links).size).toBe(links.length);
    expect(items.map(i => i.date)).toEqual([...items.map(i => i.date)].sort().reverse());
    expect(items.find(i => i.source === "FTC")).toMatchObject({ theme: "Banking" });
    expect(items.find(i => i.link === "https://example.com/a")).toMatchObject({ theme: "Jobs", source: "Example Wire" });
  });

  it("falls back to FTC alone with no key, and to NewsAPI alone if the FTC is down", async () => {
    const ftcOnly = (async (url: string) => String(url).includes("ftc.gov") ? new Response(FTC_RSS) : new Response("", { status: 500 })) as unknown as typeof fetch;
    expect((await latestNews({ fetchFn: ftcOnly, apiKey: undefined, now: 0 })).items.map(i => i.source)).toEqual(["FTC"]);
    clearNewsCache(); clearNewsApiCache();
    const apiOnly = (async (url: string) => String(url).includes("ftc.gov") ? new Response("", { status: 503 }) : Response.json(BODY)) as unknown as typeof fetch;
    expect((await latestNews({ fetchFn: apiOnly, apiKey: "k", now: 0 })).items).toHaveLength(2);
  });

  it("throws only when every source fails", async () => {
    const down = (async () => new Response("", { status: 500 })) as unknown as typeof fetch;
    await expect(latestNews({ fetchFn: down, apiKey: "k", now: 0 })).rejects.toThrow();
  });
});
