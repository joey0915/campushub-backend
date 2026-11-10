import { seedResource } from '../../test/fixtures';
import { resourceService } from '../resource.service';

const TENANT = 'tenant-a';

describe('resourceService.listResources', () => {
  it('never returns another tenant’s resources', async (): Promise<void> => {
    const own = await seedResource(TENANT);
    await seedResource('tenant-b', { name: 'Foreign Room' });

    const resources = await resourceService.listResources(TENANT, {});

    expect(resources.map((resource) => resource.id)).toEqual([own._id.toHexString()]);
  });

  it('answers [] for a type outside the enum without matching anything', async (): Promise<void> => {
    await seedResource(TENANT);

    await expect(resourceService.listResources(TENANT, { type: 'STUDY_ROOM' })).resolves.toEqual(
      [],
    );
  });

  it('combines the type and isAvailable filters', async (): Promise<void> => {
    await seedResource(TENANT, { type: 'LAB', isAvailable: true });
    const offline = await seedResource(TENANT, { type: 'LAB', isAvailable: false });
    await seedResource(TENANT, { type: 'ROOM', isAvailable: false });

    const resources = await resourceService.listResources(TENANT, {
      type: 'LAB',
      isAvailable: false,
    });

    expect(resources.map((resource) => resource.id)).toEqual([offline._id.toHexString()]);
  });
});
