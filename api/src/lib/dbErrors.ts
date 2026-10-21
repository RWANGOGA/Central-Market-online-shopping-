/**
 * Translating Postgres constraint failures into something a shopper can read.
 *
 * A unique index is the last line of defence against a race — two requests
 * both pass a pre-check and one write fails. Without a mapping here that
 * failure surfaces as a bare 500 with an empty body, which the browser can
 * only report as "Request failed: 500". Routes pre-check for the friendly
 * message and use this as the safety net.
 */
const UNIQUE_VIOLATION = '23505';

/** The constraint name a unique violation came from, or null for other errors. */
export function uniqueConstraintName(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null;
  const { code, constraint } = err as { code?: unknown; constraint?: unknown };
  if (code !== UNIQUE_VIOLATION) return null;
  return typeof constraint === 'string' ? constraint : null;
}

/**
 * True when `err` is a violation of a constraint covering `columns`.
 *
 * Matching on the columns rather than the constraint label keeps working when
 * a migration renames the index, and it means a table with several unique
 * indexes can be distinguished.
 */
export function isUniqueViolationOn(err: unknown, columns: string[]): boolean {
  const constraint = uniqueConstraintName(err);
  if (!constraint) return false;
  return columns.every((column) => constraint.includes(column.toLowerCase()));
}
