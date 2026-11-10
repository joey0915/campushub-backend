import request from 'supertest';

import { createApp } from '../../app';
import { env } from '../../config/env';
import { isRecord } from '../../utils/validation';

describe('GET /health', () => {
  it('returns 200 with status ok while the database is connected', async (): Promise<void> => {
    const res = await request(createApp()).get(`/api/${env.apiVersion}/health`);

    const body: unknown = res.body;
    expect(res.status).toBe(200);
    expect(isRecord(body)).toBe(true);
    expect(body).toMatchObject({
      status: 'ok',
      service: 'campushub-backend',
      environment: 'test',
      dependencies: { database: 'connected' },
    });
  });
});
