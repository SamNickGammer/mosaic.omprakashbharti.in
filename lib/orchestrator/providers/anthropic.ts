import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText, type ModelMessage } from "ai";

export interface ProviderStreamParams {
  apiKey: string;
  model: string;
  system: string;
  messages: ModelMessage[];
}

/**
 * Streams a response from Anthropic via the Vercel AI SDK using a per-agent
 * API key (decrypted at call time — never persisted or logged).
 *
 * Returns the StreamTextResult; the caller consumes `.textStream`.
 */
export function streamAnthropic(params: ProviderStreamParams) {
  const anthropic = createAnthropic({ apiKey: params.apiKey });
  return streamText({
    model: anthropic(params.model),
    system: params.system,
    messages: params.messages,
  });
}
