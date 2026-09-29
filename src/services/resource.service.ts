import type { ResourceEntity } from '../models/resource.model';
import { resourceRepository } from '../repositories/resource.repository';
import type { Resource, ResourceFilter } from '../types/reservation';

// Explicit field mapping is what keeps the internal tenantId out of responses.
function toResource(entity: ResourceEntity): Resource {
  return {
    id: entity._id,
    name: entity.name,
    type: entity.type,
    location: entity.location,
    isAvailable: entity.isAvailable,
  };
}

/**
 * Business logic for the resource catalogue. Knows nothing about Express, `req`,
 * `res`, or HTTP status codes (AGENTS.md §3).
 */
export const resourceService = {
  async listResources(tenantId: string, filter: ResourceFilter): Promise<Resource[]> {
    const resources = await resourceRepository.find(tenantId, filter);
    return resources.map(toResource);
  },
} as const;
