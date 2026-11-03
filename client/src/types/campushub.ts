/**
 * The client's view of the CampusHub Reservation API contract, `docs/openapi.yaml`.
 * The schemas are declared once in `shared/contract.ts`, which the server imports
 * too, so the two sides cannot drift apart; add a schema there, not here.
 */
export * from '../../../shared/contract';
