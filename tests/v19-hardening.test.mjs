import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';

// Static contract checks: these tests avoid external services and verify the V19 hardening markers.
test('V19 hardening contract exists', async () => {
  const root = path.resolve(new URL('../..', import.meta.url).pathname);
  const server = await (await import('node:fs/promises')).readFile(path.join(root,'server/index.js'),'utf8');
  assert.match(server, /ADMIN_PASSWORD é obrigatório em produção/);
  assert.match(server, /CORS_ORIGINS é obrigatório em produção/);
  assert.match(server, /realtimeCursors = new Map/);
  assert.match(server, /claimNextPrintJob/);
  assert.match(server, /expectedUpdatedAt/);
  assert.match(server, /safetyBackupId/);
});
