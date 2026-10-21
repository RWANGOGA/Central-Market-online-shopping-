import type { admins } from '@/db/schema';

/**
 * The shape the staff console sees for an account.
 *
 * Shared by the list and update routes so a field cannot appear in one and be
 * missing from the other. No password material is part of this type.
 */

export type AdminRow = typeof admins.$inferSelect;

export type AdminAccountDto = {
  id: number;
  name: string;
  email: string;
  role: AdminRow['role'];
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  activeSessions: number;
};

export function adminDto(row: AdminRow, activeSessions: number): AdminAccountDto {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    active: row.active,
    createdAt: row.createdAt,
    lastLoginAt: row.lastLoginAt,
    activeSessions,
  };
}
