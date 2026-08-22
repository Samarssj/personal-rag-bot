import { describe, expect, it } from "vitest";
import { cacheSamarChatResponse, clearSamarChatResponseCache, combineFriendlyAndVerifiedAnswer, extractGeminiDelta, getCachedSamarChatResponse, PORTFOLIO_CHAT_TEMPERATURE, removeRepeatedVerifiedCatalogEntries, SAMAR_CHAT_CACHE_TTL_MS, samarChatCacheKey, splitSseFrames, verifiedDetailsFallback, verifiedPersonalFactDetails, visitorChatError } from "./resumeHttp";

describe("Gemini stream framing", () => {
  it("uses temperature 1.0 for friendly portfolio chat responses", () => {
    expect(PORTFOLIO_CHAT_TEMPERATURE).toBe(1);
  });

  it("caches only equivalent standalone Samar prompts and preserves answer labels", () => {
    clearSamarChatResponseCache();
    const key = samarChatCacheKey("  What are your best AI projects? ", []);

    expect(key).toBe("samar:what are your best ai projects?");
    expect(samarChatCacheKey("What are your best AI projects?", [{ role: "user", content: "Earlier context" }])).toBeNull();
    cacheSamarChatResponse(key!, "- News Pilot and Jarvis.", ["Project Recommendations"], 1_000);
    expect(getCachedSamarChatResponse(key!, 1_001)).toEqual({
      answer: "- News Pilot and Jarvis.",
      labels: ["Project Recommendations"],
    });
    expect(getCachedSamarChatResponse(key!, 1_000 + SAMAR_CHAT_CACHE_TTL_MS + 1)).toBeUndefined();
  });

  it("preserves every CRLF-delimited provider frame instead of keeping only the first chunk", () => {
    const first = 'data: {"choices":[{"delta":{"content":"- First complete fact."}}]}';
    const second = 'data: {"choices":[{"delta":{"content":"\\n- Second complete fact."}}]}';
    const frames = splitSseFrames(`${first}\r\n\r\n${second}\r\n\r\n`);

    expect(frames.complete).toHaveLength(2);
    expect(frames.complete.map(extractGeminiDelta).join("")).toBe("- First complete fact.\n- Second complete fact.");
    expect(frames.rest).toBe("");
  });

  it("hides raw provider-exhaustion details behind a clear retry message", () => {
    expect(visitorChatError('LLM stream failed: 412 Precondition Failed – {"message":"your account has hit a usage exhausted"}'))
      .toBe("The AI response service is temporarily unavailable. Please try again later.");
  });

  it("keeps verified details internal in a single friendly answer and retains a deterministic service fallback", () => {
    const details = [{
      title: "Favorite Songs",
      answer: "- **Hotel Drive** — Vice Monroe.\n- **The Unknown** — Bonnie x Clyde.",
      appendAfterFriendlyAnswer: true,
    }];

    const response = combineFriendlyAndVerifiedAnswer("I gravitate toward these songs for their atmosphere.", details);
    expect(response).toBe("- I gravitate toward these songs for their atmosphere.");
    expect(response).not.toContain("Verified");
    expect(verifiedDetailsFallback(details)).toContain("**Favorite Songs:**");
    expect(verifiedDetailsFallback(details)).toContain("**Hotel Drive** — Vice Monroe.");
  });

  it("removes model-repeated catalog entries before appending verified details and supplies fixed profile facts", () => {
    const movieDetails = [{
      title: "Favorite Movies",
      answer: "- **Primer** — A minimalist science-fiction mystery.\n- **Archive** — A science-fiction drama.",
      appendAfterFriendlyAnswer: true,
    }];

    expect(removeRepeatedVerifiedCatalogEntries("I like Primer and Archive for their ideas.\nI enjoy thought-provoking science fiction.", movieDetails))
      .toBe("- I enjoy thought-provoking science fiction.");
    const facts = verifiedPersonalFactDetails("What is your birthday, height, and education?");
    expect(facts.map(fact => fact.title)).toEqual(expect.arrayContaining(["Birth Date and Age", "Height", "Education"]));
    expect(facts.find(fact => fact.title === "Education")?.answer).toContain("CGPA of 7.76");
  });
});
