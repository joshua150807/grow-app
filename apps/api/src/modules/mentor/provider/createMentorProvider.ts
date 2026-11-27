import type { AppConfig } from '../../../config/index.js';
import { createAnthropicMentorProvider } from './anthropicMentorProvider.js';
import type { MentorProvider } from './mentorProvider.js';
import { createMockMentorProvider } from './mockMentorProvider.js';

export type MentorProviderConfig = Pick<
  AppConfig,
  'MENTOR_PROVIDER' | 'ANTHROPIC_API_KEY' | 'MENTOR_ANTHROPIC_MODEL' | 'MENTOR_ANTHROPIC_EFFORT'
>;

export function createMentorProvider(config: MentorProviderConfig): MentorProvider {
  switch (config.MENTOR_PROVIDER) {
    case 'mock':
      return createMockMentorProvider();
    case 'anthropic':
      return createAnthropicMentorProvider(config);
    default: {
      const unsupported: never = config.MENTOR_PROVIDER;
      throw new Error(`Unsupported mentor provider: ${String(unsupported)}`);
    }
  }
}
