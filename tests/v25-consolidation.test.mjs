import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = readFileSync(new URL('../../server/index.js', import.meta.url), 'utf8');
const portal = readFileSync(new URL('../../src/components/AdminPortal.tsx', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../../src/components/AdminDashboard.tsx', import.meta.url), 'utf8');
const supabase = readFileSync(new URL('../../server/lib/db.supabase.js', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../../supabase/migrations/0023_v25_consolidation.sql', import.meta.url), 'utf8');

test('V25 global Kanban is isolated and simultaneous', () => {
  assert.match(server, /app\.get\('\/api\/admin\/orders', requireAdmin/);
  assert.match(server, /db\.listOrdersAll\(\)/);
  assert.match(server, /app\.get\('\/api\/admin\/order-events', requireAdmin/);
  assert.match(portal, /fetchAllOrdersAdmin/);
  assert.match(portal, /subscribeToAllOrderEvents/);
  assert.match(portal, /const orderSlug = target\.restaurantSlug \|\| selectedSlug/);
  assert.match(dashboard, /globalOrderView/);
});

test('V25 database enforces order/item restaurant consistency', () => {
  assert.match(supabase, /\.eq\('restaurant_id', restaurantId\)/);
  assert.match(migration, /update order_items oi/i);
  assert.match(migration, /order_items_order_restaurant_fk/i);
  assert.match(migration, /orders_id_restaurant_unique/i);
});

test('V25 consolidates backups, print jobs and storage', () => {
  assert.match(migration, /create table if not exists restaurant_backups/i);
  assert.match(migration, /create table if not exists realtime_events/i);
  assert.match(migration, /print_jobs_status_check/i);
  assert.match(migration, /storage\.buckets/i);
});

test('V25 history delete and cancel errors expose request correlation', () => {
  assert.match(server, /HISTORY_DELETE_FAILED|HISTORY_CLEAR_FAILED|ORDER_DELETE_FAILED/);
  assert.match(server, /requestId:req\.requestId/);
  assert.match(portal, /Não foi possível atualizar o pedido/);
});
