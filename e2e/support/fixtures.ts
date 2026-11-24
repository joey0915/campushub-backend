import { test as base, type TestInfo } from '@playwright/test';

import { CampusHubPage } from './campushub-page';
import { ReservationApi } from './reservation-api';

export interface CampusHubFixtures {
  readonly reservationApi: ReservationApi;
  readonly campusHub: CampusHubPage;
}

/** A student ID unique to this test and browser, so "My bookings" starts empty. */
function studentIdFor(testInfo: TestInfo): string {
  return `e2e-${testInfo.project.name}-${testInfo.testId}`.replace(/[^A-Za-z0-9_-]/g, '');
}

export const test = base.extend<CampusHubFixtures>({
  reservationApi: async ({ request }, use): Promise<void> => {
    const api = new ReservationApi(request);
    await use(api);
    await api.cancelTouchedReservations();
  },
  campusHub: async ({ page, reservationApi }, use, testInfo): Promise<void> => {
    const studentId = studentIdFor(testInfo);
    reservationApi.track(studentId);
    await use(new CampusHubPage(page, studentId));
  },
});

export { expect } from '@playwright/test';
