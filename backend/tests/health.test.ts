import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

const app = buildApp();

afterAll(async () => {
  await app.close();
});

describe('GET /v1/health', () => {
  it('returns service health', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'ok',
      service: 'grow-backend',
    });
  });
});
