export type GeminiMessage = {
  role: "user" | "assistant";
  content: string;
};

export type GeminiThinkingLevel = "minimal" | "low" | "medium" | "high";

type GeminiApiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
};

export const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";
export const DEFAULT_GEMINI_FALLBACK_MODEL = "gemini-2.5-flash";

class GeminiRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "GeminiRequestError";
  }
}

export function getGeminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("Gemini is not configured. Set GEMINI_API_KEY on the server.");
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const configuredFallback = process.env.GEMINI_FALLBACK_MODEL?.trim() || DEFAULT_GEMINI_FALLBACK_MODEL;
  return { apiKey, model, fallbackModel: configuredFallback === model ? null : configuredFallback };
}

export function toGeminiContents(messages: GeminiMessage[]) {
  return messages.map(message => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));
}

function geminiRequestBody({ systemPrompt, messages, temperature, maxOutputTokens, responseMimeType, thinkingLevel }: {
  systemPrompt: string;
  messages: GeminiMessage[];
  temperature: number;
  maxOutputTokens: number;
  responseMimeType?: "application/json";
  thinkingLevel?: GeminiThinkingLevel;
}) {
  return JSON.stringify({
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: toGeminiContents(messages),
    generationConfig: {
      temperature: Math.max(0, Math.min(temperature, 2)),
      maxOutputTokens,
      ...(responseMimeType ? { responseMimeType } : {}),
      ...(thinkingLevel ? { thinkingConfig: { thinkingLevel } } : {}),
    },
  });
}

function isRetryableGeminiFailure(error: unknown): boolean {
  if (!(error instanceof GeminiRequestError)) return true;
  return [404, 408, 409, 429, 500, 502, 503, 504].includes(error.status);
}

async function generateGeminiTextForModel({
  apiKey,
  model,
  request,
}: {
  apiKey: string;
  model: string;
  request: {
    systemPrompt: string;
    messages: GeminiMessage[];
    temperature: number;
    maxOutputTokens: number;
    responseMimeType?: "application/json";
    thinkingLevel?: GeminiThinkingLevel;
  };
}): Promise<string> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: geminiRequestBody(request),
  });

  const payload = await response.json().catch(() => ({})) as GeminiApiResponse;
  if (!response.ok) {
    const providerMessage = payload.error?.message?.trim() || `Gemini request failed with HTTP ${response.status}.`;
    throw new GeminiRequestError(`Gemini model ${model} returned HTTP ${response.status}: ${providerMessage}`, response.status);
  }

  const text = payload.candidates?.[0]?.content?.parts
    ?.map(part => part.text ?? "")
    .join("")
    .trim();
  if (text) return text;
  if (payload.promptFeedback?.blockReason) throw new GeminiRequestError("Gemini could not return a response for this request.", 400);
  throw new GeminiRequestError("Gemini returned an empty response.", 502);
}

/** Extracts text from one Gemini `streamGenerateContent` SSE event. */
export function extractGeminiStreamText(frame: string): string {
  const rawData = frame
    .split(/\r?\n/)
    .filter(line => line.startsWith("data:"))
    .map(line => line.replace(/^data:\s*/, ""))
    .join("\n");
  if (!rawData || rawData === "[DONE]") return "";
  try {
    const payload = JSON.parse(rawData) as GeminiApiResponse;
    return payload.candidates?.[0]?.content?.parts
      ?.map(part => part.text ?? "")
      .join("") ?? "";
  } catch {
    return "";
  }
}

export async function generateGeminiText({
  systemPrompt,
  messages,
  temperature = 0.7,
  maxOutputTokens = 1_200,
  responseMimeType,
  thinkingLevel,
}: {
  systemPrompt: string;
  messages: GeminiMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: "application/json";
  thinkingLevel?: GeminiThinkingLevel;
}): Promise<string> {
  const request = { systemPrompt, messages, temperature, maxOutputTokens, responseMimeType, thinkingLevel };
  const { apiKey, model, fallbackModel } = getGeminiConfig();
  try {
    return await generateGeminiTextForModel({ apiKey, model, request });
  } catch (error) {
    if (!fallbackModel || !isRetryableGeminiFailure(error)) throw error;
    return generateGeminiTextForModel({ apiKey, model: fallbackModel, request });
  }
}

/**
 * Streams Gemini output as it arrives. If the stream cannot be opened before any text is emitted,
 * the established non-streaming request remains the resilient fallback.
 */
export async function* streamGeminiText({
  systemPrompt,
  messages,
  temperature = 0.7,
  maxOutputTokens = 1_200,
  responseMimeType,
  thinkingLevel,
}: {
  systemPrompt: string;
  messages: GeminiMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: "application/json";
  thinkingLevel?: GeminiThinkingLevel;
}): AsyncGenerator<string> {
  const request = { systemPrompt, messages, temperature, maxOutputTokens, responseMimeType, thinkingLevel };
  const { apiKey, model } = getGeminiConfig();
  let emittedText = false;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: geminiRequestBody(request),
    });

    if (!response.ok || !response.body) {
      yield await generateGeminiText(request);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const readFrame = (frame: string) => extractGeminiStreamText(frame);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const text = readFrame(frame);
        if (text) {
          emittedText = true;
          yield text;
        }
      }
    }

    const remainingText = readFrame(buffer);
    if (remainingText) {
      emittedText = true;
      yield remainingText;
    }
    if (!emittedText) yield await generateGeminiText(request);
  } catch (error) {
    if (!emittedText) {
      yield await generateGeminiText(request);
      return;
    }
    throw error;
  }
}
