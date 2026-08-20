import { describe, expect, it } from "vitest";

const describeWithGeminiKey = process.env.GEMINI_API_KEY ? describe : describe.skip;

describeWithGeminiKey("external Gemini credentials", () => {
  it("authenticates against the Gemini model-list endpoint", async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    expect(apiKey).toBeTruthy();

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey!)}`);
    if (!response.ok) throw new Error(`Gemini credential validation failed with HTTP ${response.status}.`);

    const payload = await response.json() as { models?: unknown[] };
    expect(Array.isArray(payload.models)).toBe(true);
  }, 20_000);
});
