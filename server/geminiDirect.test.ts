import { afterEach, describe, expect, it, vi } from "vitest";
import { extractGeminiStreamText, generateGeminiText, streamGeminiText, toGeminiContents } from "./geminiDirect";

const originalKey = process.env.GEMINI_API_KEY;
const originalModel = process.env.GEMINI_MODEL;

afterEach(() => {
  process.env.GEMINI_API_KEY = originalKey;
  process.env.GEMINI_MODEL = originalModel;
  vi.unstubAllGlobals();
});

describe("direct Gemini adapter", () => {
  it("maps assistant history to Gemini model turns", () => {
    expect(toGeminiContents([
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi" },
    ])).toEqual([
      { role: "user", parts: [{ text: "Hello" }] },
      { role: "model", parts: [{ text: "Hi" }] },
    ]);
  });

  it("uses only the server Gemini key and returns generated text", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_MODEL = "gemini-test";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: "- Complete answer" }] } }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateGeminiText({
      systemPrompt: "Stay grounded.",
      messages: [{ role: "user", content: "Tell me about Samar." }],
      thinkingLevel: "minimal",
    })).resolves.toBe("- Complete answer");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("models/gemini-test:generateContent"),
      expect.objectContaining({ headers: expect.objectContaining({ "x-goog-api-key": "test-key" }) }),
    );
    const requestOptions = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(requestOptions.body)).generationConfig.thinkingConfig).toEqual({ thinkingLevel: "minimal" });
  });

  it("extracts Gemini SSE chunks and streams them through the direct adapter", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_MODEL = "gemini-test";
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"candidates":[{"content":{"parts":[{"text":"- Fast"}]}}]}\n\n'));
        controller.enqueue(encoder.encode('data: {"candidates":[{"content":{"parts":[{"text":" answer"}]}}]}\n\n'));
        controller.close();
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(body, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    expect(extractGeminiStreamText('data: {"candidates":[{"content":{"parts":[{"text":"- Fast"}]}}]}')).toBe("- Fast");
    const chunks: string[] = [];
    for await (const chunk of streamGeminiText({
      systemPrompt: "Stay grounded.",
      messages: [{ role: "user", content: "Tell me about Samar." }],
    })) chunks.push(chunk);

    expect(chunks).toEqual(["- Fast", " answer"]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("models/gemini-test:streamGenerateContent?alt=sse"),
      expect.objectContaining({ headers: expect.objectContaining({ "x-goog-api-key": "test-key" }) }),
    );
  });

  it("falls back to a complete non-streaming answer when Gemini streaming is unavailable", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_MODEL = "gemini-test";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "Streaming unavailable" } }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: "- Complete fallback answer" }] } }],
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const chunks: string[] = [];
    for await (const chunk of streamGeminiText({
      systemPrompt: "Stay grounded.",
      messages: [{ role: "user", content: "Tell me about Samar." }],
    })) chunks.push(chunk);

    expect(chunks).toEqual(["- Complete fallback answer"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toContain(":generateContent");
  });
});
