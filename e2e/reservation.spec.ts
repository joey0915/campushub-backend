import { expect, test } from './support/fixtures';
import { tomorrowSlot } from './support/slots';

/**
 * Executable form of e2e/scenarios/reservation.feature: one test per
 * Scenario, one `test.step` per Given/When/Then line, worded identically so a
 * failure in the report points straight at the acceptance criterion.
 */
test.describe('Feature: Campus resource reservation', () => {
  test.beforeEach(async ({ campusHub }) => {
    await test.step('Given a student is on the CampusHub home page', async () => {
      await campusHub.open();
    });
  });

  test('Scenario: Student successfully reserves an available study room', async ({
    campusHub,
    reservationApi,
  }) => {
    const slot = tomorrowSlot('10:00 AM', '11:00 AM');

    await test.step('When they filter resources by type "Study Room"', async () => {
      await campusHub.filterByType('Study Room');
      await expect(campusHub.resourceCard('3D Printer A')).toHaveCount(0);
    });
    await test.step('And they select "Study Room 302"', async () => {
      await campusHub.selectResource('Study Room 302');
    });
    await test.step('And they submit a reservation for tomorrow from "10:00 AM" to "11:00 AM"', async () => {
      await campusHub.submitReservation(slot);
    });
    await test.step('Then they should see a "Reserved Study Room 302" success message', async () => {
      await expect(campusHub.successMessage()).toContainText('Reserved Study Room 302');
      await expect(campusHub.successMessage()).toContainText('Status: PENDING');
    });
    await test.step('And the reservation should appear in their "My bookings" list', async () => {
      await expect(campusHub.bookingRow('Study Room 302')).toBeVisible();
      await expect(campusHub.bookingRow('Study Room 302')).toContainText('PENDING');
      const resource = await reservationApi.findResource('Study Room 302');
      const [stored, ...others] = await reservationApi.activeReservations(campusHub.studentId);
      expect(others).toHaveLength(0);
      expect(stored).toMatchObject({
        resourceId: resource.id,
        startTime: slot.start.toISOString(),
        endTime: slot.end.toISOString(),
      });
    });
  });

  test('Scenario: Student receives a conflict alert on double-booking', async ({
    campusHub,
    reservationApi,
  }) => {
    const slot = tomorrowSlot('2:00 PM', '3:00 PM');

    await test.step('Given a resource "3D Printer A" is already reserved tomorrow from "2:00 PM" to "3:00 PM"', async () => {
      await reservationApi.reserve('3D Printer A', `${campusHub.studentId}-other`, slot);
    });
    await test.step('When the student attempts to reserve "3D Printer A" tomorrow from "2:00 PM" to "3:00 PM"', async () => {
      await campusHub.filterByType('Equipment');
      await campusHub.selectResource('3D Printer A');
      await campusHub.submitReservation(slot);
    });
    await test.step('Then the system should display a conflict alert "This resource is already reserved for the selected time window"', async () => {
      await expect(campusHub.errorAlert()).toContainText('Reservation not created');
      await expect(campusHub.errorAlert()).toContainText(
        'This resource is already reserved for the selected time window',
      );
      await expect(campusHub.successMessage()).toHaveCount(0);
    });
    await test.step('And the reservation request should not be created', async () => {
      await expect(campusHub.noActiveReservationsMessage()).toBeVisible();
      expect(await reservationApi.activeReservations(campusHub.studentId)).toHaveLength(0);
    });
  });

  test('Scenario: Unavailable equipment cannot be selected for booking', async ({ campusHub }) => {
    await test.step('When they filter resources by type "Equipment"', async () => {
      await campusHub.filterByType('Equipment');
    });
    await test.step('Then the "DSLR Camera Kit" card should be marked "Unavailable"', async () => {
      await expect(campusHub.resourceCard('DSLR Camera Kit')).toContainText('Unavailable');
    });
    await test.step('And its booking action should be disabled', async () => {
      await expect(campusHub.bookingAction('DSLR Camera Kit')).toBeDisabled();
    });
  });
});
