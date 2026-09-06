import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=await readFile(new URL('../../server/index.js',import.meta.url),'utf8');
const migration=await readFile(new URL('../../supabase/migrations/0020_v14_v18.sql',import.meta.url),'utf8');
const bridge=await readFile(new URL('../../print-bridge/bridge.mjs',import.meta.url),'utf8');
assert.match(server,/version: '18\.0\.0'/); assert.match(server,/rateLimit/); assert.match(server,/backups/); assert.match(server,/drivers/); assert.match(server,/payment/); assert.match(server,/listRealtimeEvents/);
assert.match(migration,/restaurant_backups/); assert.match(migration,/realtime_events/); assert.match(migration,/delivery_drivers/);
assert.match(bridge,/PRINTER_HOST/); assert.match(bridge,/print-jobs/);
console.log('TokioInbox V18 smoke: OK');
