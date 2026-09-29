import type { Request, Response } from 'express';

import { env } from '../config/env';
import { resourceService } from '../services/resource.service';
import type { ListResourcesResponses, ResourceFilter } from '../types/reservation';
import { ValidationError } from '../utils/app-error';

function parseResourceFilter(query: Request['query']): ResourceFilter {
  const { type } = query;
  if (type === undefined) {
    return {};
  }
  // A repeated `?type=` arrives as an array, which the contract does not allow either.
  if (typeof type !== 'string' || type === '') {
    throw new ValidationError('type must be a non-empty string when provided.');
  }
  return { type };
}

/**
 * HTTP boundary for `GET /resources` in docs/openapi.yaml: narrows the query,
 * calls the service, and answers 200. Nothing authenticates the caller yet, so
 * the tenant is the deployment's configured one, never a client-sent value
 * (AGENTS.md §4).
 */
export const resourceController = {
  listResources: async (
    req: Request,
    res: Response<ListResourcesResponses[200]>,
  ): Promise<void> => {
    const filter = parseResourceFilter(req.query);
    const resources = await resourceService.listResources(env.defaultTenantId, filter);

    res.status(200).json(resources);
  },
} as const;
