import { useState, type ReactElement } from 'react';

import type { ReservationListState } from '../hooks/useReservations';
import { ACTIVE_RESERVATION_STATUSES, type Reservation } from '../types/campushub';
import { cx } from '../utils/class-names';
import { formatSlot } from '../utils/datetime';
import { Alert } from './Alert';
import styles from './UserReservations.module.css';

export interface UserReservationsProps {
  readonly userId: string;
  /** From `useReservations`, shared with the booking form so a booking reloads it. */
  readonly state: ReservationListState;
}

function isActive(reservation: Reservation): boolean {
  return ACTIVE_RESERVATION_STATUSES.includes(reservation.status);
}

/** "My bookings": the student's active reservations, each cancellable, plus their history. */
export function UserReservations({ userId, state }: UserReservationsProps): ReactElement {
  const {
    reservations,
    resourceNames,
    isLoading,
    error,
    cancellingIds,
    cancelError,
    dismissCancelError,
    reload,
    cancel,
  } = state;
  const [showHistory, setShowHistory] = useState<boolean>(false);

  const active = reservations.filter(isActive);
  const cancelled = reservations.filter((reservation) => !isActive(reservation));
  const isFirstLoad = isLoading && reservations.length === 0;

  const renderRow = (reservation: Reservation): ReactElement => {
    const isCancelling = cancellingIds.has(reservation.id);
    return (
      <li key={reservation.id} className={styles.row}>
        <div className={styles.details}>
          <strong>{resourceNames.get(reservation.resourceId) ?? reservation.resourceId}</strong>
          <span className={styles.slot}>
            {formatSlot(reservation.startTime, reservation.endTime)}
          </span>
        </div>
        <span className={cx(styles.status, styles[reservation.status.toLowerCase()])}>
          {reservation.status}
        </span>
        {isActive(reservation) && (
          <button
            type="button"
            className={styles.cancel}
            disabled={isCancelling}
            onClick={(): void => {
              cancel(reservation);
            }}
          >
            {isCancelling ? 'Cancelling…' : 'Cancel reservation'}
          </button>
        )}
      </li>
    );
  };

  return (
    <section className={styles.panel} aria-labelledby="user-reservations-heading">
      <div className={styles.header}>
        <h2 id="user-reservations-heading">My bookings</h2>
        {isLoading && !isFirstLoad && (
          <span className={styles.refreshing} aria-live="polite">
            Refreshing…
          </span>
        )}
      </div>

      {error !== null && <Alert tone="error" message={error} onRetry={reload} />}
      {cancelError !== null && (
        <Alert
          tone="error"
          title="Reservation not cancelled"
          message={cancelError}
          onDismiss={dismissCancelError}
        />
      )}

      {isFirstLoad ? (
        <p className={styles.placeholder} aria-busy="true">
          Loading your reservations…
        </p>
      ) : error === null && active.length === 0 ? (
        <p className={styles.placeholder}>No active reservations for {userId}.</p>
      ) : (
        <ul className={styles.list} aria-busy={isLoading}>
          {active.map(renderRow)}
        </ul>
      )}

      {cancelled.length > 0 && (
        <div className={styles.history}>
          <button
            type="button"
            className={styles.historyToggle}
            aria-expanded={showHistory}
            onClick={(): void => {
              setShowHistory((shown) => !shown);
            }}
          >
            {showHistory ? 'Hide' : 'Show'} cancelled ({cancelled.length})
          </button>
          {showHistory && <ul className={styles.list}>{cancelled.map(renderRow)}</ul>}
        </div>
      )}
    </section>
  );
}
