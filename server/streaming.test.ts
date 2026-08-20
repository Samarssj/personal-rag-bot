import { describe, expect, it } from "vitest";
import { extractGeminiDelta, splitSseFrames, visitorChatError } from "./resumeHttp";

describe("Gemini stream framing", () => {
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
});
