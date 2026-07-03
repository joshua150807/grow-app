import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/index.js';

describe('config', () => {
  it('loads defaults for local development', () => {
    const config = loadConfig({});

    expect(config.NODE_ENV).toBe('development');
    expect(config.PORT).toBe(4000);
    expect(config.LOG_LEVEL).toBe('info');
  });

  it('validates the port value', () => {
    expect(() => loadConfig({ PORT: 'invalid' })).toThrow();
  });
});
