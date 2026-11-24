import { expect, type APIRequestContext } from '@playwright/test';

import {
  ACTIVE_RESERVATION_STATUSES,
  type Reservation,
  type Resource,
} from '../../shared/contract';
import { isReservation, isResource } from '../../src/test/contract-guards';
import type { Slot } from './slots';

const API_PREFIX = '/api/v1';

/**
 * Arranges and inspects state through the public API (via the Vite proxy),
 * never the database, so Given/Then steps see exactly what a client would.
 * Every student it touches has their active reservations cancelled on
 * teardown, which frees the slot for the next browser project.
 */
export class ReservationApi {
  private readonly touchedUserIds = new Set<string>();

  constructor(private readonly request: APIRequestContext) {}

  track(userId: string): void {
    this.touchedUserIds.add(userId);
  }

  async findResource(name: string): Promise<Resource> {
    const response = await this.request.get(`${API_PREFIX}/resources`);
    expect(response.status()).toBe(200);
    const body: unknown = await response.json();
    const resource = (Array.isArray(body) ? body : [])
      .filter(isResource)
      .find((r) => r.name === name);
    if (resource === undefined) {
      throw new Error(`Seeded resource "${name}" not found`);
    }
    return resource;
  }

  async reserve(resourceName: string, userId: string, slot: Slot): Promise<Reservation> {
    this.track(userId);
    const resource = await this.findResource(resourceName);
    const response = await this.request.post(`${API_PREFIX}/reservations`, {
      data: {
        resourceId: resource.id,
        userId,
        startTime: slot.start.toISOString(),
        endTime: slot.end.toISOString(),
      },
    });
    expect(response.status()).toBe(201);
    const body: unknown = await response.json();
    if (!isReservation(body)) {
      throw new Error('POST /reservations returned a body that is not a Reservation');
    }
    return body;
  }

  async activeReservations(userId: string): Promise<readonly Reservation[]> {
    const response = await this.request.get(
      `${API_PREFIX}/reservations/user/${encodeURIComponent(userId)}`,
    );
    expect(response.status()).toBe(200);
    const body: unknown = await response.json();
    return (Array.isArray(body) ? body : [])
      .filter(isReservation)
      .filter((reservation) => ACTIVE_RESERVATION_STATUSES.includes(reservation.status));
  }

  async cancelTouchedReservations(): Promise<void> {
    for (const userId of this.touchedUserIds) {
      for (const reservation of await this.activeReservations(userId)) {
        const response = await this.request.patch(
          `${API_PREFIX}/reservations/${reservation.id}/cancel`,
        );
        expect(response.status()).toBe(200);
      }
    }
  }
}
