import { afterEach, describe, expect, it } from "vitest";
import { clearInMemoryResumeSessionsForTest, createInMemoryResumeSession, deleteInMemoryResumeSession, getInMemoryResumeSession, pruneExpiredResumeSessions } from "./resumeSessionStore";

afterEach(() => clearInMemoryResumeSessionsForTest());

describe("in-memory resume sessions", () => {
  it("keeps parsed sections only in the active server process and requires the private delete token", () => {
    createInMemoryResumeSession({
      shareToken: "session-token",
      deleteToken: "delete-token",
      originalFilename: "candidate.pdf",
      sections: [{ title: "Experience", content: "Grounded candidate content." }],
      expiresAt: new Date(Date.now() + 60_000),
      lastAccessedAt: new Date(),
    });

    expect(getInMemoryResumeSession("session-token")?.sections[0]?.title).toBe("Experience");
    expect(deleteInMemoryResumeSession("session-token", "wrong-token")).toBe(false);
    expect(deleteInMemoryResumeSession("session-token", "delete-token")).toBe(true);
    expect(getInMemoryResumeSession("session-token")).toBeUndefined();
  });

  it("prunes expired session content", () => {
    createInMemoryResumeSession({
      shareToken: "expired-token",
      deleteToken: "delete-token",
      originalFilename: "expired.pdf",
      sections: [{ title: "Skills", content: "Expired content." }],
      expiresAt: new Date(Date.now() - 1),
      lastAccessedAt: new Date(),
    });

    expect(pruneExpiredResumeSessions()).toBe(1);
    expect(getInMemoryResumeSession("expired-token")).toBeUndefined();
  });
});
