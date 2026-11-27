import type { MentorProvider, MentorProviderRequest, MentorProviderResponse } from './mentorProvider.js';
import { MentorProviderError } from './mentorProvider.js';

export const MOCK_MENTOR_MODEL = 'grow-mock-mentor-v1';

/**
 * Deterministic placeholder until a real LLM vendor is chosen (ticket M4).
 * It never calls the network and is safe for development and tests.
 */
export function createMockMentorProvider(): MentorProvider {
  return {
    name: 'mock',

    async generateReply(request: MentorProviderRequest): Promise<MentorProviderResponse> {
      if (request.signal.aborted) {
        throw new MentorProviderError('timeout', 'Mentor provider request was aborted.');
      }

      const lastUserMessage = [...request.messages].reverse().find((message) => message.role === 'user');
      if (!lastUserMessage) {
        throw new MentorProviderError('invalid_response', 'Mentor provider needs a user message.');
      }

      const preview = lastUserMessage.content.trim().slice(0, 120);
      const content = [
        'Ich bin dein Grow Mentor (Testmodus).',
        `Du hast geschrieben: „${preview}“`,
        'Was ist der nächste kleine Schritt, den du heute dafür machen kannst?',
      ].join('\n\n');

      return {
        content,
        model: MOCK_MENTOR_MODEL,
        inputTokens: null,
        outputTokens: null,
        truncated: false,
      };
    },
  };
}
