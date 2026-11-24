Feature: Campus resource reservation
  As a student
  I want to reserve campus resources from the CampusHub directory
  So that I can secure a room or equipment without double-booking anyone else

  # Each scenario runs as its own student against freshly seeded demo data:
  # Study Room 302 and 3D Printer A are available, DSLR Camera Kit is not.

  Background:
    Given a student is on the CampusHub home page

  Scenario: Student successfully reserves an available study room
    When they filter resources by type "Study Room"
    And they select "Study Room 302"
    And they submit a reservation for tomorrow from "10:00 AM" to "11:00 AM"
    Then they should see a "Reserved Study Room 302" success message
    And the reservation should appear in their "My bookings" list

  Scenario: Student receives a conflict alert on double-booking
    Given a resource "3D Printer A" is already reserved tomorrow from "2:00 PM" to "3:00 PM"
    When the student attempts to reserve "3D Printer A" tomorrow from "2:00 PM" to "3:00 PM"
    Then the system should display a conflict alert "This resource is already reserved for the selected time window"
    And the reservation request should not be created

  Scenario: Unavailable equipment cannot be selected for booking
    When they filter resources by type "Equipment"
    Then the "DSLR Camera Kit" card should be marked "Unavailable"
    And its booking action should be disabled
