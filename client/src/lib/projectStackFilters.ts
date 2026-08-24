export type ProjectStackFilter = {
  id: "ai" | "ml" | "full-stack";
  label: string;
  description: string;
  prompt: string;
};

/** Curated project-stack prompts for the public Samar portfolio chat. */
export const PROJECT_STACK_FILTERS = [
  {
    id: "ai",
    label: "AI",
    description: "News Pilot and Jarvis",
    prompt: "What are your best AI projects? Include what each project does and the relevant GitHub or live links.",
  },
  {
    id: "ml",
    label: "ML",
    description: "Credit-Guard",
    prompt: "What is your best machine-learning project? Explain the problem it solves and share the relevant GitHub or live links.",
  },
  {
    id: "full-stack",
    label: "Full-Stack",
    description: "OptimizerOS and Auto Apply",
    prompt: "What are your best full-stack projects? Explain OptimizerOS and Auto Apply and share their relevant GitHub or live links.",
  },
] as const satisfies readonly ProjectStackFilter[];
