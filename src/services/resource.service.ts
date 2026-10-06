import { ResourceModel, type ResourceEntity } from '../models/Resource.model';
import {
  RESOURCE_TYPES,
  type Resource,
  type ResourceFilter,
  type ResourceType,
} from '../types/reservation';

function isResourceType(value: string): value is ResourceType {
  return (RESOURCE_TYPES as readonly string[]).includes(value);
}

// Explicit field mapping is what keeps the internal tenantId out of responses.
function toResource(entity: ResourceEntity): Resource {
  return {
    id: entity._id.toHexString(),
    name: entity.name,
    type: entity.type,
    location: entity.location,
    isAvailable: entity.isAvailable,
  };
}

/**
 * Business logic and data access for the resource catalogue, through the
 * Mongoose model. Knows nothing about Express, `req`, `res`, or HTTP status
 * codes (AGENTS.md §3).
 */
export const resourceService = {
  async listResources(tenantId: string, filter: ResourceFilter): Promise<Resource[]> {
    // The contract filters on any non-empty string; one outside the enum (e.g.
    // STUDY_ROOM) can match nothing, so it answers [] without a query.
    const { type } = filter;
    if (type !== undefined && !isResourceType(type)) {
      return [];
    }
    const resources = await ResourceModel.find({
      tenantId,
      ...(type === undefined ? {} : { type }),
    })
      .sort({ _id: 1 })
      .lean<ResourceEntity[]>()
      .exec();
    return resources.map(toResource);
  },
} as const;
