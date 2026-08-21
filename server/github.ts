export type GitHubProject = {
  name: string;
  description: string | null;
  url: string;
  homepageUrl: string | null;
  language: string | null;
  updatedAt: string | null;
  stargazerCount: number;
};

type GitHubApiProject = {
  name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  updated_at: string;
  stargazers_count: number;
  fork: boolean;
  archived: boolean;
};

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; projects: GitHubProject[] }>();

// Verified against Samarssj's public repository page on 20 Aug 2026. This keeps project chat
// answers available during temporary GitHub API rate limits without altering the fixed profile.
export const FALLBACK_GITHUB_PROJECTS: GitHubProject[] = [
  { name: "Samarssj", description: null, url: "https://github.com/Samarssj/Samarssj", homepageUrl: null, language: "Python", updatedAt: null, stargazerCount: 0 },
  { name: "samar-portfolio1", description: "TypeScript based personal portfolio website deployed on Vercel.", url: "https://github.com/Samarssj/samar-portfolio1", homepageUrl: "https://samar-portfolio1.vercel.app", language: "TypeScript", updatedAt: null, stargazerCount: 0 },
  { name: "Credit-Guard", description: "ML based model pipeline for credit card fraud detection.", url: "https://github.com/Samarssj/Credit-Guard", homepageUrl: null, language: "Jupyter Notebook", updatedAt: null, stargazerCount: 0 },
  { name: "eBlogging-webapp", description: "TypeScript web app supporting JWT-based authentication.", url: "https://github.com/Samarssj/eBlogging-webapp", homepageUrl: "https://eblogging-webapp-1.onrender.com", language: "TypeScript", updatedAt: null, stargazerCount: 0 },
  { name: "job-track", description: "An automated job scraper and resume matcher through Playwright and SQLite.", url: "https://github.com/Samarssj/job-track", homepageUrl: null, language: "Python", updatedAt: null, stargazerCount: 0 },
  { name: "Jarvis-prototype", description: "Tony Stark-inspired voice-based local AI desktop assistant.", url: "https://github.com/Samarssj/Jarvis-prototype", homepageUrl: null, language: "Python", updatedAt: null, stargazerCount: 1 },
  { name: "Tour-ET", description: "JavaScript based travel booking system.", url: "https://github.com/Samarssj/Tour-ET", homepageUrl: "https://tesystem-1.onrender.com", language: "JavaScript", updatedAt: null, stargazerCount: 0 },
  { name: "NewsPilot", description: "Hybrid RAG based AI news app with guardrails and Gemini as an LLM brain.", url: "https://github.com/Samarssj/NewsPilot", homepageUrl: "https://samarssj-newspilot-app-qbihoh.streamlit.app/", language: "Python", updatedAt: null, stargazerCount: 0 },
  { name: "Enterprise-Agent", description: "CX Agent Studio based enterprise healthcare service bot.", url: "https://github.com/Samarssj/Enterprise-Agent", homepageUrl: "https://healthcare-card-portal.vercel.app", language: null, updatedAt: null, stargazerCount: 0 },
  { name: "entity-resolution", description: null, url: "https://github.com/Samarssj/entity-resolution", homepageUrl: null, language: "Python", updatedAt: null, stargazerCount: 0 },
  { name: "local-AI-ChatBot", description: "Local AI chatbot interface.", url: "https://github.com/Samarssj/local-AI-ChatBot", homepageUrl: "https://samarssj.github.io/local-AI-ChatBot/", language: "HTML", updatedAt: null, stargazerCount: 0 },
  { name: "BEHAVIOURiq", description: "AI-powered human behaviour analysis application.", url: "https://github.com/Samarssj/BEHAVIOURiq", homepageUrl: "https://behaviou-riq-oyk9.vercel.app", language: "HTML", updatedAt: null, stargazerCount: 0 },
  { name: "FlowCast", description: "ML based women's menstrual cycle prediction model.", url: "https://github.com/Samarssj/FlowCast", homepageUrl: "https://period-predictor-kxssmdhkv2qxjqymovkkro.streamlit.app", language: "Python", updatedAt: null, stargazerCount: 0 },
  { name: "Housing-price-predictor", description: "ML-powered housing price prediction system.", url: "https://github.com/Samarssj/Housing-price-predictor", homepageUrl: "https://house-price-predictor-pied.vercel.app", language: "Jupyter Notebook", updatedAt: null, stargazerCount: 0 },
  { name: "house-price-predictor", description: null, url: "https://github.com/Samarssj/house-price-predictor", homepageUrl: "https://house-price-predictor-pied.vercel.app", language: "HTML", updatedAt: null, stargazerCount: 0 },
  { name: "movie-review-sentiment-analysis", description: "A five-class sentiment classifier trained on the Kaggle movie-review dataset.", url: "https://github.com/Samarssj/movie-review-sentiment-analysis", homepageUrl: "https://samarssj-movie-review-sentiment-analysis-appapp-z7ohdt.streamlit.app/", language: "Jupyter Notebook", updatedAt: null, stargazerCount: 0 },
  { name: "health-buddy", description: "A Streamlit healthcare information chatbot using a curated local knowledge base and Gemini.", url: "https://github.com/Samarssj/health-buddy", homepageUrl: "https://health-buddy-hglg822fh6wt86qhrt6jp2.streamlit.app", language: "Python", updatedAt: null, stargazerCount: 0 },
  { name: "Clearance_desk", description: "NLP and LLM-based resume analyzer and scorer.", url: "https://github.com/Samarssj/Clearance_desk", homepageUrl: "https://samarssj-clerance-desk-app-4ik4yy.streamlit.app", language: "Python", updatedAt: null, stargazerCount: 0 },
  { name: "healthcare-card-portal", description: "Live website for the enterprise agent.", url: "https://github.com/Samarssj/healthcare-card-portal", homepageUrl: "https://healthcare-card-portal.vercel.app", language: "TypeScript", updatedAt: null, stargazerCount: 0 },
  { name: "heightPredictor", description: "HTML and ML based fun prediction system.", url: "https://github.com/Samarssj/heightPredictor", homepageUrl: "https://height-predictor-63sb.onrender.com", language: "HTML", updatedAt: null, stargazerCount: 0 },
  { name: "Black-Jack", description: null, url: "https://github.com/Samarssj/Black-Jack", homepageUrl: null, language: null, updatedAt: null, stargazerCount: 0 },
];

function cacheFallback(username: string) {
  const projects = [...FALLBACK_GITHUB_PROJECTS];
  cache.set(username.toLocaleLowerCase(), { expiresAt: Date.now() + CACHE_TTL_MS, projects });
  return projects;
}

export async function getGitHubProjects(username: string, options: { forceRefresh?: boolean } = {}): Promise<GitHubProject[]> {
  const normalizedUsername = username.trim();
  const cached = cache.get(normalizedUsername.toLocaleLowerCase());
  if (!options.forceRefresh && cached && cached.expiresAt > Date.now()) return cached.projects;

  try {
    const githubToken = process.env.GITHUB_TOKEN?.trim();
    const response = await fetch(
      `https://api.github.com/users/${encodeURIComponent(normalizedUsername)}/repos?per_page=100&sort=updated&direction=desc`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "Samar-Portfolio-AI",
          ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
        },
      },
    );
    if (!response.ok) {
      console.warn(`[GitHub] Live catalog unavailable (${response.status}); using the verified fallback catalog.`);
      return cacheFallback(normalizedUsername);
    }

    const payload = (await response.json()) as GitHubApiProject[];
    const projects = payload
      .filter(project => !project.fork && !project.archived)
      .map(project => ({
        name: project.name,
        description: project.description,
        url: project.html_url,
        homepageUrl: project.homepage || null,
        language: project.language,
        updatedAt: project.updated_at,
        stargazerCount: project.stargazers_count,
      }));

    cache.set(normalizedUsername.toLocaleLowerCase(), { expiresAt: Date.now() + CACHE_TTL_MS, projects });
    return projects;
  } catch (error) {
    console.warn("[GitHub] Live catalog request failed; using the verified fallback catalog.", error);
    return cacheFallback(normalizedUsername);
  }
}

export function projectKnowledgeSections(projects: GitHubProject[]) {
  return projects.map(project => ({
    title: "GitHub Project",
    content:
      `Project: ${project.name}. GitHub repository: ${project.url}. Description: ${project.description || "No GitHub description provided."} ` +
      `Primary language: ${project.language || "Not specified"}. ` +
      `${project.homepageUrl ? `Live project URL: ${project.homepageUrl}. ` : ""}` +
      `Last updated: ${project.updatedAt || "Not available in the fallback catalog"}.`,
  }));
}

/** Formats every available repository, description, and public link for a complete catalog response. */
export function formatProjectCatalog(projects: GitHubProject[]): string {
  return projects.map(project => {
    const details = [
      `- **${project.name}**`,
      `  - **Details:** ${project.description || "No GitHub description provided."}`,
      `  - **GitHub:** ${project.url}`,
      project.homepageUrl ? `  - **Live project:** ${project.homepageUrl}` : null,
      `  - **Primary language:** ${project.language || "Not specified"}`,
    ].filter((line): line is string => Boolean(line));
    return details.join("\n");
  }).join("\n");
}
