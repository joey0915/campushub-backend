import * as database from '../../config/database';
import { healthService } from '../health.service';

describe('healthService.getHealthReport', () => {
  it.each([
    ['connected', 'ok'],
    ['disconnected', 'degraded'],
    ['connecting', 'degraded'],
  ] as const)('reports a %s database as %s', (state, status): void => {
    jest.spyOn(database, 'getDatabaseState').mockReturnValue(state);

    const report = healthService.getHealthReport();

    expect(report.status).toBe(status);
    expect(report.dependencies.database).toBe(state);
  });
});
