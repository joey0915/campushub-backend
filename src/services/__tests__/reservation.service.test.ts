import mongoose, { Types } from 'mongoose';

import { ReservationModel } from '../../models/Reservation.model';
import { seedReservation, seedResource, shiftMs } from '../../test/fixtures';
import type { CreateReservationRequest } from '../../types/reservation';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/app-error';
import { reservationService } from '../reservation.service';
import { resourceService } from '../resource.service';

const TENANT = 'tenant-a';
const OTHER_TENANT = 'tenant-b';
const START = '2026-12-01T10:00:00.000Z';
const END = '2026-12-01T11:00:00.000Z';

function requestFor(
  resourceId: Types.ObjectId,
  startTime: string,
  endTime: string,
  userId = 'student-2',
): CreateReservationRequest {
  return { resourceId: resourceId.toHexString(), userId, startTime, endTime };
}

async function countReservations(): Promise<number> {
  return ReservationModel.countDocuments({}).exec();
}

describe('reservationService.createReservation', () => {
  describe('happy path', () => {
    it('reserves a freshly created resource as PENDING and hides tenantId', async (): Promise<void> => {
      const resource = await seedResource(TENANT, { name: 'Robotics Lab', type: 'LAB' });

      const [listed] = await resourceService.listResources(TENANT, {});
      const reservation = await reservationService.createReservation(
        TENANT,
        requestFor(resource._id, START, END),
      );

      expect(listed).toEqual({
        id: resource._id.toHexString(),
        name: 'Robotics Lab',
        type: 'LAB',
        location: 'Snell Library, Floor 1',
        isAvailable: true,
      });
      expect(reservation).toEqual({
        id: expect.stringMatching(/^[0-9a-f]{24}$/) as unknown,
        resourceId: resource._id.toHexString(),
        userId: 'student-2',
        startTime: START,
        endTime: END,
        status: 'PENDING',
      });
      const stored = await ReservationModel.findById(reservation.id).lean().exec();
      expect(stored?.tenantId).toBe(TENANT);
    });

    it('normalizes a non-UTC offset to the same instant in UTC', async (): Promise<void> => {
      const resource = await seedResource(TENANT);

      const reservation = await reservationService.createReservation(
        TENANT,
        requestFor(resource._id, '2026-12-01T05:00:00-05:00', '2026-12-01T06:00:00-05:00'),
      );

      expect(reservation.startTime).toBe(START);
      expect(reservation.endTime).toBe(END);
    });

    it.each([
      ['ends exactly when the existing one starts', shiftMs(START, -3_600_000), START],
      ['starts exactly when the existing one ends', END, shiftMs(END, 3_600_000)],
      ['leaves a 1 ms gap after the existing one', shiftMs(END, 1), shiftMs(END, 3_600_000)],
    ])('accepts a back-to-back slot that %s', async (_label, startTime, endTime): Promise<void> => {
      const resource = await seedResource(TENANT);
      await seedReservation(TENANT, { resourceId: resource._id, startTime: START, endTime: END });

      const reservation = await reservationService.createReservation(
        TENANT,
        requestFor(resource._id, startTime, endTime),
      );

      expect(reservation.status).toBe('PENDING');
      expect(await countReservations()).toBe(2);
    });

    it('accepts the same window on a different resource', async (): Promise<void> => {
      const booked = await seedResource(TENANT);
      const other = await seedResource(TENANT, { name: 'Study Room 102' });
      await seedReservation(TENANT, { resourceId: booked._id, startTime: START, endTime: END });

      await expect(
        reservationService.createReservation(TENANT, requestFor(other._id, START, END)),
      ).resolves.toMatchObject({ resourceId: other._id.toHexString() });
    });

    it('accepts a window that only a CANCELLED reservation occupies', async (): Promise<void> => {
      const resource = await seedResource(TENANT);
      await seedReservation(TENANT, {
        resourceId: resource._id,
        startTime: START,
        endTime: END,
        status: 'CANCELLED',
      });

      await expect(
        reservationService.createReservation(TENANT, requestFor(resource._id, START, END)),
      ).resolves.toMatchObject({ status: 'PENDING' });
    });
  });

  describe('double booking', () => {
    it.each([
      ['matches the exact start and end', START, END],
      ['overlaps the last millisecond', shiftMs(END, -1), shiftMs(END, 3_600_000)],
      ['overlaps the first millisecond', shiftMs(START, -3_600_000), shiftMs(START, 1)],
      ['sits strictly inside it', shiftMs(START, 900_000), shiftMs(END, -900_000)],
      ['encloses it', shiftMs(START, -1), shiftMs(END, 1)],
      ['shares its start but ends later', START, shiftMs(END, 3_600_000)],
      ['is a 1 ms slot inside it', shiftMs(START, 1), shiftMs(START, 2)],
    ])(
      'rejects a window that %s with DOUBLE_BOOKING',
      async (_label, startTime, endTime): Promise<void> => {
        const resource = await seedResource(TENANT);
        await seedReservation(TENANT, { resourceId: resource._id, startTime: START, endTime: END });

        const attempt = reservationService.createReservation(
          TENANT,
          requestFor(resource._id, startTime, endTime),
        );

        await expect(attempt).rejects.toBeInstanceOf(ConflictError);
        await expect(attempt).rejects.toMatchObject({ statusCode: 409, code: 'DOUBLE_BOOKING' });
        expect(await countReservations()).toBe(1);
      },
    );

    it('counts a CONFIRMED reservation as occupying its slot', async (): Promise<void> => {
      const resource = await seedResource(TENANT);
      await seedReservation(TENANT, {
        resourceId: resource._id,
        startTime: START,
        endTime: END,
        status: 'CONFIRMED',
      });

      await expect(
        reservationService.createReservation(TENANT, requestFor(resource._id, START, END)),
      ).rejects.toMatchObject({ code: 'DOUBLE_BOOKING' });
    });

    it('ignores reservations stored under another tenant', async (): Promise<void> => {
      const resource = await seedResource(TENANT);
      await seedReservation(OTHER_TENANT, {
        resourceId: resource._id,
        startTime: START,
        endTime: END,
      });

      await expect(
        reservationService.createReservation(TENANT, requestFor(resource._id, START, END)),
      ).resolves.toMatchObject({ status: 'PENDING' });
    });
  });

  describe('concurrent booking attempts', () => {
    it('books concurrent requests for different resources independently', async (): Promise<void> => {
      const resources = await Promise.all([1, 2, 3].map(() => seedResource(TENANT)));

      const results = await Promise.allSettled(
        resources.map((resource) =>
          reservationService.createReservation(TENANT, requestFor(resource._id, START, END)),
        ),
      );

      expect(results.every((result) => result.status === 'fulfilled')).toBe(true);
    });

    // Known gap, documented in the service: the overlap check and the insert are two queries,
    // so simultaneous requests can all pass the check. `it.failing` keeps the suite green
    // while the race exists and turns red the day it is closed, so it cannot be forgotten.
    it.failing(
      'accepts exactly one of five simultaneous identical requests',
      async (): Promise<void> => {
        for (let round = 0; round < 10; round += 1) {
          const resource = await seedResource(TENANT);
          const results = await Promise.allSettled(
            Array.from({ length: 5 }, () =>
              reservationService.createReservation(TENANT, requestFor(resource._id, START, END)),
            ),
          );

          expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
        }
      },
    );
  });

  describe('invalid input reaching the service', () => {
    it('rejects a resourceId that matches no resource as a ValidationError', async (): Promise<void> => {
      const missingId = new Types.ObjectId();

      const attempt = reservationService.createReservation(
        TENANT,
        requestFor(missingId, START, END),
      );

      await expect(attempt).rejects.toBeInstanceOf(ValidationError);
      await expect(attempt).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
      expect(await countReservations()).toBe(0);
    });

    it('treats another tenant’s resource as non-existent', async (): Promise<void> => {
      const foreign = await seedResource(OTHER_TENANT);

      await expect(
        reservationService.createReservation(TENANT, requestFor(foreign._id, START, END)),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    // The controller rejects these with a 400 first; the schema validator is the backstop.
    it.each([
      ['endTime is before startTime', END, START],
      ['endTime equals startTime (zero-length slot)', START, START],
      ['endTime is 1 ms before startTime', START, shiftMs(START, -1)],
    ])('refuses to persist a slot where %s', async (_label, startTime, endTime): Promise<void> => {
      const resource = await seedResource(TENANT);

      await expect(
        reservationService.createReservation(TENANT, requestFor(resource._id, startTime, endTime)),
      ).rejects.toBeInstanceOf(mongoose.Error.ValidationError);
      expect(await countReservations()).toBe(0);
    });

    it('throws before querying when resourceId is not an ObjectId', async (): Promise<void> => {
      const request = {
        resourceId: 'not-an-object-id',
        userId: 'student-2',
        startTime: START,
        endTime: END,
      };

      await expect(reservationService.createReservation(TENANT, request)).rejects.toThrow();
      expect(await countReservations()).toBe(0);
    });
  });
});

describe('reservationService.listReservationsForUser', () => {
  it('returns only the user’s reservations in this tenant, earliest first', async (): Promise<void> => {
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
      status: 'CANCELLED',
    });
    await seedReservation(TENANT, {
      resourceId: resource._id,
      userId: 'student-9',
      startTime: START,
      endTime: END,
    });
    await seedReservation(OTHER_TENANT, {
      resourceId: resource._id,
      startTime: START,
      endTime: END,
    });

    const reservations = await reservationService.listReservationsForUser(TENANT, 'student-1');

    expect(reservations.map((reservation) => reservation.id)).toEqual([
      earlier._id.toHexString(),
      later._id.toHexString(),
    ]);
  });

  it('returns an empty list for a user with no reservations', async (): Promise<void> => {
    await expect(reservationService.listReservationsForUser(TENANT, 'nobody')).resolves.toEqual([]);
  });
});

describe('reservationService status transitions', () => {
  async function seedWithStatus(
    status: 'PENDING' | 'CONFIRMED' | 'CANCELLED',
    tenantId = TENANT,
  ): Promise<string> {
    const resource = await seedResource(tenantId);
    const seeded = await seedReservation(tenantId, {
      resourceId: resource._id,
      startTime: START,
      endTime: END,
      status,
    });
    return seeded._id.toHexString();
  }

  it('confirms a PENDING reservation', async (): Promise<void> => {
    const id = await seedWithStatus('PENDING');

    await expect(reservationService.confirmReservation(TENANT, id)).resolves.toMatchObject({
      id,
      status: 'CONFIRMED',
    });
  });

  it.each(['PENDING', 'CONFIRMED'] as const)(
    'cancels a %s reservation and frees its slot',
    async (status): Promise<void> => {
      const id = await seedWithStatus(status);
      const stored = await ReservationModel.findById(id).lean().exec();
      if (stored === null) {
        throw new Error('seeded reservation vanished');
      }

      await expect(reservationService.cancelReservation(TENANT, id)).resolves.toMatchObject({
        status: 'CANCELLED',
      });
      await expect(
        reservationService.createReservation(TENANT, requestFor(stored.resourceId, START, END)),
      ).resolves.toMatchObject({ status: 'PENDING' });
    },
  );

  it.each([
    ['confirm', 'CONFIRMED'],
    ['confirm', 'CANCELLED'],
    ['cancel', 'CANCELLED'],
  ] as const)(
    'refuses to %s a %s reservation with INVALID_STATUS_TRANSITION',
    async (action, status): Promise<void> => {
      const id = await seedWithStatus(status);
      const transition =
        action === 'confirm'
          ? reservationService.confirmReservation(TENANT, id)
          : reservationService.cancelReservation(TENANT, id);

      await expect(transition).rejects.toBeInstanceOf(ConflictError);
      await expect(transition).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
      const stored = await ReservationModel.findById(id).lean().exec();
      expect(stored?.status).toBe(status);
    },
  );

  it('reports an unknown id as NotFoundError', async (): Promise<void> => {
    await expect(
      reservationService.confirmReservation(TENANT, new Types.ObjectId().toHexString()),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('reports another tenant’s reservation as NotFoundError and leaves it untouched', async (): Promise<void> => {
    const id = await seedWithStatus('PENDING', OTHER_TENANT);

    await expect(reservationService.cancelReservation(TENANT, id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    const stored = await ReservationModel.findById(id).lean().exec();
    expect(stored?.status).toBe('PENDING');
  });

  it('lets exactly one of two concurrent confirms win', async (): Promise<void> => {
    const id = await seedWithStatus('PENDING');

    const results = await Promise.allSettled([
      reservationService.confirmReservation(TENANT, id),
      reservationService.confirmReservation(TENANT, id),
    ]);

    const rejected = results.filter((result) => result.status === 'rejected');
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
  });

  it('lets a cancel and a confirm race without leaving a CONFIRMED-after-cancel state', async (): Promise<void> => {
    const id = await seedWithStatus('PENDING');

    await Promise.allSettled([
      reservationService.cancelReservation(TENANT, id),
      reservationService.confirmReservation(TENANT, id),
    ]);

    const stored = await ReservationModel.findById(id).lean().exec();
    expect(stored?.status).toBe('CANCELLED');
  });
});
