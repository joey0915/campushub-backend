import { useCallback, useEffect, useState } from 'react';

import { cancelReservation, fetchResources, fetchUserReservations } from '../api/campushubApi';
import { USER_ID_PATTERN, type Reservation } from '../types/campushub';
import { formatSlot } from '../utils/datetime';
import { describeApiError, isAbortError } from '../utils/error-messages';

export interface UserReservationsState {
  readonly reservations: readonly Reservation[];
  /** Resource names by id, so rows can show "Study Room 302" instead of an ObjectId. */
  readonly resourceNames: ReadonlyMap<string, string>;
  readonly isLoading: boolean;
  readonly error: string | null;
  /** Ids of reservations whose cancel request is in flight. */
  readonly cancellingIds: ReadonlySet<string>;
  /**
   * The latest cancel failure, kept at list level rather than on its row: the
   * refetch after a 409 moves that row into the collapsed history.
   */
  readonly cancelError: string | null;
  readonly dismissCancelError: () => void;
  readonly reload: () => void;
  readonly cancel: (reservation: Reservation) => Promise<void>;
}

/**
 * Loads a student's reservations and owns the cancel workflow. `refreshKey`
 * lets a sibling (the booking form) ask for a reload after it creates one.
 */
export function useUserReservations(userId: string, refreshKey: number): UserReservationsState {
  const [reservations, setReservations] = useState<readonly Reservation[]>([]);
  const [resourceNames, setResourceNames] = useState<ReadonlyMap<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingIds, setCancellingIds] = useState<ReadonlySet<string>>(new Set());
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState<number>(0);

  useEffect((): (() => void) => {
    const controller = new AbortController();
    setError(null);

    if (!USER_ID_PATTERN.test(userId)) {
      setReservations([]);
      setIsLoading(false);
      setError('Enter a valid student ID to see reservations.');
      return (): void => {
        controller.abort();
      };
    }

    setIsLoading(true);
    Promise.all([
      fetchUserReservations(userId, { signal: controller.signal }),
      fetchResources(undefined, { signal: controller.signal }),
    ]).then(
      ([loadedReservations, resources]) => {
        if (controller.signal.aborted) return;
        setReservations(loadedReservations);
        setResourceNames(new Map(resources.map((resource) => [resource.id, resource.name])));
        setIsLoading(false);
      },
      (caught: unknown) => {
        if (controller.signal.aborted || isAbortError(caught)) return;
        setReservations([]);
        setError(describeApiError(caught, 'load-reservations'));
        setIsLoading(false);
      },
    );

    return (): void => {
      controller.abort();
    };
  }, [userId, refreshKey, reloadToken]);

  const reload = useCallback((): void => {
    setReloadToken((token) => token + 1);
  }, []);

  const dismissCancelError = useCallback((): void => {
    setCancelError(null);
  }, []);

  const cancel = useCallback(
    async (reservation: Reservation): Promise<void> => {
      setCancellingIds((ids) => new Set(ids).add(reservation.id));
      setCancelError(null);
      try {
        await cancelReservation(reservation.id);
      } catch (caught: unknown) {
        const name = resourceNames.get(reservation.resourceId) ?? 'this resource';
        setCancelError(
          `${name}, ${formatSlot(reservation.startTime, reservation.endTime)}: ${describeApiError(caught, 'cancel')}`,
        );
      } finally {
        setCancellingIds((ids) => {
          const next = new Set(ids);
          next.delete(reservation.id);
          return next;
        });
        // Refetch either way: a 409 or 404 means the server's state differs from ours.
        setReloadToken((token) => token + 1);
      }
    },
    [resourceNames],
  );

  return {
    reservations,
    resourceNames,
    isLoading,
    error,
    cancellingIds,
    cancelError,
    dismissCancelError,
    reload,
    cancel,
  };
}
