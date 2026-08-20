import type { KnowledgeSection } from "./defaultKnowledge";

export const PROFILE_SETTINGS_ID = "samar";

export type PortfolioProfile = {
  id: string;
  about: string;
  birthDate: string;
  relationshipStatus: string;
  githubUsername: string;
  updatedAt?: Date;
};

export const DEFAULT_PORTFOLIO_PROFILE: PortfolioProfile = {
  id: PROFILE_SETTINGS_ID,
  about:
    "I am Samar Satnam Singh, a fresher and Associate AI Developer at EXL who builds AI solutions, automations, conversational AI, and agentic chatbots.",
  birthDate: "2004-09-23",
  relationshipStatus: "Single and trying things out",
  githubUsername: "Samarssj",
};

export function calculateAge(birthDate: string, at = new Date()): number {
  const [year, month, day] = birthDate.split("-").map(Number);
  const hasHadBirthday = at.getMonth() + 1 > month || (at.getMonth() + 1 === month && at.getDate() >= day);
  return at.getFullYear() - year - (hasHadBirthday ? 0 : 1);
}

export function formatBirthDate(birthDate: string): string {
  const [year, month, day] = birthDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

export function profileKnowledgeSection(profile: PortfolioProfile, at = new Date()): KnowledgeSection {
  const age = calculateAge(profile.birthDate, at);
  const currentDate = at.toISOString().slice(0, 10);
  return {
    title: "Portfolio Details",
    content:
      `Today is ${currentDate}. I am currently ${age} years old. My date of birth is ${formatBirthDate(profile.birthDate)}. ` +
      `Calculate my age from this date of birth whenever a question uses a different year or date. My relationship status is ${profile.relationshipStatus}. ` +
      `My GitHub username is ${profile.githubUsername}. ${profile.about}`,
  };
}
