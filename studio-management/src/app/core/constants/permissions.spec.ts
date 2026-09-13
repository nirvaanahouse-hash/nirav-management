import { describe, expect, it } from 'vitest';
import {
  ALL_PERMISSIONS,
  DEFAULT_USER_PERMISSIONS,
  PERMISSION_GROUPS,
} from './permissions';

describe('permission registry', () => {
  it('ALL_PERMISSIONS is the flat, de-duplicated list of group keys', () => {
    const flat = PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.key));
    expect(ALL_PERMISSIONS).toEqual(flat);
    expect(new Set(ALL_PERMISSIONS).size).toBe(ALL_PERMISSIONS.length);
  });

  it('every default-user permission is a real, known permission', () => {
    for (const key of DEFAULT_USER_PERMISSIONS) {
      expect(ALL_PERMISSIONS).toContain(key);
    }
    expect(new Set(DEFAULT_USER_PERMISSIONS).size).toBe(DEFAULT_USER_PERMISSIONS.length);
  });

  it('never grants elevated / admin permissions by default', () => {
    for (const key of [
      'users.permissions',
      'clients.delete',
      'tickets.delete',
      'security.settings.manage',
      'amounts.summary.sa',
      'comparison.view',
      'dashboard.sa.view',
    ]) {
      expect(DEFAULT_USER_PERMISSIONS).not.toContain(key);
    }
  });
});
