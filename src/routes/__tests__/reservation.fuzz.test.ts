import { Types } from 'mongoose';
import request from 'supertest';

import { createApp } from '../../app';
import { env } from '../../config/env';
import { expectBody, isErrorResponse, isReservation } from '../../test/contract-guards';
import { seedResource } from '../../test/fixtures';

const app = createApp();
const API = `/api/${env.apiVersion}`;
const CASES = 150;
// A fixed seed keeps a failure reproducible: rerun and the same payload fails again.
const SEED = 0x5500_0007;

/** mulberry32: a tiny deterministic PRNG, so the fuzz corpus is the same on every run. */
function createRandom(seed: number): () => number {
  let state = seed;
  return (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const MISSING = Symbol('missing');
const EXPECTED_STATUSES: readonly number[] = [201, 400, 409];

const HOSTILE_VALUES: readonly unknown[] = [
  MISSING,
  null,
  0,
  -1,
  Number.MAX_SAFE_INTEGER,
  true,
  [],
  ['2026-12-01T10:00:00Z'],
  {},
  { $ne: null },
  '',
  ' ',
  'a'.repeat(10_000),
  '😀',
  '\u0000',
  '../../etc/passwd',
  '{"$gt":""}',
  '2026-12-01T10:00:00Z ',
  '2026-02-29T10:00:00Z',
  '2026-12-01T10:00:00.123456789Z',
  '0000-01-01T00:00:00Z',
  '9999-12-31T23:59:59Z',
  '2026-12-01T10:00:00+14:00',
  '2026-12-01T10:00:00-23:59',
];

function pick<T>(random: () => number, values: readonly T[]): T {
  const value = values[Math.floor(random() * values.length)];
  if (value === undefined) {
    throw new Error('pick() from an empty list');
  }
  return value;
}

function randomInstant(random: () => number): string {
  const base = Date.parse('2026-12-01T00:00:00Z');
  return new Date(base + Math.floor(random() * 4) * 1_800_000).toISOString();
}

/** A valid payload with each field independently kept, replaced by a hostile value, or dropped. */
function mutatePayload(random: () => number, resourceId: string): Record<string, unknown> {
  const valid: Record<string, unknown> = {
    resourceId: random() < 0.15 ? new Types.ObjectId().toHexString() : resourceId,
    userId: pick(random, ['student-1', 'staff_2', 'X']),
    startTime: randomInstant(random),
    endTime: randomInstant(random),
  };
  const payload: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(valid)) {
    const candidate = random() < 0.5 ? value : pick(random, HOSTILE_VALUES);
    if (candidate !== MISSING) {
      payload[field] = candidate;
    }
  }
  if (random() < 0.1) {
    payload[pick(random, ['status', 'id', 'tenantId', 'extra'])] = 'injected';
  }
  return payload;
}

describe('POST /reservations under seeded fuzzing', () => {
  it(`answers ${String(CASES)} mutated payloads with 201, 400, or 409 and never 500`, async (): Promise<void> => {
    const resource = await seedResource(env.defaultTenantId);
    const random = createRandom(SEED);
    const seen = new Set<number>();

    for (let index = 0; index < CASES; index += 1) {
      const payload = mutatePayload(random, resource._id.toHexString());
      const res = await request(app).post(`${API}/reservations`).send(payload);
      seen.add(res.status);

      if (!EXPECTED_STATUSES.includes(res.status)) {
        const sample = JSON.stringify(payload).slice(0, 300);
        throw new Error(`case ${String(index)} answered ${String(res.status)}: ${sample}`);
      }
      if (res.status === 201) {
        expectBody(res.body, isReservation);
      } else {
        expectBody(res.body, isErrorResponse);
      }
    }

    // The corpus must reach every outcome, or it is not exercising the double-booking path.
    expect([...seen].sort()).toEqual([201, 400, 409]);
  });
});
