import { describe, expect, it } from "vitest";
import { calculateAge, DEFAULT_PORTFOLIO_PROFILE, profileKnowledgeSection } from "./profile";
import { FALLBACK_GITHUB_PROJECTS, projectKnowledgeSections } from "./github";

describe("fixed profile facts", () => {
  it("calculates age from the birth date on either side of the birthday", () => {
    expect(calculateAge("2004-09-23", new Date("2026-09-22T12:00:00Z"))).toBe(21);
    expect(calculateAge("2004-09-23", new Date("2026-09-23T12:00:00Z"))).toBe(22);
  });

  it("keeps birth date, relationship status, and age calculation in the server knowledge section", () => {
    const section = profileKnowledgeSection(DEFAULT_PORTFOLIO_PROFILE, new Date("2026-08-20T12:00:00Z"));

    expect(section.content).toContain("23 Sept 2004");
    expect(section.content).toContain("21 years old");
    expect(section.content).toContain("Single and trying things out");
  });

  it("converts GitHub project metadata into profile-chat source sections", () => {
    const sections = projectKnowledgeSections([{ name: "NewsPilot", description: "RAG news assistant", url: "https://github.com/Samarssj/NewsPilot", homepageUrl: null, language: "Python", updatedAt: "2026-08-16T21:51:11Z", stargazerCount: 0 }]);
    expect(sections[0]?.content).toContain("NewsPilot");
    expect(sections[0]?.content).toContain("RAG news assistant");
    expect(FALLBACK_GITHUB_PROJECTS.some(project => project.name === "Enterprise-Agent")).toBe(true);
    expect(FALLBACK_GITHUB_PROJECTS.some(project => project.name === "job-track")).toBe(true);
  });
});

describe("fixed profile source", () => {
  it("keeps the portfolio knowledge section tied to the server-side default profile", () => {
    const section = profileKnowledgeSection(DEFAULT_PORTFOLIO_PROFILE, new Date("2026-08-20T12:00:00Z"));

    expect(section.title).toBe("Portfolio Details");
    expect(section.content).toContain("Samarssj");
    expect(section.content).toContain("Associate AI Developer at EXL");
  });
});
