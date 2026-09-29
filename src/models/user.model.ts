import { model, Schema, type Model } from 'mongoose';

import { IDENTIFIER_PATTERN } from '../types/reservation';

/**
 * Persisted shape of a user (student or staff). Its public fields map
 * one-to-one to `components/schemas/User` in docs/openapi.yaml, with `_id`
 * exposed as `id`. `tenantId` is the internal partition key and is never
 * serialized (AGENTS.md §1).
 */
export interface UserEntity {
  _id: string;
  tenantId: string;
  name: string;
  email: string;
}

const userSchema = new Schema<UserEntity>(
  {
    _id: { type: String, required: true, match: IDENTIFIER_PATTERN },
    tenantId: { type: String, required: true, immutable: true },
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
  },
  // Reject unknown fields rather than drop them, like the contract's additionalProperties: false.
  { strict: 'throw', versionKey: false },
);

// An email identifies one account per campus, but the same address may exist on another tenant.
userSchema.index({ tenantId: 1, email: 1 }, { unique: true });

export const UserModel: Model<UserEntity> = model<UserEntity>('User', userSchema);
