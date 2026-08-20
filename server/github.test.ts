import { describe, expect, it } from "vitest";
import { FALLBACK_GITHUB_PROJECTS, formatProjectCatalog, projectKnowledgeSections } from "./github";

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
});
