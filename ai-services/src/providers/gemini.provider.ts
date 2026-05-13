import { GoogleGenerativeAI } from "@google/generative-ai";
import type { JsonGenerationRequest, JsonProvider } from "./openai.provider.js";

export interface GeminiProviderOptions {
  apiKey?: string;
  model?: string;
  useGoogleSearch?: boolean;
}

const extractJson = (value: string): string => {
  const trimmed = value.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);

  if (fenced) {
    return fenced[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
};

export class GeminiProvider implements JsonProvider {
  private readonly client: GoogleGenerativeAI;
  private readonly model: string;
  private readonly useGoogleSearch: boolean;

  constructor(options: GeminiProviderOptions = {}) {
    const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is required for GeminiProvider");
    }

    this.client = new GoogleGenerativeAI(apiKey);
    this.model = options.model ?? "gemini-1.5-flash";
    this.useGoogleSearch = options.useGoogleSearch ?? true;
  }

  async generateJson<T>({
    systemPrompt,
    userPrompt,
    temperature = 0.2,
    maxOutputTokens = 900,
  }: JsonGenerationRequest): Promise<T> {
    const model = this.client.getGenerativeModel({ model: this.model });
    const request: Record<string, unknown> = {
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
        },
      ],
      generationConfig: {
        temperature,
        maxOutputTokens,
        responseMimeType: "application/json",
      },
    };

    if (this.useGoogleSearch) {
      request.tools = [{ googleSearchRetrieval: {} }];
    }

    const result = await model.generateContent(request as any);
    const content = result.response.text();

    if (!content) {
      throw new Error("Gemini returned an empty response");
    }

    return JSON.parse(extractJson(content)) as T;
  }
}
