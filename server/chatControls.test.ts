import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("chat retry and source controls", () => {
  it("renders source labels only when enabled and provides a compact retry action for the latest failed answer", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/components/AIChatBox.tsx"), "utf8");

    expect(source).toContain("showSources && message.sources");
    expect(source).toContain("retryQuestion && onRetryMessage");
    expect(source).toContain("RotateCcw");
    expect(source).toContain("> Retry");
  });

  it("wires the source visibility switch and retries without adding a duplicate user message", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

    expect(source).toContain('id="source-label-visibility"');
    expect(source).toContain("checked={showSourceLabels}");
    expect(source).toContain("messages.slice(0, -2)");
    expect(source).toContain("onRetryMessage={question => void sendMessage(question, true)}");
  });
});
