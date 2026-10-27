import { useState, type ChangeEvent, type SubmitEvent, type ReactElement } from 'react';

import { createReservation } from '../api/campushubApi';
import type { Reservation, Resource } from '../types/campushub';
import { validateBooking, type BookingFieldErrors } from '../utils/booking-validation';
import { addHours, formatSlot, nextFullHour, toLocalInputValue } from '../utils/datetime';
import { describeApiError } from '../utils/error-messages';
import { Alert } from './Alert';
import styles from './BookingForm.module.css';

export interface BookingFormProps {
  readonly resource: Resource | null;
  readonly userId: string;
  readonly onBooked: (reservation: Reservation) => void;
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
  onBooked,
  onClearResource,
}: BookingFormProps): ReactElement {
  const [slot, setSlot] = useState<SlotInputs>(defaultSlot);
  const [fieldErrors, setFieldErrors] = useState<BookingFieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleStartChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setSlot((current) => ({ ...current, startTime: event.target.value }));
    setFieldErrors(({ startTime: _cleared, ...rest }) => rest);
  };

  const handleEndChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setSlot((current) => ({ ...current, endTime: event.target.value }));
    setFieldErrors(({ endTime: _cleared, ...rest }) => rest);
  };

  const submit = async (): Promise<void> => {
    setSubmitError(null);
    setSuccessMessage(null);

    const result = validateBooking(resource, userId, slot, new Date());
    if (!result.ok) {
      setFieldErrors(result.errors);
      return;
    }
    setFieldErrors({});
    setIsSubmitting(true);
    try {
      const reservation = await createReservation(result.payload);
      setSuccessMessage(
        `Reserved ${resource?.name ?? 'the resource'} for ${formatSlot(reservation.startTime, reservation.endTime)}. Status: ${reservation.status}.`,
      );
      onBooked(reservation);
    } catch (caught: unknown) {
      setSubmitError(describeApiError(caught, 'create-reservation'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    submit().catch((caught: unknown) => {
      setSubmitError(describeApiError(caught, 'create-reservation'));
      setIsSubmitting(false);
    });
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
              onChange={handleStartChange}
              aria-invalid={fieldErrors.startTime !== undefined}
              disabled={isSubmitting}
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
              onChange={handleEndChange}
              aria-invalid={fieldErrors.endTime !== undefined}
              disabled={isSubmitting}
            />
            {fieldErrors.endTime !== undefined && (
              <span className={styles.fieldError}>{fieldErrors.endTime}</span>
            )}
          </label>
        </div>

        {submitError !== null && (
          <Alert
            tone="error"
            title="Reservation not created"
            message={submitError}
            onDismiss={(): void => {
              setSubmitError(null);
            }}
          />
        )}
        {successMessage !== null && (
          <Alert
            tone="success"
            message={successMessage}
            onDismiss={(): void => {
              setSuccessMessage(null);
            }}
          />
        )}

        <button type="submit" className={styles.submit} disabled={isSubmitting}>
          {isSubmitting ? 'Reserving…' : 'Reserve'}
        </button>
      </form>
    </section>
  );
}
