import { CERTIFICATION_CATALOG_ANSWER, RESUME_DOWNLOAD_URL } from "./defaultKnowledge";

const PORTFOLIO_REPOSITORY = "Samarssj/samar-portfolio1";
const PORTFOLIO_BRANCH = "main";
const RESUME_SOURCE_PATH = "client/src/pages/Home.tsx";
const CERTIFICATIONS_SOURCE_PATH = "client/src/components/CertificationsGallery.tsx";

type GitHubContentResponse = { content?: string; encoding?: string };

export type PortfolioRefresh = {
  resumeUrl: string;
  certificationCatalog: string;
  resumeSource: "live" | "fallback";
  certificationSource: "live" | "fallback";
};

function isHttpUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function parseResumeUrl(source: string): string | null {
  const url = Array.from(source.matchAll(/https:\/\/drive\.google\.com\/file\/d\/[^"'`\s)]+/g))
    .map(match => match[0])
    .find(candidate => isHttpUrl(candidate));
  return url ?? null;
}

export function parseCertificationCatalog(source: string): string | null {
  const certifications = Array.from(
    source.matchAll(/title:\s*"([^"]+)"[\s\S]*?provider:\s*"([^"]+)"[\s\S]*?url:\s*"(https:[^"]+)"/g),
    match => ({ title: match[1]?.trim(), provider: match[2]?.trim(), url: match[3]?.trim() }),
  ).filter((certification): certification is { title: string; provider: string; url: string } =>
    Boolean(certification.title && certification.provider && certification.url && isHttpUrl(certification.url)),
  );

  if (certifications.length === 0) return null;
  return certifications.map(certification => `- **${certification.title}** — ${certification.provider} — ${certification.url}`).join("\n");
}

async function fetchPortfolioFile(path: string, fetchImpl: typeof fetch): Promise<string | null> {
  const githubToken = process.env.GITHUB_TOKEN?.trim();
  const response = await fetchImpl(
    `https://api.github.com/repos/${PORTFOLIO_REPOSITORY}/contents/${path}?ref=${PORTFOLIO_BRANCH}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "Samar-Portfolio-AI",
        ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
      },
    },
  );
  if (!response.ok) return null;

  const payload = await response.json() as GitHubContentResponse;
  if (payload.encoding !== "base64" || typeof payload.content !== "string") return null;
  return Buffer.from(payload.content.replace(/\n/g, ""), "base64").toString("utf8");
}

/** Reads public portfolio source at request time and preserves verified values when GitHub is unavailable or source changes are malformed. */
export async function getLivePortfolioRefresh(fetchImpl: typeof fetch = fetch): Promise<PortfolioRefresh> {
  const [resumeSource, certificationsSource] = await Promise.all([
    fetchPortfolioFile(RESUME_SOURCE_PATH, fetchImpl).catch(() => null),
    fetchPortfolioFile(CERTIFICATIONS_SOURCE_PATH, fetchImpl).catch(() => null),
  ]);
  const resumeUrl = resumeSource ? parseResumeUrl(resumeSource) : null;
  const certificationCatalog = certificationsSource ? parseCertificationCatalog(certificationsSource) : null;

  return {
    resumeUrl: resumeUrl ?? RESUME_DOWNLOAD_URL,
    certificationCatalog: certificationCatalog ?? CERTIFICATION_CATALOG_ANSWER,
    resumeSource: resumeUrl ? "live" : "fallback",
    certificationSource: certificationCatalog ? "live" : "fallback",
  };
}
