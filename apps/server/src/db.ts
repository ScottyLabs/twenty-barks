import type pg from "pg";

/** The little the app needs from Postgres, so tests can run the same SQL in memory. */
export interface Db {
  query<Row extends object>(sql: string, params?: readonly unknown[]): Promise<Row[]>;
}

export function poolDb(pool: pg.Pool): Db {
  return {
    async query<Row extends object>(sql: string, params: readonly unknown[] = []) {
      const result = await pool.query<Row & pg.QueryResultRow>(sql, [...params]);
      return result.rows;
    },
  };
}

/**
 * Each migration runs once, in order, and is recorded so it never runs again. Only ever add to the end.
 */
const MIGRATIONS: readonly string[] = [
  `create table users (
     id serial primary key,
     sub text not null unique,
     username text,
     name text,
     email text,
     created_at timestamptz not null default now()
   );
   create table login_states (
     state text primary key,
     verifier text not null,
     nonce text not null,
     redirect_uri text not null,
     return_to text not null,
     created_at timestamptz not null default now()
   );
   create table sessions (
     token_hash text primary key,
     user_id integer not null references users(id) on delete cascade,
     expires_at timestamptz not null
   );
   create table puzzles (
     day date primary key,
     name text not null,
     aliases text[] not null,
     facts text[] not null,
     updated_by integer references users(id),
     updated_at timestamptz not null default now()
   );
   create table games (
     id uuid primary key,
     day date not null references puzzles(day) on delete cascade,
     user_id integer references users(id) on delete cascade,
     turns jsonb not null default '[]',
     won boolean not null default false,
     finished_at timestamptz,
     created_at timestamptz not null default now()
   );
   create unique index games_one_per_user_per_day on games (user_id, day) where user_id is not null;`,
  `alter table users add column theme text not null default 'system'
     check (theme in ('system', 'light', 'dark'));`,
];

export async function migrate(db: Db): Promise<void> {
  await db.query(
    "create table if not exists schema_migrations (version integer primary key, applied_at timestamptz not null default now())",
  );
  const done = await db.query<{ version: number }>("select version from schema_migrations");
  const applied = new Set(done.map((row) => row.version));
  for (const [index, sql] of MIGRATIONS.entries()) {
    const version = index + 1;
    if (!applied.has(version)) {
      // In order, one at a time: each migration builds on the last.
      // oxlint-disable-next-line no-await-in-loop
      await db.query(
        `begin; ${sql}; insert into schema_migrations (version) values (${version}); commit;`,
      );
    }
  }
}
