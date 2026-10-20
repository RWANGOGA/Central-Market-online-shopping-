/**
 * What an admin is allowed to change.
 *
 * Reading stays open to every signed-in admin: a picker needs the catalogue, a
 * manager needs the books. Writes are where money and stock move, so they are
 * granted per role here instead of comparing `role === 'owner'` in a dozen
 * route files.
 *
 * This module deliberately imports nothing from the database: it is the part
 * that can be unit tested without a DATABASE_URL.
 */

export type AdminRole = 'owner' | 'manager' | 'staff';

export type Permission =
  | 'catalogue.write'
  | 'inventory.write'
  | 'orders.write'
  | 'promos.write'
  | 'suppliers.write'
  | 'customers.write'
  | 'admins.write';

/** Managers run the shop; they cannot touch accounts or customer access. */
const MANAGER: readonly Permission[] = [
  'catalogue.write',
  'inventory.write',
  'orders.write',
  'promos.write',
  'suppliers.write',
];

/** A shop assistant fulfils orders and nothing else. */
const STAFF: readonly Permission[] = ['orders.write'];

export const ROLE_PERMISSIONS: Record<AdminRole, readonly Permission[]> = {
  owner: [...MANAGER, 'customers.write', 'admins.write'],
  manager: MANAGER,
  staff: STAFF,
};

export const ROLE_LABELS: Record<AdminRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  staff: 'Shop assistant',
};

/** Human wording for the 403 message, so it says what was refused. */
export const PERMISSION_LABELS: Record<Permission, string> = {
  'catalogue.write': 'change the catalogue',
  'inventory.write': 'adjust stock',
  'orders.write': 'update orders',
  'promos.write': 'change promo codes',
  'suppliers.write': 'change suppliers or purchase orders',
  'customers.write': 'change customer access',
  'admins.write': 'manage admin accounts',
};

export function can(role: AdminRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function isAdminRole(value: string): value is AdminRole {
  return value === 'owner' || value === 'manager' || value === 'staff';
}
