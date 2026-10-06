import { model, Schema, type Model, type Types } from 'mongoose';

import { RESOURCE_TYPES, type ResourceType } from '../types/reservation';

/**
 * Persisted shape of a campus resource. Its public fields map one-to-one to
 * `components/schemas/Resource` in docs/openapi.yaml, with the ObjectId `_id`
 * exposed as `id`. `tenantId` is the internal partition key and is never
 * serialized (AGENTS.md §1).
 */
export interface ResourceEntity {
  _id: Types.ObjectId;
  tenantId: string;
  name: string;
  type: ResourceType;
  location: string;
  isAvailable: boolean;
}

const resourceSchema = new Schema<ResourceEntity>(
  {
    tenantId: { type: String, required: true, immutable: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: RESOURCE_TYPES },
    location: { type: String, required: true, trim: true },
    isAvailable: { type: Boolean, required: true, default: true },
  },
  // Reject unknown fields rather than drop them, like the contract's additionalProperties: false.
  { strict: 'throw', versionKey: false },
);

// GET /resources lists one tenant's catalogue, optionally narrowed by type.
resourceSchema.index({ tenantId: 1, type: 1 });

export const ResourceModel: Model<ResourceEntity> = model<ResourceEntity>(
  'Resource',
  resourceSchema,
);
