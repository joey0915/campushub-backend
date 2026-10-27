import { useCallback, useEffect, useState } from 'react';

import { fetchResources } from '../api/campushubApi';
import type { Resource, ResourceType } from '../types/campushub';
import { describeApiError, isAbortError } from '../utils/error-messages';

export interface ResourcesState {
  readonly resources: readonly Resource[];
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly reload: () => void;
}

/** Loads `GET /resources` for `type` (`null` = all types) and reloads when it changes. */
export function useResources(type: ResourceType | null): ResourcesState {
  const [resources, setResources] = useState<readonly Resource[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState<number>(0);

  useEffect((): (() => void) => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    fetchResources(type ?? undefined, { signal: controller.signal }).then(
      (data) => {
        if (controller.signal.aborted) return;
        setResources(data);
        setIsLoading(false);
      },
      (caught: unknown) => {
        if (controller.signal.aborted || isAbortError(caught)) return;
        setResources([]);
        setError(describeApiError(caught, 'load-resources'));
        setIsLoading(false);
      },
    );

    return (): void => {
      controller.abort();
    };
  }, [type, reloadToken]);

  const reload = useCallback((): void => {
    setReloadToken((token) => token + 1);
  }, []);

  return { resources, isLoading, error, reload };
}
