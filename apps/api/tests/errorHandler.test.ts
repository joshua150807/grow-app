import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { AppError } from '../src/errors/appError.js';

describe('error handling', () => {
  it('formats AppError responses consistently', async () => {
    const app = buildApp();

    app.get('/test-error', async () => {
      throw new AppError(400, 'BAD_REQUEST', 'Broken test request.', {
        field: 'example',
      });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/test-error',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: {
        code: 'BAD_REQUEST',
        message: 'Broken test request.',
        details: {
          field: 'example',
        },
      },
    });

    await app.close();
  });

  it('formats missing routes consistently', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'GET',
      url: '/missing',
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');

    await app.close();
  });
});
