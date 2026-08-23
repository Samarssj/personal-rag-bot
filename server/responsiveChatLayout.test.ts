import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("responsive chat layout", () => {
  it("allows narrow message cards and long Markdown links to wrap without horizontal clipping", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/components/AIChatBox.tsx"), "utf8");

    expect(source).toContain("min-w-0 max-w-[calc(100%-2.75rem)] break-words [overflow-wrap:anywhere]");
    expect(source).toContain("[&_a]:break-all [&_a]:[overflow-wrap:anywhere]");
    expect(source).toContain("flex min-w-0 gap-3");
  });
});
