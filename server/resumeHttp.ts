import crypto from "crypto";
import path from "path";
import type { Express, Request, Response } from "express";
import express from "express";
import { SAMAR_KNOWLEDGE_BASE, type KnowledgeSection } from "./defaultKnowledge";
import { formatProjectCatalog, getGitHubProjects, projectKnowledgeSections } from "./github";
import { generateGeminiText } from "./geminiDirect";
import { createJobMatch, formatJobMatchMarkdown } from "./jobMatch";
import { getLivePortfolioRefresh } from "./portfolioSource";
import { buildGroundedSystemPrompt, certificationCatalogAnswer, detailedExperienceAnswer, favoriteMediaAnswer, formatAsBulletList, hometownAnswer, isGreetingOnly, profileLinkAnswer, requestsProjectCatalog, retrieveRelevantSections, sourceLabels, splitResumeIntoSections, type ChatScope } from "./rag";
import { DEFAULT_PORTFOLIO_PROFILE, profileKnowledgeSection } from "./profile";
import { extractResumeText, MAX_RESUME_BYTES, validateResumeUpload } from "./resumeProcessing";
import { createInMemoryResumeSession, deleteInMemoryResumeSession, getInMemoryResumeSession, pruneExpiredResumeSessions } from "./resumeSessionStore";

const UPLOAD_TTL_MS = 4 * 60 * 60 * 1000;
const MAX_HISTORY_MESSAGES = 8;

type ClientMessage = { role: "user" | "assistant"; content: string };

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

      const directHometown = scope === "samar" ? hometownAnswer(question) : null;
      if (directHometown) {
        res.status(200);
        res.set({
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "Content-Type": "text/event-stream",
          "X-Accel-Buffering": "no",
        });
        res.flushHeaders();
        sendSse(res, "sources", { labels: [directHometown.title] });
        sendSse(res, "token", { delta: directHometown.answer });
        sendSse(res, "done", { ok: true });
        return res.end();
      }

      const directExperience = scope === "samar" ? detailedExperienceAnswer(question) : null;
      if (directExperience) {
        res.status(200);
        res.set({
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "Content-Type": "text/event-stream",
          "X-Accel-Buffering": "no",
        });
        res.flushHeaders();
        sendSse(res, "sources", { labels: [directExperience.title] });
        sendSse(res, "token", { delta: directExperience.answer });
        sendSse(res, "done", { ok: true });
        return res.end();
      }

      const directFavoriteMedia = scope === "samar" ? favoriteMediaAnswer(question) : null;
      if (directFavoriteMedia) {
        res.status(200);
        res.set({
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "Content-Type": "text/event-stream",
          "X-Accel-Buffering": "no",
        });
        res.flushHeaders();
        sendSse(res, "sources", { labels: [directFavoriteMedia.title] });
        sendSse(res, "token", { delta: directFavoriteMedia.answer });
        sendSse(res, "done", { ok: true });
        return res.end();
      }

      const directProfileLink = scope === "samar" ? profileLinkAnswer(question) : null;
      if (directProfileLink) {
        const livePortfolio = await getLivePortfolioRefresh();
        const refreshedProfileLink = profileLinkAnswer(question, { resumeUrl: livePortfolio.resumeUrl }) ?? directProfileLink;
        res.status(200);
        res.set({
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "Content-Type": "text/event-stream",
          "X-Accel-Buffering": "no",
        });
        res.flushHeaders();
        sendSse(res, "sources", { labels: [refreshedProfileLink.title] });
        sendSse(res, "token", { delta: refreshedProfileLink.answer });
        sendSse(res, "done", { ok: true });
        return res.end();
      }

      const directCertificationCatalog = scope === "samar" ? certificationCatalogAnswer(question) : null;
      if (directCertificationCatalog) {
        const livePortfolio = await getLivePortfolioRefresh();
        const refreshedCertificationCatalog = certificationCatalogAnswer(question, livePortfolio.certificationCatalog) ?? directCertificationCatalog;
        res.status(200);
        res.set({
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "Content-Type": "text/event-stream",
          "X-Accel-Buffering": "no",
        });
        res.flushHeaders();
        sendSse(res, "sources", { labels: [refreshedCertificationCatalog.title] });
        sendSse(res, "token", { delta: refreshedCertificationCatalog.answer });
        sendSse(res, "done", { ok: true });
        return res.end();
      }

      if (scope === "samar" && requestsProjectCatalog(question)) {
        const projects = await getGitHubProjects(DEFAULT_PORTFOLIO_PROFILE.githubUsername, { forceRefresh: true });
        res.status(200);
        res.set({
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "Content-Type": "text/event-stream",
          "X-Accel-Buffering": "no",
        });
        res.flushHeaders();
        sendSse(res, "sources", { labels: ["GitHub Projects"] });
        sendSse(res, "token", { delta: formatProjectCatalog(projects) });
        sendSse(res, "done", { ok: true });
        return res.end();
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
        try {
          projectSections = projectKnowledgeSections(await getGitHubProjects(profile.githubUsername));
        } catch {
          // A temporary GitHub API failure must not affect the permanent profile chat.
        }
        samarSections = [profileKnowledgeSection(profile), ...projectSections, ...SAMAR_KNOWLEDGE_BASE];
      }

      const asksForProjectCatalog = scope === "samar" && /\b(github|repo|repository|repositories|project|projects)\b/i.test(question);
      const asksForCredentialCatalog = scope === "samar" && /\b(certification|certifications|credential|credentials|badge|badges)\b/i.test(question);
      const asksForCareerProfile = scope === "samar" && /\b(core strengths?|preferred roles?|work preferences?|current client (?:work|project)|scrapy)\b/i.test(question);
      const asksForExperience = scope === "samar" && /\b(?:experience|experince|career|professional journey|work history|work background|internship|internships)\b/i.test(question);
      const sources = retrieveRelevantSections(scope, question, uploadedSections, asksForProjectCatalog || asksForCredentialCatalog ? 30 : 4, samarSections);
      const systemPrompt = buildGroundedSystemPrompt(scope, sources);
      const history = parseHistory(req.body?.history);
      res.status(200);
      res.set({
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream",
        "X-Accel-Buffering": "no",
      });
      res.flushHeaders();
      sendSse(res, "sources", { labels: sourceLabels(sources) });
      const answer = await generateGeminiText({
        systemPrompt,
        messages: [...history, { role: "user", content: question }],
        temperature: 0.8,
        maxOutputTokens: asksForProjectCatalog || asksForCredentialCatalog ? 2_200 : asksForExperience || asksForCareerProfile ? 1_400 : 900,
      });
      const formattedAnswer = formatAsBulletList(answer);
      if (formattedAnswer) sendSse(res, "token", { delta: formattedAnswer });
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
