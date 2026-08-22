import crypto from "crypto";
import path from "path";
import type { Express, Request, Response } from "express";
import express from "express";
import { SAMAR_KNOWLEDGE_BASE, type KnowledgeSection } from "./defaultKnowledge";
import { formatProjectCatalog, getGitHubProjects, projectKnowledgeSections } from "./github";
import { streamGeminiText } from "./geminiDirect";
import { createJobMatch, formatJobMatchMarkdown } from "./jobMatch";
import { getLivePortfolioRefresh } from "./portfolioSource";
import { buildGroundedSystemPrompt, certificationCatalogAnswer, detailedExperienceAnswer, favoriteMediaAnswer, formatAsBulletList, fullStackProjectRecommendationAnswer, hometownAnswer, isGreetingOnly, profileLinkAnswer, requestsProjectCatalog, retrieveRelevantSections, sourceLabels, splitResumeIntoSections, type ChatScope } from "./rag";
import { calculateAge, DEFAULT_PORTFOLIO_PROFILE, formatBirthDate, profileKnowledgeSection } from "./profile";
import { extractResumeText, MAX_RESUME_BYTES, validateResumeUpload } from "./resumeProcessing";
import { createInMemoryResumeSession, deleteInMemoryResumeSession, getInMemoryResumeSession, pruneExpiredResumeSessions } from "./resumeSessionStore";

const UPLOAD_TTL_MS = 4 * 60 * 60 * 1000;
const MAX_HISTORY_MESSAGES = 8;
export const PORTFOLIO_CHAT_TEMPERATURE = 1;
export const SAMAR_CHAT_CACHE_TTL_MS = 3 * 60 * 1000;
const MAX_SAMAR_CHAT_CACHE_ENTRIES = 50;
const NORMAL_SAMAR_CHAT_MAX_OUTPUT_TOKENS = 900;
const DETAILED_SAMAR_CHAT_MAX_OUTPUT_TOKENS = 1_100;
const NORMAL_SAMAR_CHAT_THINKING_LEVEL = "minimal" as const;
const DETAILED_SAMAR_CHAT_THINKING_LEVEL = "low" as const;

type ClientMessage = { role: "user" | "assistant"; content: string };
type CachedSamarChatResponse = { answer: string; labels: string[]; expiresAt: number };
const samarChatResponseCache = new Map<string, CachedSamarChatResponse>();

function sendError(res: Response, status: number, message: string) {
  return res.status(status).json({ error: message });
}

function safeFilename(value: string) {
  const filename = path.basename(value).replace(/[^a-zA-Z0-9._ -]/g, "_").trim();
  return filename || "uploaded-resume";
}

function parseHistory(value: unknown): ClientMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is ClientMessage =>
      typeof item === "object" &&
      item !== null &&
      ((item as ClientMessage).role === "user" || (item as ClientMessage).role === "assistant") &&
      typeof (item as ClientMessage).content === "string",
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map(item => ({ role: item.role, content: item.content.slice(0, 4000) }));
}

async function getActiveUpload(shareToken: string) {
  return getInMemoryResumeSession(shareToken);
}

function sendSse(res: Response, event: string, payload: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

export function extractGeminiDelta(event: string): string {
  const data = event
    .split(/\r?\n/)
    .find(line => line.startsWith("data:"))
    ?.replace(/^data:\s*/, "");
  if (!data || data === "[DONE]") return "";
  try {
    const chunk = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
    return chunk.choices?.[0]?.delta?.content ?? "";
  } catch {
    return "";
  }
}

export function splitSseFrames(buffer: string) {
  const frames = buffer.split(/\r?\n\r?\n/);
  return { complete: frames.slice(0, -1), rest: frames[frames.length - 1] ?? "" };
}

export function visitorChatError(message: string): string {
  return /usage exhausted|precondition failed/i.test(message)
    ? "The AI response service is temporarily unavailable. Please try again later."
    : "Unable to generate a response.";
}

/** Cache only standalone, equivalent Samar prompts; conversational or uploaded-resume context is never reused. */
export function samarChatCacheKey(question: string, history: ClientMessage[]): string | null {
  if (history.length > 0) return null;
  const normalizedQuestion = question.toLocaleLowerCase().replace(/\s+/g, " ").trim();
  return normalizedQuestion ? `samar:${normalizedQuestion}` : null;
}

export function getCachedSamarChatResponse(key: string, now = Date.now()): { answer: string; labels: string[] } | undefined {
  const cached = samarChatResponseCache.get(key);
  if (!cached) return undefined;
  if (cached.expiresAt <= now) {
    samarChatResponseCache.delete(key);
    return undefined;
  }
  samarChatResponseCache.delete(key);
  samarChatResponseCache.set(key, cached);
  return { answer: cached.answer, labels: cached.labels };
}

export function cacheSamarChatResponse(key: string, answer: string, labels: string[], now = Date.now()) {
  if (!answer) return;
  if (samarChatResponseCache.has(key)) samarChatResponseCache.delete(key);
  while (samarChatResponseCache.size >= MAX_SAMAR_CHAT_CACHE_ENTRIES) {
    const oldestKey = samarChatResponseCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    samarChatResponseCache.delete(oldestKey);
  }
  samarChatResponseCache.set(key, { answer, labels, expiresAt: now + SAMAR_CHAT_CACHE_TTL_MS });
}

export function clearSamarChatResponseCache() {
  samarChatResponseCache.clear();
}

/** Live repository data is needed only when a visitor is explicitly exploring projects or their links. */
export function needsLiveGitHubProjectKnowledge(question: string): boolean {
  return /\b(?:github|repo(?:s|sitories)?|project(?:s)?|live\s+(?:demo|link|url)|source\s+code|news\s*pilot|jarvis|credit[\s-]?guard|auto[\s-]?apply|step[\s-]?pulse)\b/i.test(question);
}

export type VerifiedChatDetail = {
  title: string;
  answer: string;
  appendAfterFriendlyAnswer: boolean;
};

/** Supplies exact fixed facts only when a visitor directly asks for the related personal profile detail. */
export function verifiedPersonalFactDetails(question: string): VerifiedChatDetail[] {
  const normalized = question.toLocaleLowerCase();
  const details: VerifiedChatDetail[] = [];
  const birthDate = DEFAULT_PORTFOLIO_PROFILE.birthDate;

  if (/\b(?:age|birthday|birth date|date of birth|born)\b/.test(normalized)) {
    details.push({
      title: "Birth Date and Age",
      answer: `- **Date of birth:** ${formatBirthDate(birthDate)}.\n- **Current age:** ${calculateAge(birthDate)} years old.`,
      appendAfterFriendlyAnswer: true,
    });
  }
  if (/\b(?:height|tall|stature)\b/.test(normalized)) {
    details.push({ title: "Height", answer: "- **Height:** I am 6 feet tall.", appendAfterFriendlyAnswer: true });
  }
  if (/\b(?:study|studied|education|university|college|degree|cgpa)\b/.test(normalized)) {
    details.push({
      title: "Education",
      answer: "- **Education:** I completed a B.E. in Computer Science Engineering at Chitkara University, Punjab, from August 2022 to August 2026, with a CGPA of 7.76.",
      appendAfterFriendlyAnswer: true,
    });
  }
  if (/\b(?:hobby|hobbies|badminton|fun fact)\b/.test(normalized)) {
    details.push({
      title: "Hobbies & Fun Facts",
      answer: "- **Hobby:** Badminton.\n- **Fun fact:** I can play badminton with both hands.",
      appendAfterFriendlyAnswer: true,
    });
  }
  if (/\b(?:contact|email|reach|phone)\b/.test(normalized)) {
    details.push({ title: "Contact", answer: "- **Email:** ssjsamar453@gmail.com.", appendAfterFriendlyAnswer: true });
  }
  if (/\b(?:pronoun|pronouns|gay|straight|sexual orientation|sexuality)\b/.test(normalized)) {
    details.push({ title: "Personal Identity", answer: "- **Pronouns:** he/him.\n- **Sexual orientation:** straight.", appendAfterFriendlyAnswer: true });
  }
  if (/\b(?:relationship|dating|single|partner)\b/.test(normalized)) {
    details.push({ title: "Relationship Status", answer: "- **Relationship status:** Single and trying things out.", appendAfterFriendlyAnswer: true });
  }
  if (/\b(?:religion|religious|sikhism|sikh)\b/.test(normalized)) {
    details.push({ title: "Religion", answer: "- **Religion:** Sikhism.", appendAfterFriendlyAnswer: true });
  }

  return details;
}

function verifiedCatalogMarkers(details: VerifiedChatDetail[]): string[] {
  return Array.from(new Set(details.flatMap(detail => [
    ...Array.from(detail.answer.matchAll(/\*\*([^*]+)\*\*/g), match => match[1] ?? ""),
    ...Array.from(detail.answer.matchAll(/https?:\/\/\S+/g), match => match[0] ?? ""),
  ]).filter(Boolean)));
}

/** Removes model bullets that repeat an exact catalog title or URL which is appended below as verified data. */
export function removeRepeatedVerifiedCatalogEntries(modelAnswer: string, details: VerifiedChatDetail[]): string {
  const markers = verifiedCatalogMarkers(details);
  if (markers.length === 0) return formatAsBulletList(modelAnswer);

  return formatAsBulletList(modelAnswer)
    .split("\n")
    .filter(line => !markers.some(marker => line.toLocaleLowerCase().includes(marker.toLocaleLowerCase())))
    .join("\n");
}

/** Formats one visitor-facing answer; verified details guide Gemini internally and never appear as a second appendix. */
export function combineFriendlyAndVerifiedAnswer(modelAnswer: string, details: VerifiedChatDetail[]): string {
  void details;
  return formatAsBulletList(modelAnswer);
}

/** Falls back to verified direct details if the Gemini service is temporarily unavailable. */
export function verifiedDetailsFallback(details: VerifiedChatDetail[]): string {
  return details
    .map(detail => `- **${detail.title}:**\n${formatAsBulletList(detail.answer)}`)
    .join("\n");
}

export function registerResumeRagRoutes(app: Express) {
  app.post(
    "/api/resume/upload",
    express.raw({ type: "*/*", limit: MAX_RESUME_BYTES }),
    async (req: Request, res: Response) => {
      try {
        const filename = safeFilename(String(req.header("x-file-name") ?? ""));
        const suppliedContentType = String(req.header("x-file-type") ?? "application/octet-stream");
        if (!Buffer.isBuffer(req.body)) return sendError(res, 400, "The uploaded file could not be read.");

        const validated = validateResumeUpload(filename, suppliedContentType, req.body);
        const extractedText = await extractResumeText(req.body, validated);
        const sections = splitResumeIntoSections(extractedText);
        if (sections.length === 0) return sendError(res, 422, "No readable resume sections were found.");

        const shareToken = crypto.randomBytes(24).toString("base64url");
        const deleteToken = crypto.randomBytes(24).toString("base64url");
        const expiresAt = new Date(Date.now() + UPLOAD_TTL_MS);
        createInMemoryResumeSession({
          shareToken,
          originalFilename: filename,
          deleteToken,
          sections,
          expiresAt,
          lastAccessedAt: new Date(),
        });

        return res.status(201).json({
          shareToken,
          deleteToken,
          originalFilename: filename,
          status: "ready",
          expiresAt: expiresAt.toISOString(),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "The resume could not be processed.";
        return sendError(res, 400, message);
      }
    },
  );

  app.get("/api/resume/session/:shareToken", async (req, res) => {
    try {
        const session = await getActiveUpload(req.params.shareToken);
        if (!session) return sendError(res, 404, "This resume session is unavailable, expired, or deleted.");
        return res.json({
          shareToken: session.shareToken,
          originalFilename: session.originalFilename,
          status: "ready",
          expiresAt: session.expiresAt.toISOString(),
      });
    } catch {
      return sendError(res, 500, "Unable to load the resume session.");
    }
  });

  app.delete("/api/resume/session/:shareToken", async (req, res) => {
    try {
      const deleteToken = String(req.header("x-resume-delete-token") ?? "");
      if (!deleteToken) return sendError(res, 403, "This action requires the session's private delete capability.");
      const deleted = deleteInMemoryResumeSession(req.params.shareToken, deleteToken);
      if (!deleted) return sendError(res, 403, "This session cannot be deleted from the current browser.");
      return res.json({ ok: true });
    } catch {
      return sendError(res, 500, "Unable to delete the resume session.");
    }
  });

  app.post("/api/chat/stream", async (req, res) => {
    try {
      const scope: ChatScope = req.body?.scope === "uploaded" ? "uploaded" : "samar";
      const question = typeof req.body?.question === "string" ? req.body.question.trim().slice(0, 3000) : "";
      if (!question) return sendError(res, 400, "Please enter a question.");

      if (isGreetingOnly(question)) {
        res.status(200);
        res.set({
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "Content-Type": "text/event-stream",
          "X-Accel-Buffering": "no",
        });
        res.flushHeaders();
        sendSse(res, "sources", { labels: [] });
        sendSse(res, "token", {
          delta: scope === "samar" ? "Hi — I’m Samar. What would you like to know?" : "Hi — what would you like to know about this resume?",
        });
        sendSse(res, "done", { ok: true });
        return res.end();
      }

      const history = parseHistory(req.body?.history);
      const cacheKey = scope === "samar" && !requestsProjectCatalog(question) && !profileLinkAnswer(question) && !certificationCatalogAnswer(question)
        ? samarChatCacheKey(question, history)
        : null;
      const cachedResponse = cacheKey ? getCachedSamarChatResponse(cacheKey) : undefined;
      if (cachedResponse) {
        res.status(200);
        res.set({
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "Content-Type": "text/event-stream",
          "X-Accel-Buffering": "no",
        });
        res.flushHeaders();
        sendSse(res, "sources", { labels: cachedResponse.labels });
        sendSse(res, "token", { delta: cachedResponse.answer });
        sendSse(res, "done", { ok: true });
        return res.end();
      }

      const verifiedDetails: VerifiedChatDetail[] = [];
      const directHometown = scope === "samar" ? hometownAnswer(question) : null;
      const directExperience = scope === "samar" ? detailedExperienceAnswer(question) : null;
      const directFavoriteMedia = scope === "samar" ? favoriteMediaAnswer(question) : null;
      const directFullStackRecommendation = scope === "samar" ? fullStackProjectRecommendationAnswer(question) : null;
      const directProfileLink = scope === "samar" ? profileLinkAnswer(question) : null;
      const directCertificationCatalog = scope === "samar" ? certificationCatalogAnswer(question) : null;
      const asksForVerifiedProjectCatalog = scope === "samar" && requestsProjectCatalog(question);

      if (directHometown) verifiedDetails.push({ ...directHometown, appendAfterFriendlyAnswer: true });
      if (directExperience) verifiedDetails.push({ ...directExperience, appendAfterFriendlyAnswer: true });
      if (directFavoriteMedia) verifiedDetails.push({ ...directFavoriteMedia, appendAfterFriendlyAnswer: true });
      if (directFullStackRecommendation) verifiedDetails.push({ ...directFullStackRecommendation, appendAfterFriendlyAnswer: true });
      verifiedDetails.push(...(scope === "samar" ? verifiedPersonalFactDetails(question) : []));

      if (directProfileLink || directCertificationCatalog) {
        const livePortfolio = await getLivePortfolioRefresh();
        const refreshedProfileLink = directProfileLink
          ? profileLinkAnswer(question, { resumeUrl: livePortfolio.resumeUrl })
          : null;
        const refreshedCertificationCatalog = directCertificationCatalog
          ? certificationCatalogAnswer(question, livePortfolio.certificationCatalog)
          : null;
        if (refreshedProfileLink) verifiedDetails.push({ ...refreshedProfileLink, appendAfterFriendlyAnswer: true });
        if (refreshedCertificationCatalog) verifiedDetails.push({ ...refreshedCertificationCatalog, appendAfterFriendlyAnswer: true });
      }

      let uploadedSections: KnowledgeSection[] | undefined;
      if (scope === "uploaded") {
        const shareToken = typeof req.body?.shareToken === "string" ? req.body.shareToken : "";
        const session = shareToken ? await getActiveUpload(shareToken) : undefined;
        if (!session) return sendError(res, 404, "Upload a resume or open a valid shared resume session first.");
        uploadedSections = session.sections;
      }

      let samarSections: KnowledgeSection[] | undefined;
      if (scope === "samar") {
        const profile = DEFAULT_PORTFOLIO_PROFILE;
        let projectSections: KnowledgeSection[] = [];
        if (needsLiveGitHubProjectKnowledge(question)) {
          try {
            const projects = await getGitHubProjects(profile.githubUsername, { forceRefresh: asksForVerifiedProjectCatalog });
            projectSections = projectKnowledgeSections(projects);
            if (asksForVerifiedProjectCatalog) {
              verifiedDetails.push({
                title: "GitHub Projects",
                answer: formatProjectCatalog(projects),
                appendAfterFriendlyAnswer: true,
              });
            }
          } catch {
            // A temporary GitHub API failure must not affect the permanent profile chat.
          }
        }
        samarSections = [profileKnowledgeSection(profile), ...projectSections, ...SAMAR_KNOWLEDGE_BASE];
      }

      const asksForProjectCatalog = scope === "samar" && requestsProjectCatalog(question);
      const asksForCredentialCatalog = scope === "samar" && /\b(certification|certifications|credential|credentials|badge|badges)\b/i.test(question);
      const asksForCareerProfile = scope === "samar" && /\b(core strengths?|preferred roles?|work preferences?|current client (?:work|project)|scrapy)\b/i.test(question);
      const asksForExperience = scope === "samar" && /\b(?:experience|experince|career|professional journey|work history|work background|internship|internships)\b/i.test(question);
      const sources = retrieveRelevantSections(
        scope,
        question,
        uploadedSections,
        asksForProjectCatalog || asksForCredentialCatalog ? 30 : scope === "samar" ? 13 : 4,
        samarSections,
      );
      const systemPrompt = buildGroundedSystemPrompt(scope, sources, { verifiedDetails });
      res.status(200);
      res.set({
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream",
        "X-Accel-Buffering": "no",
      });
      res.flushHeaders();
      const labels = Array.from(new Set([...sourceLabels(sources), ...verifiedDetails.map(detail => detail.title)]));
      sendSse(res, "sources", { labels });
      let answer = "";
      try {
        for await (const delta of streamGeminiText({
          systemPrompt,
          messages: [...history, { role: "user", content: question }],
          temperature: PORTFOLIO_CHAT_TEMPERATURE,
          thinkingLevel: asksForExperience || asksForCareerProfile
            ? DETAILED_SAMAR_CHAT_THINKING_LEVEL
            : NORMAL_SAMAR_CHAT_THINKING_LEVEL,
          maxOutputTokens: asksForProjectCatalog || asksForCredentialCatalog
            ? 2_200
            : asksForExperience || asksForCareerProfile
              ? DETAILED_SAMAR_CHAT_MAX_OUTPUT_TOKENS
              : scope === "samar"
                ? NORMAL_SAMAR_CHAT_MAX_OUTPUT_TOKENS
                : 900,
        })) {
          answer += delta;
          sendSse(res, "token", { delta });
        }
      } catch (error) {
        if (answer) throw error;
        const verifiedFallback = verifiedDetailsFallback(verifiedDetails);
        if (!verifiedFallback) throw error;
        sendSse(res, "token", { delta: verifiedFallback });
        sendSse(res, "done", { ok: true });
        return res.end();
      }
      const formattedAnswer = combineFriendlyAndVerifiedAnswer(answer, verifiedDetails);
      if (cacheKey) cacheSamarChatResponse(cacheKey, formattedAnswer, labels);
      sendSse(res, "done", { ok: true });
      return res.end();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to generate a response.";
      const visitorMessage = visitorChatError(message);
      if (!res.headersSent) return sendError(res, 500, visitorMessage);
      sendSse(res, "error", { message: visitorMessage });
      res.end();
    }
  });

  app.post("/api/job-match", express.json({ limit: "100kb" }), async (req, res) => {
    try {
      const scope: ChatScope = req.body?.scope === "uploaded" ? "uploaded" : "samar";
      const jobDescription = typeof req.body?.jobDescription === "string" ? req.body.jobDescription.trim().slice(0, 12_000) : "";
      if (jobDescription.length < 80) return sendError(res, 400, "Please provide at least a short job description to compare.");

      let selectedSections: KnowledgeSection[];
      if (scope === "uploaded") {
        const shareToken = typeof req.body?.shareToken === "string" ? req.body.shareToken : "";
        const session = shareToken ? await getActiveUpload(shareToken) : undefined;
        if (!session) return sendError(res, 404, "Upload a resume or open a valid shared resume session first.");
        selectedSections = session.sections;
      } else {
        selectedSections = [profileKnowledgeSection(DEFAULT_PORTFOLIO_PROFILE), ...SAMAR_KNOWLEDGE_BASE];
      }

      const match = await createJobMatch(scope, selectedSections, jobDescription);
      return res.json({
        scope,
        result: match.result,
        markdown: formatJobMatchMarkdown(match.result),
        evidenceLabels: sourceLabels(match.evidence),
      });
    } catch (error) {
      return sendError(res, 500, error instanceof Error ? error.message : "Unable to compare the resume with this job description.");
    }
  });

  pruneExpiredResumeSessions();
}
