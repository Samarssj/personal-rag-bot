import { afterEach, describe, expect, it, vi } from "vitest";
import { getLivePortfolioRefresh, parseCertificationCatalog, parseResumeUrl } from "./portfolioSource";

afterEach(() => {
  delete process.env.GITHUB_TOKEN;
});

describe("live portfolio source refresh", () => {
  it("extracts the current resume URL and credential records from the public portfolio source", () => {
    expect(parseResumeUrl('href="https://drive.google.com/file/d/new-resume-id/view?usp=sharing"')).toBe(
      "https://drive.google.com/file/d/new-resume-id/view?usp=sharing",
    );
    expect(parseCertificationCatalog('title: "New Credential", provider: "Google Cloud", url: "https://credly.com/badges/new"')).toContain(
      "**New Credential** — Google Cloud — https://credly.com/badges/new",
    );
  });

  it("uses live portfolio values when both public source files are available", async () => {
    process.env.GITHUB_TOKEN = "test-github-token";
    const response = (source: string) => ({
      ok: true,
      json: async () => ({ content: Buffer.from(source).toString("base64"), encoding: "base64" }),
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response('href="https://drive.google.com/file/d/new-resume-id/view?usp=sharing"'))
      .mockResolvedValueOnce(response('title: "New Credential", provider: "Google Cloud", url: "https://credly.com/badges/new"'));

    const refresh = await getLivePortfolioRefresh(fetchMock as typeof fetch);

    expect(refresh).toMatchObject({
      resumeUrl: "https://drive.google.com/file/d/new-resume-id/view?usp=sharing",
      certificationSource: "live",
      resumeSource: "live",
    });
    expect(refresh.certificationCatalog).toContain("New Credential");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ headers: expect.objectContaining({ Authorization: "Bearer test-github-token" }) });
  });

  it("retains verified fallback values when the public source is unavailable", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });

    const refresh = await getLivePortfolioRefresh(fetchMock as typeof fetch);

    expect(refresh.resumeSource).toBe("fallback");
    expect(refresh.certificationSource).toBe("fallback");
    expect(refresh.resumeUrl).toContain("drive.google.com");
    expect(refresh.certificationCatalog).toContain("IBM Machine Learning Professional Certificate");
  });
});
