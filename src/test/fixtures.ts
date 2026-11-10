import { ReservationModel, type ReservationEntity } from '../models/Reservation.model';
import { ResourceModel, type ResourceEntity } from '../models/Resource.model';
import type { ReservationStatus, ResourceType } from '../types/reservation';

/** Fields a test may override on a seeded resource; the tenant is always explicit. */
export interface ResourceSeed {
  readonly name?: string;
  readonly type?: ResourceType;
  readonly location?: string;
  readonly isAvailable?: boolean;
}

/** One reservation inserted straight into the model, bypassing the service's rules. */
export interface ReservationSeed {
  readonly resourceId: ResourceEntity['_id'];
  readonly userId?: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly status?: ReservationStatus;
}

// No API operation creates resources (the catalogue is seeded), so tests seed through the model.
export async function seedResource(
  tenantId: string,
  seed: ResourceSeed = {},
): Promise<ResourceEntity> {
  const created = await ResourceModel.create({
    tenantId,
    name: seed.name ?? 'Study Room 101',
    type: seed.type ?? 'ROOM',
    location: seed.location ?? 'Snell Library, Floor 1',
    isAvailable: seed.isAvailable ?? true,
  });
  return created.toObject<ResourceEntity>();
}

export async function seedReservation(
  tenantId: string,
  seed: ReservationSeed,
): Promise<ReservationEntity> {
  const created = await ReservationModel.create({
    tenantId,
    resourceId: seed.resourceId,
    userId: seed.userId ?? 'student-1',
    startTime: new Date(seed.startTime),
    endTime: new Date(seed.endTime),
    status: seed.status ?? 'PENDING',
  });
  return created.toObject<ReservationEntity>();
}

/** `iso` shifted by `ms` milliseconds, in the UTC form the API returns. */
export function shiftMs(iso: string, ms: number): string {
  return new Date(Date.parse(iso) + ms).toISOString();
}
