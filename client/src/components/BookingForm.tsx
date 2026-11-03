import { useState, type ChangeEvent, type SubmitEvent, type ReactElement } from 'react';

import type { CreateReservationState } from '../hooks/useReservations';
import type { Resource } from '../types/campushub';
import { validateBooking, type BookingFieldErrors } from '../utils/booking-validation';
import { addHours, nextFullHour, toLocalInputValue } from '../utils/datetime';
import { Alert } from './Alert';
import styles from './BookingForm.module.css';

export interface BookingFormProps {
  readonly resource: Resource | null;
  readonly userId: string;
  /** From `useReservations`, which reloads the student's list after a booking. */
  readonly booking: CreateReservationState;
  readonly onClearResource: () => void;
}

interface SlotInputs {
  readonly startTime: string;
  readonly endTime: string;
}

function defaultSlot(): SlotInputs {
  const start = nextFullHour(new Date());
  return { startTime: toLocalInputValue(start), endTime: toLocalInputValue(addHours(start, 1)) };
}

/**
 * Books the selected resource. Input is validated locally first; only the
 * server can detect an overlap, which comes back as a 409 shown as an alert.
 */
export function BookingForm({
  resource,
  userId,
  booking,
  onClearResource,
}: BookingFormProps): ReactElement {
  const [slot, setSlot] = useState<SlotInputs>(defaultSlot);
  const [fieldErrors, setFieldErrors] = useState<BookingFieldErrors>({});
  const { isCreating, createError, createSuccess, dismissCreateError, dismissCreateSuccess } =
    booking;

  const handleSlotChange =
    (field: keyof SlotInputs) =>
    (event: ChangeEvent<HTMLInputElement>): void => {
      setSlot((current) => ({ ...current, [field]: event.target.value }));
      setFieldErrors(({ [field]: _cleared, ...rest }) => rest);
    };

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const result = validateBooking(resource, userId, slot, new Date());
    if (!result.ok) {
      setFieldErrors(result.errors);
      return;
    }
    setFieldErrors({});
    booking.create(result.payload, resource?.name ?? 'the resource');
  };

  return (
    <section className={styles.panel} aria-labelledby="booking-form-heading">
      <h2 id="booking-form-heading">Book a resource</h2>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <span className={styles.label}>Resource</span>
          {resource === null ? (
            <p className={styles.hint}>Choose “Book this” on a card in the directory.</p>
          ) : (
            <div className={styles.selected}>
              <div>
                <strong>{resource.name}</strong>
                <p className={styles.hint}>{resource.location}</p>
              </div>
              <button type="button" className={styles.linkButton} onClick={onClearResource}>
                Change
              </button>
            </div>
          )}
          {fieldErrors.resource !== undefined && (resource === null || !resource.isAvailable) && (
            <p className={styles.fieldError}>{fieldErrors.resource}</p>
          )}
          {fieldErrors.userId !== undefined && (
            <p className={styles.fieldError}>{fieldErrors.userId}</p>
          )}
        </div>

        <div className={styles.row}>
          <label className={styles.field}>
            <span className={styles.label}>Start</span>
            <input
              type="datetime-local"
              value={slot.startTime}
              onChange={handleSlotChange('startTime')}
              aria-invalid={fieldErrors.startTime !== undefined}
              disabled={isCreating}
            />
            {fieldErrors.startTime !== undefined && (
              <span className={styles.fieldError}>{fieldErrors.startTime}</span>
            )}
          </label>
          <label className={styles.field}>
            <span className={styles.label}>End</span>
            <input
              type="datetime-local"
              value={slot.endTime}
              onChange={handleSlotChange('endTime')}
              aria-invalid={fieldErrors.endTime !== undefined}
              disabled={isCreating}
            />
            {fieldErrors.endTime !== undefined && (
              <span className={styles.fieldError}>{fieldErrors.endTime}</span>
            )}
          </label>
        </div>

        {createError !== null && (
          <Alert
            tone="error"
            title="Reservation not created"
            message={createError}
            onDismiss={dismissCreateError}
          />
        )}
        {createSuccess !== null && (
          <Alert tone="success" message={createSuccess} onDismiss={dismissCreateSuccess} />
        )}

        <button type="submit" className={styles.submit} disabled={isCreating}>
          {isCreating ? 'Reserving…' : 'Reserve'}
        </button>
      </form>
    </section>
  );
}
