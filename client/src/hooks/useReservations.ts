import { useCallback, useEffect, useState } from 'react';

import {
  cancelReservation,
  createReservation,
  fetchResources,
  fetchUserReservations,
} from '../api/campushubApi';
import {
  USER_ID_PATTERN,
  type CreateReservationRequest,
  type Reservation,
} from '../types/campushub';
import { formatSlot } from '../utils/datetime';
import { describeApiError, isAbortError } from '../utils/error-messages';

/** A student's reservations and the cancel workflow, as `UserReservations` renders them. */
export interface ReservationListState {
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
  readonly cancel: (reservation: Reservation) => void;
}

/** The booking workflow, as `BookingForm` renders it. */
export interface CreateReservationState {
  readonly isCreating: boolean;
  readonly createError: string | null;
  readonly createSuccess: string | null;
  readonly dismissCreateError: () => void;
  readonly dismissCreateSuccess: () => void;
  /** `resourceName` labels the success message; the payload only carries an id. */
  readonly create: (payload: CreateReservationRequest, resourceName: string) => void;
}

export interface ReservationsState extends ReservationListState, CreateReservationState {}

/**
 * Every reservation workflow of one student: loading the list, cancelling, and
 * booking. One instance serves both the form and the list, so a new booking or
 * a cancellation reloads the list without the components coordinating.
 * Mutations are not aborted on unmount (AGENTS.md §3a).
 */
export function useReservations(userId: string): ReservationsState {
  const [reservations, setReservations] = useState<readonly Reservation[]>([]);
  const [resourceNames, setResourceNames] = useState<ReadonlyMap<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingIds, setCancellingIds] = useState<ReadonlySet<string>>(new Set());
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
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
  }, [userId, reloadToken]);

  const reload = useCallback((): void => {
    setReloadToken((token) => token + 1);
  }, []);

  const dismissCancelError = useCallback((): void => {
    setCancelError(null);
  }, []);

  const dismissCreateError = useCallback((): void => {
    setCreateError(null);
  }, []);

  const dismissCreateSuccess = useCallback((): void => {
    setCreateSuccess(null);
  }, []);

  const cancel = useCallback(
    (reservation: Reservation): void => {
      setCancellingIds((ids) => new Set(ids).add(reservation.id));
      setCancelError(null);
      // Refetch either way: a 409 or 404 means the server's state differs from ours.
      const settle = (): void => {
        setCancellingIds((ids) => {
          const next = new Set(ids);
          next.delete(reservation.id);
          return next;
        });
        setReloadToken((token) => token + 1);
      };
      cancelReservation(reservation.id).then(settle, (caught: unknown) => {
        const name = resourceNames.get(reservation.resourceId) ?? 'this resource';
        setCancelError(
          `${name}, ${formatSlot(reservation.startTime, reservation.endTime)}: ${describeApiError(caught, 'cancel')}`,
        );
        settle();
      });
    },
    [resourceNames],
  );

  const create = useCallback((payload: CreateReservationRequest, resourceName: string): void => {
    setIsCreating(true);
    setCreateError(null);
    setCreateSuccess(null);
    createReservation(payload).then(
      (reservation) => {
        setCreateSuccess(
          `Reserved ${resourceName} for ${formatSlot(reservation.startTime, reservation.endTime)}. Status: ${reservation.status}.`,
        );
        setIsCreating(false);
        setReloadToken((token) => token + 1);
      },
      (caught: unknown) => {
        setCreateError(describeApiError(caught, 'create-reservation'));
        setIsCreating(false);
      },
    );
  }, []);

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
    isCreating,
    createError,
    createSuccess,
    dismissCreateError,
    dismissCreateSuccess,
    create,
  };
}
