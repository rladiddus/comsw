import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MIGRATIONS = path.join(ROOT, "supabase", "migrations");

// Supabase가 기본으로 갖춘 것(역할, auth.jwt(), 기본 권한)만 흉내 낸다.
const SUPABASE_SHIM = `
create role anon nologin;
create role authenticated nologin;
create schema auth;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
grant usage on schema public, auth to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
`;

export async function freshDb() {
  const db = new PGlite();
  await db.exec(SUPABASE_SHIM);
  for (const file of readdirSync(MIGRATIONS).filter(f => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(path.join(MIGRATIONS, file), "utf8"));
  }
  return db;
}

export async function as(db, role, claims = {}) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify(claims)]);
  if (role) await db.exec(`set role ${role === "anon" ? "anon" : "authenticated"}`);
}
