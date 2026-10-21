import { describe, expect, it } from 'vitest';
import { can, isAdminRole, ROLE_PERMISSIONS, type Permission } from './adminPermissions';

const ALL: Permission[] = [
  'catalogue.write',
  'inventory.write',
  'orders.write',
  'refunds.write',
  'promos.write',
  'suppliers.write',
  'customers.write',
  'admins.write',
];

describe('admin permissions', () => {
  it('lets an owner do everything', () => {
    for (const permission of ALL) {
      expect(can('owner', permission)).toBe(true);
    }
  });

  it('lets a manager run the shop but not the accounts', () => {
    expect(can('manager', 'catalogue.write')).toBe(true);
    expect(can('manager', 'inventory.write')).toBe(true);
    expect(can('manager', 'orders.write')).toBe(true);
    expect(can('manager', 'refunds.write')).toBe(true);
    expect(can('manager', 'promos.write')).toBe(true);
    expect(can('manager', 'suppliers.write')).toBe(true);

    // The two things that must stay with the owner: who can sign in, and who
    // is allowed to shop.
    expect(can('manager', 'admins.write')).toBe(false);
    expect(can('manager', 'customers.write')).toBe(false);
  });

  it('gives a shop assistant order fulfilment only', () => {
    expect(can('staff', 'orders.write')).toBe(true);
    // Taking cash is part of delivering; paying it back is not.
    expect(can('staff', 'refunds.write')).toBe(false);

    for (const permission of ALL.filter((item) => item !== 'orders.write')) {
      expect(can('staff', permission)).toBe(false);
    }
  });

  it('never grants a permission to an unknown role', () => {
    expect(can('intern' as never, 'orders.write')).toBe(false);
  });

  it('keeps the matrix closed: every role lists only real permissions', () => {
    for (const permissions of Object.values(ROLE_PERMISSIONS)) {
      for (const permission of permissions) {
        expect(ALL).toContain(permission);
      }
    }
  });

  it('recognises the three role strings', () => {
    expect(isAdminRole('owner')).toBe(true);
    expect(isAdminRole('manager')).toBe(true);
    expect(isAdminRole('staff')).toBe(true);
    expect(isAdminRole('admin')).toBe(false);
    expect(isAdminRole('')).toBe(false);
  });
});
