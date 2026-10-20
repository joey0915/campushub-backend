import type { Request, Response } from 'express';

import { env } from '../config/env';
import { resourceService } from '../services/resource.service';
import type { ListResourcesResponses, ResourceFilter } from '../types/reservation';
import { ValidationError } from '../utils/app-error';

function parseType(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  // A repeated `?type=` arrives as an array, which the contract does not allow either.
  if (typeof value !== 'string' || value === '') {
    throw new ValidationError('type must be a non-empty string when provided.');
  }
  return value;
}

// A query string carries text, so only the literal spellings of the contract's boolean pass.
function parseIsAvailable(value: unknown): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === 'true' || value === 'false') {
    return value === 'true';
  }
  throw new ValidationError('isAvailable must be true or false when provided.');
}

function parseResourceFilter(query: Request['query']): ResourceFilter {
  const type = parseType(query['type']);
  const isAvailable = parseIsAvailable(query['isAvailable']);
  return {
    ...(type === undefined ? {} : { type }),
    ...(isAvailable === undefined ? {} : { isAvailable }),
  };
}

/**
 * HTTP boundary for `GET /resources` in docs/openapi.yaml: narrows `type` and
 * `isAvailable`, calls the service, and answers 200. Nothing authenticates the
 * caller yet, so the tenant is the deployment's configured one, never a
 * client-sent value (AGENTS.md §4).
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
