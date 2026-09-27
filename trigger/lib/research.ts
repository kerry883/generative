import type { Log } from "./llm";

// Source type for storing search results
export interface Source {
  title: string;
  url: string;
  snippet: string;
}

// Search for topic information using Google Custom Search
export async function searchTopic(
  log: Log,
  prompt: string,
): Promise<{ content: string; sources: Source[] }> {
  try {
    log.info("Searching for topic information", { prompt });

    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(prompt)}`;

    const response = await fetch(url);
    if (!response.ok) {
      return { content: "", sources: [] };
    }

    const data = await response.json();
    log.info("Search results", { data });
    // Extract snippets and sources
    const sources: Source[] = (data.items ?? []).map(
      (item: { snippet?: string; link?: string; title?: string }) => ({
        snippet: item.snippet ?? "",
        url: item.link ?? "",
        title: item.title ?? "",
      }),
    );

    if (sources.length === 0) {
      return { content: "", sources: [] };
    }

    // Return a clean, simple string for the LLM
    const searchContent = sources
      .slice(0, 5) // Get top 5 results
      .map((item: Source) => `Title: ${item.title}\nSource: ${item.url}\nContent: ${item.snippet}`)
      .join("\n\n---\n\n");
    log.info("Search completed", { numSources: sources.length });

    return { content: searchContent, sources };
  } catch (error) {
    log.warn("Search failed, continuing without search results", { error: String(error) });
    return { content: "", sources: [] };
  }
}
