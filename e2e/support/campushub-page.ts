import { expect, type Locator, type Page } from '@playwright/test';

import { toDateTimeLocal, type Slot } from './slots';

/**
 * The CampusHub UI as a student sees it. Every locator is a role, label or
 * visible text a screen reader would announce; no CSS or XPath selectors.
 */
export class CampusHubPage {
  readonly directory: Locator;
  readonly bookingForm: Locator;
  readonly myBookings: Locator;

  constructor(
    private readonly page: Page,
    readonly studentId: string,
  ) {
    this.directory = page.getByRole('region', { name: 'Resource directory' });
    this.bookingForm = page.getByRole('region', { name: 'Book a resource' });
    this.myBookings = page.getByRole('region', { name: 'My bookings' });
  }

  /** Opens the home page and signs in as this test's own student. */
  async open(): Promise<void> {
    await this.page.goto('/');
    await expect(this.page.getByRole('heading', { name: 'CampusHub', level: 1 })).toBeVisible();
    await this.page.getByLabel('Student ID').fill(this.studentId);
    await this.page.getByRole('button', { name: 'Switch' }).click();
    await expect(this.noActiveReservationsMessage()).toBeVisible();
  }

  async filterByType(label: string): Promise<void> {
    const filter = this.directory
      .getByRole('group', { name: 'Filter by resource type' })
      .getByRole('button', { name: label, exact: true });
    await filter.click();
    await expect(filter).toHaveAttribute('aria-pressed', 'true');
    await expect(this.directory.getByText('Loading resources…')).toBeHidden();
  }

  resourceCard(name: string): Locator {
    return this.directory
      .getByRole('article')
      .filter({ has: this.page.getByRole('heading', { name, exact: true }) });
  }

  bookingAction(resourceName: string): Locator {
    return this.resourceCard(resourceName).getByRole('button', { name: 'Book this' });
  }

  async selectResource(name: string): Promise<void> {
    await this.bookingAction(name).click();
    await expect(this.resourceCard(name).getByRole('button', { name: 'Selected' })).toBeVisible();
    await expect(this.bookingForm.getByText(name, { exact: true })).toBeVisible();
  }

  async submitReservation(slot: Slot): Promise<void> {
    await this.bookingForm.getByLabel('Start').fill(toDateTimeLocal(slot.start));
    await this.bookingForm.getByLabel('End').fill(toDateTimeLocal(slot.end));
    await this.bookingForm.getByRole('button', { name: 'Reserve', exact: true }).click();
  }

  successMessage(): Locator {
    return this.bookingForm.getByRole('status');
  }

  errorAlert(): Locator {
    return this.bookingForm.getByRole('alert');
  }

  bookingRow(resourceName: string): Locator {
    return this.myBookings.getByRole('listitem').filter({ hasText: resourceName });
  }

  noActiveReservationsMessage(): Locator {
    return this.myBookings.getByText(`No active reservations for ${this.studentId}.`);
  }
}
