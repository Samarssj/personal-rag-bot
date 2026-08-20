export type GeminiMessage = {
  role: "user" | "assistant";
  content: string;
};

type GeminiApiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
};

const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

export function getGeminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("Gemini is not configured. Set GEMINI_API_KEY on the server.");
  return { apiKey, model: process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL };
}

export function toGeminiContents(messages: GeminiMessage[]) {
  return messages.map(message => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));
}

export async function generateGeminiText({
  systemPrompt,
  messages,
  temperature = 0.7,
  maxOutputTokens = 1_200,
  responseMimeType,
}: {
  systemPrompt: string;
  messages: GeminiMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: "application/json";
}): Promise<string> {
  const { apiKey, model } = getGeminiConfig();
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: toGeminiContents(messages),
      generationConfig: {
        temperature: Math.max(0, Math.min(temperature, 2)),
        maxOutputTokens,
        ...(responseMimeType ? { responseMimeType } : {}),
      },
    }),
  });

  const payload = await response.json().catch(() => ({})) as GeminiApiResponse;
  if (!response.ok) throw new Error(payload.error?.message || `Gemini request failed with HTTP ${response.status}.`);

  const text = payload.candidates?.[0]?.content?.parts
    ?.map(part => part.text ?? "")
    .join("")
    .trim();
  if (text) return text;
  if (payload.promptFeedback?.blockReason) throw new Error("Gemini could not return a response for this request.");
  throw new Error("Gemini returned an empty response.");
}
