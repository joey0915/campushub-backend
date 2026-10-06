import type { Request, Response } from 'express';

import { env } from '../config/env';
import { reservationService } from '../services/reservation.service';
import {
  IDENTIFIER_PATTERN,
  OBJECT_ID_PATTERN,
  type CreateReservationRequest,
  type CreateReservationResponses,
  type ListUserReservationsParams,
  type ListUserReservationsResponses,
} from '../types/reservation';
import { ValidationError } from '../utils/app-error';
import { isIsoDateTime, isRecord } from '../utils/validation';

// `Reservation` in its request role: server-assigned fields are read-only.
const WRITABLE_FIELDS: ReadonlySet<string> = new Set([
  'resourceId',
  'userId',
  'startTime',
  'endTime',
]);
const READ_ONLY_FIELDS: ReadonlySet<string> = new Set(['id', 'status']);

function readIdentifier(source: Record<string, unknown>, field: string): string {
  const value = source[field];
  if (value === undefined) {
    throw new ValidationError(`${field} is required.`);
  }
  if (typeof value !== 'string' || !IDENTIFIER_PATTERN.test(value)) {
    throw new ValidationError(`${field} must be 1-64 letters, digits, hyphens or underscores.`);
  }
  return value;
}

function readObjectId(source: Record<string, unknown>, field: string): string {
  const value = source[field];
  if (value === undefined) {
    throw new ValidationError(`${field} is required.`);
  }
  if (typeof value !== 'string' || !OBJECT_ID_PATTERN.test(value)) {
    throw new ValidationError(`${field} must be a 24-character hexadecimal ObjectId.`);
  }
  return value;
}

function readDateTime(source: Record<string, unknown>, field: string): string {
  const value = source[field];
  if (value === undefined) {
    throw new ValidationError(`${field} is required.`);
  }
  if (typeof value !== 'string' || !isIsoDateTime(value)) {
    throw new ValidationError(
      `${field} must be an ISO 8601 date-time with a UTC offset, e.g. 2026-10-01T10:00:00Z.`,
    );
  }
  return value;
}

function parseCreateReservationRequest(body: unknown): CreateReservationRequest {
  if (!isRecord(body)) {
    throw new ValidationError('Request body must be a JSON object.');
  }
  for (const field of Object.keys(body)) {
    if (READ_ONLY_FIELDS.has(field)) {
      throw new ValidationError(`${field} is read-only and must not be sent.`);
    }
    if (!WRITABLE_FIELDS.has(field)) {
      throw new ValidationError(`Unknown property: ${field}.`);
    }
  }

  const request: CreateReservationRequest = {
    resourceId: readObjectId(body, 'resourceId'),
    userId: readIdentifier(body, 'userId'),
    startTime: readDateTime(body, 'startTime'),
    endTime: readDateTime(body, 'endTime'),
  };
  if (Date.parse(request.endTime) <= Date.parse(request.startTime)) {
    throw new ValidationError('endTime must be later than startTime.');
  }
  return request;
}

function parseListUserReservationsParams(params: Request['params']): ListUserReservationsParams {
  return { userId: readIdentifier(params, 'userId') };
}

/**
 * HTTP boundary for the reservation operations in docs/openapi.yaml: every
 * input is narrowed to its contract type here (400 on failure), then exactly
 * one service call; the service's 400/409 errors reach the central middleware
 * through asyncHandler. Nothing authenticates the caller yet, so the tenant is
 * the deployment's configured one, never a client-sent value (AGENTS.md §4).
 */
export const reservationController = {
  createReservation: async (
    req: Request,
    res: Response<CreateReservationResponses[201]>,
  ): Promise<void> => {
    const request = parseCreateReservationRequest(req.body);
    const reservation = await reservationService.createReservation(env.defaultTenantId, request);

    res.status(201).json(reservation);
  },

  listUserReservations: async (
    req: Request,
    res: Response<ListUserReservationsResponses[200]>,
  ): Promise<void> => {
    const { userId } = parseListUserReservationsParams(req.params);
    const reservations = await reservationService.listActiveReservationsForUser(
      env.defaultTenantId,
      userId,
    );

    res.status(200).json(reservations);
  },
} as const;
