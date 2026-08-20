import { afterEach, describe, expect, it, vi } from "vitest";
import { generateGeminiText, toGeminiContents } from "./geminiDirect";

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
    })).resolves.toBe("- Complete answer");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("models/gemini-test:generateContent"),
      expect.objectContaining({ headers: expect.objectContaining({ "x-goog-api-key": "test-key" }) }),
    );
  });
});
