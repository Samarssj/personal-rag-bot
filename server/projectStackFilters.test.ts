import { describe, expect, it } from "vitest";
import { PROJECT_STACK_FILTERS } from "../client/src/lib/projectStackFilters";

describe("project stack filters", () => {
  it("offers grounded AI, ML, and full-stack recommendation prompts", () => {
    expect(PROJECT_STACK_FILTERS.map(filter => filter.id)).toEqual(["ai", "ml", "full-stack"]);
    expect(PROJECT_STACK_FILTERS.find(filter => filter.id === "ai")?.prompt).toContain("best AI projects");
    expect(PROJECT_STACK_FILTERS.find(filter => filter.id === "ml")?.prompt).toContain("machine-learning project");
    expect(PROJECT_STACK_FILTERS.find(filter => filter.id === "full-stack")?.prompt).toContain("Auto Apply and Step-Pulse");
  });
});
