import type { AppConfig } from '../../../config/index.js';
import type { MentorProvider } from './mentorProvider.js';
import { createMockMentorProvider } from './mockMentorProvider.js';

export function createMentorProvider(config: Pick<AppConfig, 'MENTOR_PROVIDER'>): MentorProvider {
  switch (config.MENTOR_PROVIDER) {
    case 'mock':
      return createMockMentorProvider();
    default: {
      const unsupported: never = config.MENTOR_PROVIDER;
      throw new Error(`Unsupported mentor provider: ${String(unsupported)}`);
    }
  }
}
