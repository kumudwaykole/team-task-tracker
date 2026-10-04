import { describe, expect, it } from 'vitest';
import { assertTestDatabase } from '../helpers/testDatabase.js';

describe('destructive test database guard', () => {
  it('accepts a dedicated test database', () => {
    expect(assertTestDatabase('postgresql://postgres:postgres@localhost:5434/tracker_test')).toBe(
      'tracker_test',
    );
  });

  it.each([
    undefined,
    'postgresql://postgres:postgres@localhost:5434/tracker',
    'postgresql://user_test:password@localhost:5434/tracker',
    'postgresql://postgres:password_test@localhost:5434/tracker',
    'postgresql://postgres:postgres@localhost:5434/tracker?schema=public_test',
    'postgresql://postgres:postgres@localhost:5434/tracker_test_backup',
    'https://localhost/tracker_test',
  ])('refuses unsafe target %s', (url) => {
    expect(() => assertTestDatabase(url)).toThrow();
  });
});
