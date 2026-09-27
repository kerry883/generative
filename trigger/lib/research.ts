import { generateParsed, QWEN_PLUS, type Log } from "./llm";

// Source type for storing search results
export interface Source {
  title: string;
  url: string;
  snippet: string;
}

const USER_AGENT = "GenerativeVideoBot/1.0 (educational video generator)";
const FETCH_TIMEOUT_MS = 12_000;
const PAGES_TO_READ = 3;
const CHARS_PER_PAGE = 6_000;

interface Page extends Source {
  text: string;
}

// ─── Google Custom Search ─────────────────────────────

async function googleSearch(log: Log, query: string): Promise<Source[] | null> {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
  if (!apiKey || !searchEngineId) {
    log.warn("Google search not configured (GOOGLE_SEARCH_API_KEY / GOOGLE_SEARCH_ENGINE_ID)");
    return null;
  }
  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) {
    const body = await response.text();
    log.warn("Google search failed", { status: response.status, body: body.slice(0, 300) });
    return null;
  }
  const data = await response.json();
  return (data.items ?? []).map((item: { snippet?: string; link?: string; title?: string }) => ({
    snippet: item.snippet ?? "",
    url: item.link ?? "",
    title: item.title ?? "",
  }));
}

// Readable text from an HTML page (good enough for articles and docs).
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|nav|header|footer|aside|form)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

async function readPage(log: Log, source: Source): Promise<Page> {
  try {
    const response = await fetch(source.url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !type.includes("html")) return { ...source, text: source.snippet };
    const text = htmlToText(await response.text());
    return { ...source, text: text.length > 200 ? text.slice(0, CHARS_PER_PAGE) : source.snippet };
  } catch (e) {
    log.warn("Could not read page, using snippet", { url: source.url, error: String(e) });
    return { ...source, text: source.snippet };
  }
}

// ─── Wikipedia (no key needed) ────────────────────────

const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
// Wikimedia asks API clients to identify themselves with contact details:
// set WIKIPEDIA_USER_AGENT to e.g. "AppName/1.0 (https://your.site; you@example.com)".
const WIKIPEDIA_USER_AGENT = process.env.WIKIPEDIA_USER_AGENT ?? USER_AGENT;

// Best-matching article for a short topic, with its plain-text content, in a
// single request (search generator + extracts).
async function wikipediaArticle(log: Log, topic: string): Promise<Page | null> {
  const url =
    `${WIKIPEDIA_API}?action=query&format=json&redirects=1&generator=search&gsrlimit=1` +
    `&gsrsearch=${encodeURIComponent(topic)}&prop=extracts&explaintext=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": WIKIPEDIA_USER_AGENT },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    log.warn("Wikipedia request failed", { topic, status: res.status });
    return null;
  }
  const pages: Record<string, { title: string; extract?: string }> = (await res.json()).query?.pages ?? {};
  const page = Object.values(pages)[0];
  const text = (page?.extract ?? "").replace(/\n{2,}/g, "\n").trim();
  if (!page || !text) return null;
  return {
    title: `${page.title} - Wikipedia`,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
    snippet: text.slice(0, 200),
    text: text.slice(0, CHARS_PER_PAGE),
  };
}

// Short topic titles find the right article far more reliably than a long
// query. Requests go one at a time to stay well inside Wikimedia's limits.
async function wikipediaSearch(log: Log, query: string, topics: string[]): Promise<Page[]> {
  const pages: Page[] = [];
  for (const topic of (topics.length ? topics : [query]).slice(0, PAGES_TO_READ)) {
    const page = await wikipediaArticle(log, topic);
    if (page && !pages.some((p) => p.url === page.url)) pages.push(page);
  }
  return pages;
}

// ─── public API ───────────────────────────────────────

// Search for topic information: Google (reading the top pages), falling back
// to Wikipedia when Google is unavailable or returns nothing.
export async function searchTopic(
  log: Log,
  query: string,
  encyclopediaTopics: string[] = [],
): Promise<{ content: string; sources: Source[] }> {
  log.info("Searching for topic information", { query });
  let pages: Page[] = [];

  try {
    const results = await googleSearch(log, query);
    if (results?.length) {
      pages = await Promise.all(results.slice(0, PAGES_TO_READ).map((r) => readPage(log, r)));
      // Keep the remaining results as short snippets.
      pages.push(...results.slice(PAGES_TO_READ, 5).map((r) => ({ ...r, text: r.snippet })));
    }
  } catch (e) {
    log.warn("Google search error", { error: String(e) });
  }

  if (!pages.length) {
    try {
      pages = await wikipediaSearch(log, query, encyclopediaTopics);
      if (pages.length) log.info("Using Wikipedia research", { titles: pages.map((p) => p.title) });
    } catch (e) {
      log.warn("Wikipedia search error", { error: String(e) });
    }
  }

  if (!pages.length) {
    log.warn("No research available; the Director will work without sources");
    return { content: "", sources: [] };
  }

  const content = pages
    .map((p) => `Title: ${p.title}\nSource: ${p.url}\nContent: ${p.text}`)
    .join("\n\n---\n\n");
  log.info("Search completed", { numSources: pages.length, contentChars: content.length });

  return { content, sources: pages.map(({ title, url, snippet }) => ({ title, url, snippet })) };
}

// Documents up to this size go to the Director as they are.
const MAX_DIRECT_CONTEXT = 60_000;
const CHUNK_SIZE = 30_000;

// Large documents are condensed chunk by chunk into notes so the Director's
// context never overflows. Facts, numbers and formulas are kept verbatim.
export async function condenseContext(log: Log, prompt: string, context: string): Promise<string> {
  if (context.length <= MAX_DIRECT_CONTEXT) return context;

  const chunks: string[] = [];
  for (let i = 0; i < context.length; i += CHUNK_SIZE) chunks.push(context.slice(i, i + CHUNK_SIZE));
  log.info("Condensing large document", { chars: context.length, chunks: chunks.length });

  const notes: string[] = new Array(chunks.length);
  const queue = chunks.map((chunk, index) => ({ chunk, index }));
  await Promise.all(
    Array.from({ length: Math.min(3, queue.length) }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        const { chunk, index } = job;
        notes[index] = await generateParsed(
          log,
          QWEN_PLUS,
          "You condense part of a document into study notes for an educational video. Keep every definition, formula, number, date, name and step that matters for the user's request, copied exactly. Drop filler, references and formatting. Answer with the notes only, as short bullet points.",
          `User's video request: ${prompt}\n\nDocument part ${index + 1} of ${chunks.length}:\n${chunk}`,
          (text) => {
            if (text.trim().length < 20) throw new Error("Notes are empty");
            return text.trim();
          },
        );
      }
    }),
  );

  const condensed = notes.map((n, i) => `[Part ${i + 1}]\n${n}`).join("\n\n");
  log.info("Document condensed", { fromChars: context.length, toChars: condensed.length });
  return condensed;
}
