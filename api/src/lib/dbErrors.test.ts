import { describe, expect, it } from 'vitest';
import { isUniqueViolationOn, uniqueConstraintName } from './dbErrors';

/** Shape node-postgres uses for a constraint failure. */
function uniqueError(constraint: string) {
  return Object.assign(new Error('duplicate key value violates unique constraint'), {
    code: '23505',
    constraint,
  });
}

describe('database constraint errors', () => {
  it('reads the constraint out of a unique violation', () => {
    expect(uniqueConstraintName(uniqueError('customers_phone_unique'))).toBe('customers_phone_unique');
  });

  it('ignores every other failure, including a plain throw', () => {
    expect(uniqueConstraintName(Object.assign(new Error('no'), { code: '23503' }))).toBeNull();
    expect(uniqueConstraintName(new Error('connection lost'))).toBeNull();
    expect(uniqueConstraintName(null)).toBeNull();
    expect(uniqueConstraintName('23505')).toBeNull();
  });

  it('matches a violation to the columns it covers', () => {
    expect(isUniqueViolationOn(uniqueError('customers_phone_unique'), ['phone'])).toBe(true);
    expect(isUniqueViolationOn(uniqueError('customers_email_unique'), ['phone'])).toBe(false);
  });

  it('requires every column of a composite index before matching', () => {
    const err = uniqueError('promo_codes_customer_code_unique');
    expect(isUniqueViolationOn(err, ['customer', 'code'])).toBe(true);
    expect(isUniqueViolationOn(err, ['customer', 'code', 'expires'])).toBe(false);
  });

  it('never matches a non-unique error against a column name', () => {
    const notNull = Object.assign(new Error('null value'), { code: '23502', constraint: 'customers_phone_not_null' });
    expect(isUniqueViolationOn(notNull, ['phone'])).toBe(false);
  });
});
