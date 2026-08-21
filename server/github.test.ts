import { describe, expect, it } from "vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FALLBACK_GITHUB_PROJECTS, formatProjectCatalog, getGitHubProjects, projectKnowledgeSections } from "./github";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  delete process.env.GITHUB_TOKEN;
});

describe("GitHub project knowledge", () => {
  it("preserves verified repository and live-demo links in the fallback catalog", () => {
    const newsPilot = FALLBACK_GITHUB_PROJECTS.find(project => project.name === "NewsPilot");
    const blogging = FALLBACK_GITHUB_PROJECTS.find(project => project.name === "eBlogging-webapp");

    expect(newsPilot).toMatchObject({
      url: "https://github.com/Samarssj/NewsPilot",
      homepageUrl: "https://samarssj-newspilot-app-qbihoh.streamlit.app/",
    });
    expect(blogging).toMatchObject({
      url: "https://github.com/Samarssj/eBlogging-webapp",
      homepageUrl: "https://eblogging-webapp-1.onrender.com",
    });
  });

  it("exposes both repository and available live links to grounded project answers", () => {
    const [section] = projectKnowledgeSections([FALLBACK_GITHUB_PROJECTS.find(project => project.name === "NewsPilot")!]);

    expect(section.content).toContain("GitHub repository: https://github.com/Samarssj/NewsPilot");
    expect(section.content).toContain("Live project URL: https://samarssj-newspilot-app-qbihoh.streamlit.app/");
  });

  it("formats the complete project catalog with details, repository links, and available live links", () => {
    const catalog = formatProjectCatalog(FALLBACK_GITHUB_PROJECTS);

    expect(catalog).toContain("**NewsPilot**");
    expect(catalog).toContain("**GitHub:** https://github.com/Samarssj/NewsPilot");
    expect(catalog).toContain("**Live project:** https://samarssj-newspilot-app-qbihoh.streamlit.app/");
    expect(catalog).toContain("**Black-Jack**");
  });

  it("forces a live GitHub refresh for complete project-catalog requests", async () => {
    process.env.GITHUB_TOKEN = "test-github-token";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{
        name: "newly-published-project",
        description: "A freshly published project.",
        html_url: "https://github.com/Samarssj/newly-published-project",
        homepage: null,
        language: "TypeScript",
        updated_at: "2026-08-21T00:00:00Z",
        stargazers_count: 0,
        fork: false,
        archived: false,
      }],
    });
    global.fetch = fetchMock as typeof fetch;

    const projects = await getGitHubProjects("Samarssj", { forceRefresh: true });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: expect.objectContaining({ Authorization: "Bearer test-github-token" }),
    });
    expect(projects).toMatchObject([{ name: "newly-published-project" }]);
  });
});
