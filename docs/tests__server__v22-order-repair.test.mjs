import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = readFileSync(new URL('../../../server/index.js', import.meta.url), 'utf8');
const supabase = readFileSync(new URL('../../../server/lib/db.supabase.js', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../../supabase/migrations/0022_production_repair.sql', import.meta.url), 'utf8');
const api = readFileSync(new URL('../../../src/utils/api.ts', import.meta.url), 'utf8');

await test('V22 order repair contract exists', () => {
  assert.match(migration, /create table if not exists error_logs/i);
  assert.match(migration, /create table if not exists realtime_events/i);
  assert.match(migration, /add column if not exists customer_id/i);
  assert.match(migration, /add column if not exists updated_at/i);
  assert.match(migration, /add column if not exists payment_status/i);
  assert.match(migration, /create or replace function create_order_atomic/i);
  assert.match(supabase, /supabase\.rpc\('create_order_atomic'/);
  assert.match(supabase, /paymentStatus: 'payment_status'/);
  assert.match(server, /0022_production_repair\.sql/);
  assert.match(api, /cache: 'no-store'/);
});

await test('V22 no longer stores auth sessions only in local Maps', () => {
  assert.doesNotMatch(server, /const adminTokens = new Map/);
  assert.doesNotMatch(server, /const customerTokens = new Map/);
  assert.match(server, /createHmac\('sha256'/);
});
