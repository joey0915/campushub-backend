import { useState, type ChangeEvent, type SubmitEvent, type ReactElement } from 'react';

import styles from './App.module.css';
import { BookingForm } from './components/BookingForm';
import { ResourceList } from './components/ResourceList';
import { UserReservations } from './components/UserReservations';
import { USER_ID_PATTERN, type Resource } from './types/campushub';

// No authentication exists yet (see docs/openapi.yaml), so the student is chosen
// here; this matches the seeded demo user in the README's curl examples.
const DEMO_USER_ID = 'user-456';

export default function App(): ReactElement {
  const [userId, setUserId] = useState<string>(DEMO_USER_ID);
  const [userIdDraft, setUserIdDraft] = useState<string>(DEMO_USER_ID);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [reservationsVersion, setReservationsVersion] = useState<number>(0);

  const isDraftValid = USER_ID_PATTERN.test(userIdDraft);

  const handleDraftChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setUserIdDraft(event.target.value.trim());
  };

  const handleSwitchUser = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (isDraftValid) {
      setUserId(userIdDraft);
    }
  };

  const handleBooked = (): void => {
    setReservationsVersion((version) => version + 1);
  };

  const handleClearResource = (): void => {
    setSelectedResource(null);
  };

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>CampusHub</h1>
          <p className={styles.subtitle}>Reserve study rooms, equipment and labs</p>
        </div>
        <form className={styles.userForm} onSubmit={handleSwitchUser}>
          <label htmlFor="student-id" className={styles.userLabel}>
            Student ID
          </label>
          <input
            id="student-id"
            value={userIdDraft}
            onChange={handleDraftChange}
            aria-invalid={!isDraftValid}
            className={styles.userInput}
          />
          <button
            type="submit"
            className={styles.userButton}
            disabled={!isDraftValid || userIdDraft === userId}
          >
            Switch
          </button>
        </form>
      </header>

      <main className={styles.layout}>
        <ResourceList
          selectedResourceId={selectedResource?.id ?? null}
          onSelectResource={setSelectedResource}
        />
        <aside className={styles.sidebar}>
          <BookingForm
            resource={selectedResource}
            userId={userId}
            onBooked={handleBooked}
            onClearResource={handleClearResource}
          />
          <UserReservations userId={userId} refreshKey={reservationsVersion} />
        </aside>
      </main>
    </div>
  );
}
