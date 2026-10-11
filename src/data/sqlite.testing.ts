// For tests only: stands in for expo-sqlite with the SQLite that is built into Node, so
// the app's real SQL runs in Jest. Use it as
//   jest.mock('expo-sqlite', () => jest.requireActual('./sqlite.testing'));
// Nothing in the app imports this file.

type Database = {
  exec: (sql: string) => void;
  prepare: (sql: string) => {
    run: (...params: unknown[]) => unknown;
    all: (...params: unknown[]) => unknown[];
    get: (...params: unknown[]) => unknown;
  };
};

const { DatabaseSync } = jest.requireActual<{
  DatabaseSync: new (path: string, options: object) => Database;
}>('node:sqlite');

// The phone ignores a parameter name it does not know and binds nothing; be as strict.
export const newDatabase = (): Database =>
  new DatabaseSync(':memory:', { allowBareNamedParameters: false });

// One database per test file, as one file on the phone would be, so opening it a second
// time finds what was saved. A test can swap in one of its own.
const shared = globalThis as { testDatabase?: Database };

const args = (params?: unknown) => (params == null ? [] : Array.isArray(params) ? params : [params]);

export function openDatabaseSync() {
  const db = (shared.testDatabase ??= newDatabase());
  return {
    execSync: (sql: string) => db.exec(sql),
    runSync: (sql: string, params?: unknown) => db.prepare(sql).run(...args(params)),
    getAllSync: (sql: string, params?: unknown) => db.prepare(sql).all(...args(params)),
    getFirstSync: (sql: string, params?: unknown) => db.prepare(sql).get(...args(params)) ?? null,
    withTransactionSync: (task: () => void) => {
      db.exec('BEGIN');
      try {
        task();
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}
