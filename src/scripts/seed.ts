import { Types } from 'mongoose';

import { connectAppDatabase } from '../app';
import { disconnectDatabase } from '../config/database';
import { env } from '../config/env';
import { ReservationModel } from '../models/Reservation.model';
import { ResourceModel, type ResourceEntity } from '../models/Resource.model';

/**
 * `npm run seed`: resets the configured tenant to a known state before manual
 * testing — the demo catalogue below and no reservations. Fixed ObjectIds keep
 * the curl commands in the README valid across reseeds. One resource belongs to
 * another tenant so tenant isolation stays observable.
 */
const OTHER_TENANT_ID = 'other-campus';

const CATALOGUE: readonly ResourceEntity[] = [
  {
    _id: new Types.ObjectId('000000000000000000000101'),
    tenantId: env.defaultTenantId,
    name: 'Study Room 302',
    type: 'ROOM',
    location: 'Main Library, Floor 3',
    isAvailable: true,
  },
  {
    _id: new Types.ObjectId('000000000000000000000102'),
    tenantId: env.defaultTenantId,
    name: 'Group Study Room 110',
    type: 'ROOM',
    location: 'Student Center, Floor 1',
    isAvailable: true,
  },
  {
    _id: new Types.ObjectId('000000000000000000000201'),
    tenantId: env.defaultTenantId,
    name: '3D Printer A',
    type: 'EQUIPMENT',
    location: 'Innovation Makerspace',
    isAvailable: true,
  },
  {
    _id: new Types.ObjectId('000000000000000000000202'),
    tenantId: env.defaultTenantId,
    name: 'DSLR Camera Kit',
    type: 'EQUIPMENT',
    location: 'Media Services Desk',
    isAvailable: false,
  },
  {
    _id: new Types.ObjectId('000000000000000000000301'),
    tenantId: env.defaultTenantId,
    name: 'Robotics Lab',
    type: 'LAB',
    location: 'Engineering Center, Room 214',
    isAvailable: true,
  },
  {
    _id: new Types.ObjectId('000000000000000000000901'),
    tenantId: OTHER_TENANT_ID,
    name: 'Lecture Hall A',
    type: 'ROOM',
    location: 'Other Campus, Hall A',
    isAvailable: true,
  },
];

async function seed(): Promise<void> {
  await connectAppDatabase();
  try {
    const tenants = [env.defaultTenantId, OTHER_TENANT_ID];
    await ReservationModel.deleteMany({ tenantId: { $in: tenants } }).exec();
    await ResourceModel.deleteMany({ tenantId: { $in: tenants } }).exec();
    await ResourceModel.insertMany(CATALOGUE);
    console.log(`[seed] ${String(CATALOGUE.length)} resources inserted, reservations cleared.`);
    for (const resource of CATALOGUE) {
      console.log(`[seed]   ${resource._id.toHexString()}  ${resource.tenantId}  ${resource.name}`);
    }
  } finally {
    await disconnectDatabase();
  }
}

// process.exit is reserved for server.ts (AGENTS.md §4); exitCode lets Node exit on its own.
seed().catch((error: unknown) => {
  console.error('[seed] Failed:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
