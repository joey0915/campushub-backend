import { Types } from 'mongoose';
import request from 'supertest';

import { createApp } from '../../app';
import { env } from '../../config/env';
import { ReservationModel } from '../../models/Reservation.model';
import { reservationService } from '../../services/reservation.service';
import {
  expectBody,
  expectList,
  isErrorResponse,
  isReservation,
  isResource,
} from '../../test/contract-guards';
import { seedReservation, seedResource, shiftMs } from '../../test/fixtures';

const app = createApp();
const API = `/api/${env.apiVersion}`;
const TENANT = env.defaultTenantId;
const START = '2026-12-01T10:00:00.000Z';
const END = '2026-12-01T11:00:00.000Z';

function validBody(resourceId: Types.ObjectId): Record<string, unknown> {
  return {
    resourceId: resourceId.toHexString(),
    userId: 'student-1',
    startTime: START,
    endTime: END,
  };
}

function expectError(body: unknown, code: string): void {
  expect(expectBody(body, isErrorResponse).code).toBe(code);
}

describe('POST /reservations', () => {
  it('returns 201 Created with the stored reservation', async (): Promise<void> => {
    const resource = await seedResource(TENANT);

    const res = await request(app).post(`${API}/reservations`).send(validBody(resource._id));

    expect(res.status).toBe(201);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    const reservation = expectBody(res.body, isReservation);
    expect(reservation).toMatchObject({
      resourceId: resource._id.toHexString(),
      userId: 'student-1',
      startTime: START,
      endTime: END,
      status: 'PENDING',
    });
    expect(await ReservationModel.exists({ _id: reservation.id, tenantId: TENANT })).not.toBeNull();
  });

  it('returns 201 for a slot that starts exactly when the booked one ends', async (): Promise<void> => {
    const resource = await seedResource(TENANT);
    await seedReservation(TENANT, { resourceId: resource._id, startTime: START, endTime: END });

    const res = await request(app)
      .post(`${API}/reservations`)
      .send({ ...validBody(resource._id), startTime: END, endTime: shiftMs(END, 3_600_000) });

    expect(res.status).toBe(201);
  });

  it.each([
    ['the exact same window', START, END],
    ['a window overlapping by 1 ms', shiftMs(END, -1), shiftMs(END, 3_600_000)],
    ['a window enclosing the booked one', shiftMs(START, -60_000), shiftMs(END, 60_000)],
  ])('returns 409 DOUBLE_BOOKING for %s', async (_label, startTime, endTime): Promise<void> => {
    const resource = await seedResource(TENANT);
    await seedReservation(TENANT, { resourceId: resource._id, startTime: START, endTime: END });

    const res = await request(app)
      .post(`${API}/reservations`)
      .send({ ...validBody(resource._id), startTime, endTime });

    expect(res.status).toBe(409);
    expectError(res.body, 'DOUBLE_BOOKING');
    expect(await ReservationModel.countDocuments({}).exec()).toBe(1);
  });

  it('returns 409 for the second of two sequential identical requests', async (): Promise<void> => {
    const resource = await seedResource(TENANT);
    const body = validBody(resource._id);

    const first = await request(app).post(`${API}/reservations`).send(body);
    const second = await request(app).post(`${API}/reservations`).send(body);

    expect([first.status, second.status]).toEqual([201, 409]);
  });

  describe('400 VALIDATION_ERROR on a malformed payload', () => {
    it.each(['resourceId', 'userId', 'startTime', 'endTime'])(
      'when %s is missing',
      async (field): Promise<void> => {
        const resource = await seedResource(TENANT);
        const body = Object.fromEntries(
          Object.entries(validBody(resource._id)).filter(([key]) => key !== field),
        );

        const res = await request(app).post(`${API}/reservations`).send(body);

        expect(res.status).toBe(400);
        expect(expectBody(res.body, isErrorResponse)).toEqual({
          code: 'VALIDATION_ERROR',
          message: `${field} is required.`,
        });
      },
    );

    it.each([
      ['an impossible calendar date', '2026-02-30T10:00:00Z'],
      ['no UTC offset', '2026-12-01T10:00:00'],
      ['a date without a time', '2026-12-01'],
      ['a space instead of T', '2026-12-01 10:00:00Z'],
      ['hour 24', '2026-12-01T24:00:00Z'],
      ['minute 60', '2026-12-01T10:60:00Z'],
      ['an out-of-range offset', '2026-12-01T10:00:00+24:00'],
      ['month 13', '2026-13-01T10:00:00Z'],
      ['natural language', 'tomorrow at 10'],
      ['an empty string', ''],
      ['epoch milliseconds', 1_796_119_200_000],
      ['null', null],
      ['an object', { $gt: '' }],
    ])('when startTime is %s', async (_label, startTime): Promise<void> => {
      const resource = await seedResource(TENANT);

      const res = await request(app)
        .post(`${API}/reservations`)
        .send({ ...validBody(resource._id), startTime });

      expect(res.status).toBe(400);
      expectError(res.body, 'VALIDATION_ERROR');
    });

    it.each([
      ['endTime is before startTime', END, START],
      ['endTime equals startTime', START, START],
      ['endTime is 1 ms before startTime', START, shiftMs(START, -1)],
      [
        'the offsets make endTime earlier in UTC',
        '2026-12-01T10:00:00+00:00',
        '2026-12-01T11:00:00+02:00',
      ],
    ])('when %s (negative time range)', async (_label, startTime, endTime): Promise<void> => {
      const resource = await seedResource(TENANT);

      const res = await request(app)
        .post(`${API}/reservations`)
        .send({ ...validBody(resource._id), startTime, endTime });

      expect(res.status).toBe(400);
      expect(expectBody(res.body, isErrorResponse).message).toBe(
        'endTime must be later than startTime.',
      );
    });

    it.each([
      ['a non-hex resourceId', { resourceId: 'zzzzzzzzzzzzzzzzzzzzzzzz' }],
      ['a 23-character resourceId', { resourceId: 'a'.repeat(23) }],
      ['a userId with spaces', { userId: 'student 1' }],
      ['a 65-character userId', { userId: 'u'.repeat(65) }],
      ['a numeric userId', { userId: 42 }],
      ['a client-assigned id', { id: new Types.ObjectId().toHexString() }],
      ['a client-assigned status', { status: 'CONFIRMED' }],
      ['a client-sent tenantId', { tenantId: 'tenant-b' }],
    ])('when the body has %s', async (_label, override): Promise<void> => {
      const resource = await seedResource(TENANT);

      const res = await request(app)
        .post(`${API}/reservations`)
        .send({ ...validBody(resource._id), ...override });

      expect(res.status).toBe(400);
      expectError(res.body, 'VALIDATION_ERROR');
      expect(await ReservationModel.countDocuments({}).exec()).toBe(0);
    });

    it.each([
      ['a JSON array', '[]'],
      ['a JSON string', '"reservation"'],
      ['JSON null', 'null'],
      ['truncated JSON', '{"resourceId": "'],
      ['a __proto__ key', '{"__proto__": {"admin": true}}'],
    ])('when the body is %s', async (_label, raw): Promise<void> => {
      const res = await request(app)
        .post(`${API}/reservations`)
        .set('Content-Type', 'application/json')
        .send(raw);

      expect(res.status).toBe(400);
      expectError(res.body, 'VALIDATION_ERROR');
    });

    it('when the body is empty', async (): Promise<void> => {
      const res = await request(app).post(`${API}/reservations`);

      expect(res.status).toBe(400);
      expectError(res.body, 'VALIDATION_ERROR');
    });

    it('when resourceId refers to no resource', async (): Promise<void> => {
      const res = await request(app)
        .post(`${API}/reservations`)
        .send(validBody(new Types.ObjectId()));

      expect(res.status).toBe(400);
      expectError(res.body, 'VALIDATION_ERROR');
    });
  });

  it('answers 500 with a generic body when the service fails unexpectedly', async (): Promise<void> => {
    const resource = await seedResource(TENANT);
    jest
      .spyOn(reservationService, 'createReservation')
      .mockRejectedValue(new Error('connection reset with secret=hunter2'));
    const consoleError = jest.spyOn(console, 'error').mockImplementation((): void => undefined);

    const res = await request(app).post(`${API}/reservations`).send(validBody(resource._id));

    expect(res.status).toBe(500);
    expect(expectBody(res.body, isErrorResponse)).toEqual({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
    });
    expect(consoleError).toHaveBeenCalledTimes(1);
  });
});

describe('GET /resources', () => {
  async function seedCatalogue(): Promise<Record<string, string>> {
    const room = await seedResource(TENANT, { name: 'Room', type: 'ROOM', isAvailable: true });
    const lab = await seedResource(TENANT, { name: 'Lab', type: 'LAB', isAvailable: true });
    const brokenLab = await seedResource(TENANT, {
      name: 'Lab 2',
      type: 'LAB',
      isAvailable: false,
    });
    const camera = await seedResource(TENANT, {
      name: 'Camera',
      type: 'EQUIPMENT',
      isAvailable: false,
    });
    await seedResource('another-tenant', { name: 'Foreign Lab', type: 'LAB' });
    return {
      room: room._id.toHexString(),
      lab: lab._id.toHexString(),
      brokenLab: brokenLab._id.toHexString(),
      camera: camera._id.toHexString(),
    };
  }

  it.each([
    ['no filter', '', ['room', 'lab', 'brokenLab', 'camera']],
    ['type=LAB', '?type=LAB', ['lab', 'brokenLab']],
    ['isAvailable=false', '?isAvailable=false', ['brokenLab', 'camera']],
    ['isAvailable=true', '?isAvailable=true', ['room', 'lab']],
    ['type=LAB&isAvailable=true', '?type=LAB&isAvailable=true', ['lab']],
    ['an unknown type', '?type=STUDY_ROOM', []],
    ['a lowercase type', '?type=lab', []],
  ])('returns 200 with %s', async (_label, query, expected): Promise<void> => {
    const ids = await seedCatalogue();

    const res = await request(app).get(`${API}/resources${query}`);

    expect(res.status).toBe(200);
    const resources = expectList(res.body, isResource);
    expect(resources.map((resource) => resource.id)).toEqual(expected.map((key) => ids[key]));
  });

  it.each([
    ['an empty type', '?type='],
    ['a repeated type', '?type=LAB&type=ROOM'],
    ['isAvailable=yes', '?isAvailable=yes'],
    ['isAvailable=1', '?isAvailable=1'],
    ['isAvailable=TRUE', '?isAvailable=TRUE'],
    ['an empty isAvailable', '?isAvailable='],
  ])('returns 400 for %s', async (_label, query): Promise<void> => {
    const res = await request(app).get(`${API}/resources${query}`);

    expect(res.status).toBe(400);
    expectError(res.body, 'VALIDATION_ERROR');
  });
});

describe('GET /reservations/user/:userId', () => {
  it('returns 200 with the user’s reservations, earliest first', async (): Promise<void> => {
    const resource = await seedResource(TENANT);
    const later = await seedReservation(TENANT, {
      resourceId: resource._id,
      startTime: shiftMs(START, 86_400_000),
      endTime: shiftMs(END, 86_400_000),
    });
    const earlier = await seedReservation(TENANT, {
      resourceId: resource._id,
      startTime: START,
      endTime: END,
    });

    const res = await request(app).get(`${API}/reservations/user/student-1`);

    expect(res.status).toBe(200);
    expect(expectList(res.body, isReservation).map((reservation) => reservation.id)).toEqual([
      earlier._id.toHexString(),
      later._id.toHexString(),
    ]);
  });

  it.each([
    ['contains a space', 'student%201'],
    ['is 65 characters long', 'u'.repeat(65)],
    ['is an invalid percent-encoding', '%E0%A4%A'],
  ])('returns 400 when the userId %s', async (_label, userId): Promise<void> => {
    const res = await request(app).get(`${API}/reservations/user/${userId}`);

    expect(res.status).toBe(400);
    expectError(res.body, 'VALIDATION_ERROR');
  });
});

describe('PATCH /reservations/:id/confirm and /cancel', () => {
  async function seedPending(): Promise<string> {
    const resource = await seedResource(TENANT);
    const reservation = await seedReservation(TENANT, {
      resourceId: resource._id,
      startTime: START,
      endTime: END,
    });
    return reservation._id.toHexString();
  }

  it('confirms, then cancels, a reservation with 200 each time', async (): Promise<void> => {
    const id = await seedPending();

    const confirmed = await request(app).patch(`${API}/reservations/${id}/confirm`);
    const cancelled = await request(app).patch(`${API}/reservations/${id}/cancel`);

    expect(confirmed.status).toBe(200);
    expect(expectBody(confirmed.body, isReservation).status).toBe('CONFIRMED');
    expect(cancelled.status).toBe(200);
    expect(expectBody(cancelled.body, isReservation).status).toBe('CANCELLED');
  });

  it('returns 409 INVALID_STATUS_TRANSITION when confirming a cancelled reservation', async (): Promise<void> => {
    const id = await seedPending();
    await request(app).patch(`${API}/reservations/${id}/cancel`);

    const res = await request(app).patch(`${API}/reservations/${id}/confirm`);

    expect(res.status).toBe(409);
    expectError(res.body, 'INVALID_STATUS_TRANSITION');
  });

  it.each(['confirm', 'cancel'])(
    'returns 404 when %sing an unknown id',
    async (action): Promise<void> => {
      const res = await request(app).patch(
        `${API}/reservations/${new Types.ObjectId().toHexString()}/${action}`,
      );

      expect(res.status).toBe(404);
      expectError(res.body, 'NOT_FOUND');
    },
  );

  it.each(['confirm', 'cancel'])(
    'returns 400 when %sing a malformed id',
    async (action): Promise<void> => {
      const res = await request(app).patch(`${API}/reservations/not-an-id/${action}`);

      expect(res.status).toBe(400);
      expectError(res.body, 'VALIDATION_ERROR');
    },
  );
});

describe('unmatched routes', () => {
  it('returns 404 NOT_FOUND through the central error handler', async (): Promise<void> => {
    const res = await request(app).delete(`${API}/reservations`);

    expect(res.status).toBe(404);
    expectError(res.body, 'NOT_FOUND');
  });
});
