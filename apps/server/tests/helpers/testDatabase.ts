/** Test suites delete data. Validate the database name, never credentials or query strings. */
export function assertTestDatabase(url: string | undefined): string {
  if (!url) throw new Error('DATABASE_URL is required for integration tests');
  const target = new URL(url);
  const name = decodeURIComponent(target.pathname.slice(1));
  if (!['postgres:', 'postgresql:'].includes(target.protocol) || !/^\w+_test$/.test(name)) {
    throw new Error('Refusing to run tests: the database name must end in "_test"');
  }
  return name;
}
