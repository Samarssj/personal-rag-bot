import { describe, expect, it } from "vitest";
import { LINKEDIN_PROFILE_URL, PERSONAL_RAG_REPOSITORY_URL } from "./links";

describe("public repository link", () => {
  it("points the header CTA to Samar's published portfolio RAG repository", () => {
    expect(PERSONAL_RAG_REPOSITORY_URL).toBe("https://github.com/Samarssj/personal-rag-bot");
  });

  it("points the header CTA to Samar's public LinkedIn profile", () => {
    expect(LINKEDIN_PROFILE_URL).toBe("https://in.linkedin.com/in/samarssj");
  });
});
