import { env } from '../config/env';
import type { ResourceEntity } from '../models/resource.model';
import type { ResourceFilter } from '../types/reservation';

/**
 * In-memory stand-in for the `resources` collection: Lab 2 requires the API to
 * run without a database. Records have exactly the `ResourceEntity` shape, so
 * moving to `ResourceModel` changes only this file (AGENTS.md §3).
 *
 * Seeded with a demo catalogue for the configured tenant, plus one resource of
 * another tenant that must never be visible to it.
 */
const resources: readonly ResourceEntity[] = [
  {
    _id: 'res-101',
    tenantId: env.defaultTenantId,
    name: 'Study Room 302',
    type: 'ROOM',
    location: 'Main Library, Floor 3',
    isAvailable: true,
  },
  {
    _id: 'res-102',
    tenantId: env.defaultTenantId,
    name: 'Group Study Room 110',
    type: 'ROOM',
    location: 'Student Center, Floor 1',
    isAvailable: true,
  },
  {
    _id: 'res-201',
    tenantId: env.defaultTenantId,
    name: '3D Printer A',
    type: 'EQUIPMENT',
    location: 'Innovation Makerspace',
    isAvailable: true,
  },
  {
    _id: 'res-202',
    tenantId: env.defaultTenantId,
    name: 'DSLR Camera Kit',
    type: 'EQUIPMENT',
    location: 'Media Services Desk',
    isAvailable: false,
  },
  {
    _id: 'res-301',
    tenantId: env.defaultTenantId,
    name: 'Robotics Lab',
    type: 'LAB',
    location: 'Engineering Center, Room 214',
    isAvailable: true,
  },
  {
    _id: 'res-901',
    tenantId: 'other-campus',
    name: 'Lecture Hall A',
    type: 'ROOM',
    location: 'Other Campus, Hall A',
    isAvailable: true,
  },
];

export const resourceRepository = {
  find(tenantId: string, filter: ResourceFilter): Promise<ResourceEntity[]> {
    return Promise.resolve(
      resources.filter(
        (resource) =>
          resource.tenantId === tenantId &&
          (filter.type === undefined || resource.type === filter.type),
      ),
    );
  },

  findById(tenantId: string, id: string): Promise<ResourceEntity | undefined> {
    return Promise.resolve(
      resources.find((resource) => resource.tenantId === tenantId && resource._id === id),
    );
  },
} as const;
