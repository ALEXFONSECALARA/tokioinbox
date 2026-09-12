import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const portal = fs.readFileSync('src/components/AdminPortal.tsx', 'utf8');
const supabase = fs.readFileSync('server/lib/db.supabase.js', 'utf8');
const json = fs.readFileSync('server/lib/db.json.js', 'utf8');

test('V24.2 order isolation contract exists', () => {
  assert.match(portal, /onlyRestaurantOrders/);
  assert.match(portal, /order\.restaurantSlug === slug/);
  assert.match(supabase, /\.eq\('restaurant_id', restaurantId\)/);
  assert.match(supabase, /orderRowToApi\(o, itemsByOrder\.get\(o\.id\), slug\)/);
  assert.match(json, /restaurantSlug: slug/);
});
