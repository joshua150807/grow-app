import Anthropic from '@anthropic-ai/sdk';
import type { AppConfig } from '../../../config/index.js';
import {
  MentorProviderError,
  type MentorProvider,
  type MentorProviderRequest,
  type MentorProviderResponse,
} from './mentorProvider.js';

export type AnthropicMentorProviderConfig = Pick<
  AppConfig,
  'ANTHROPIC_API_KEY' | 'MENTOR_ANTHROPIC_MODEL' | 'MENTOR_ANTHROPIC_EFFORT'
>;

type BetaCreateParams = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;
type BetaMessage = Anthropic.Beta.Messages.BetaMessage;

/** The subset of the SDK client the provider uses; injectable for tests. */
export type AnthropicMessagesClient = {
  beta: {
    messages: {
      create(params: BetaCreateParams, options?: Anthropic.RequestOptions): PromiseLike<BetaMessage>;
    };
  };
};

// Safe fallback text when the model (and the server-side fallback) declines.
export const MENTOR_REFUSAL_REPLY =
  'Dabei kann ich dir leider nicht helfen. Lass uns gern an deinen Zielen, Gewohnheiten, deinem Training oder deinem Business weiterarbeiten.';

function mapSdkError(error: unknown): MentorProviderError {
  if (error instanceof MentorProviderError) return error;
  if (error instanceof Anthropic.APIUserAbortError || error instanceof Anthropic.APIConnectionTimeoutError) {
    return new MentorProviderError('timeout', 'Anthropic request timed out.', { cause: error });
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new MentorProviderError('rate_limited', 'Anthropic rate limit reached.', { cause: error });
  }
  // Authentication, permission, billing (no credit), overload and server errors
  // all mean: the mentor cannot answer right now.
  return new MentorProviderError('unavailable', 'Anthropic request failed.', { cause: error });
}

export function createAnthropicMentorProvider(
  config: AnthropicMentorProviderConfig,
  client?: AnthropicMessagesClient,
): MentorProvider {
  if (!client && !config.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is required for MENTOR_PROVIDER=anthropic.');
  }

  // Retries are kept low: the reply engine owns the overall timeout.
  const anthropic: AnthropicMessagesClient = client
    ?? new Anthropic({ apiKey: config.ANTHROPIC_API_KEY, maxRetries: 1 });

  return {
    name: 'anthropic',

    async generateReply(request: MentorProviderRequest): Promise<MentorProviderResponse> {
      const messages: Anthropic.Beta.Messages.BetaMessageParam[] = request.messages
        .map((item) => ({ role: item.role, content: item.content }));
      const tools = request.tools?.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema as Anthropic.Beta.Messages.BetaTool.InputSchema,
      }));
      const maxRounds = request.onToolCall && tools?.length ? (request.maxToolRounds ?? 0) : 0;

      const texts: string[] = [];
      let inputTokens = 0;
      let outputTokens = 0;
      let message: BetaMessage | null = null;

      for (let round = 0; ; round += 1) {
        try {
          message = await anthropic.beta.messages.create(
            {
              model: config.MENTOR_ANTHROPIC_MODEL,
              max_tokens: request.maxOutputTokens,
              system: request.system,
              messages,
              ...(tools?.length ? { tools } : {}),
              output_config: { effort: config.MENTOR_ANTHROPIC_EFFORT },
              // Caches the stable prefix (tools, system prompt, earlier turns).
              cache_control: { type: 'ephemeral' },
              // On a safety decline, let the API retry on a suitable fallback model.
              betas: ['server-side-fallback-2026-07-01'],
              fallbacks: 'default',
            },
            { signal: request.signal },
          );
        } catch (error) {
          throw mapSdkError(error);
        }

        inputTokens += (message.usage.input_tokens ?? 0)
          + (message.usage.cache_read_input_tokens ?? 0)
          + (message.usage.cache_creation_input_tokens ?? 0);
        outputTokens += message.usage.output_tokens ?? 0;

        const text = message.content
          .filter((block): block is Anthropic.Beta.Messages.BetaTextBlock => block.type === 'text')
          .map((block) => block.text)
          .join('\n')
          .trim();
        if (text) texts.push(text);

        const toolUses = message.content.filter(
          (block): block is Anthropic.Beta.Messages.BetaToolUseBlock => block.type === 'tool_use',
        );
        if (message.stop_reason !== 'tool_use' || toolUses.length === 0 || round >= maxRounds || !request.onToolCall) {
          break;
        }

        // Pass the assistant turn back unchanged (incl. thinking blocks), then the results.
        messages.push({ role: 'assistant', content: message.content as Anthropic.Beta.Messages.BetaContentBlockParam[] });
        const results: Anthropic.Beta.Messages.BetaToolResultBlockParam[] = [];
        for (const toolUse of toolUses) {
          const result = await request.onToolCall({ name: toolUse.name, input: toolUse.input });
          results.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: result.content,
            ...(result.isError ? { is_error: true } : {}),
          });
        }
        messages.push({ role: 'user', content: results });
      }

      if (message?.stop_reason === 'refusal') {
        return { content: MENTOR_REFUSAL_REPLY, model: message.model, inputTokens, outputTokens, truncated: false };
      }

      const content = texts.join('\n\n').trim();
      if (!message || !content) {
        throw new MentorProviderError('invalid_response', 'Anthropic returned no text.');
      }

      return {
        content,
        model: message.model,
        inputTokens,
        outputTokens,
        truncated: message.stop_reason === 'max_tokens',
      };
    },
  };
}
