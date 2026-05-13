import OpenAI from "openai";

export interface JsonGenerationRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface JsonProvider {
  generateJson<T>(request: JsonGenerationRequest): Promise<T>;
}

export interface OpenAIProviderOptions {
  apiKey?: string;
  model?: string;
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

export class OpenAIProvider implements JsonProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(options: OpenAIProviderOptions = {}) {
    const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required for OpenAIProvider");
    }

    this.client = new OpenAI({ apiKey });
    this.model = options.model ?? "gpt-4.1-mini";
  }

  async generateJson<T>({
    systemPrompt,
    userPrompt,
    temperature = 0.1,
    maxOutputTokens = 900,
  }: JsonGenerationRequest): Promise<T> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature,
      max_completion_tokens: maxOutputTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      throw new Error("OpenAI returned an empty response");
    }

    return JSON.parse(extractJson(content)) as T;
  }
}
