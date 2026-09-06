import { readFile } from 'node:fs/promises'; import assert from 'node:assert/strict';
const s=await readFile(new URL('../../server/index.js',import.meta.url),'utf8');
for(const x of ["recebido: ['em_preparo', 'cancelado']","em_preparo: ['pronto', 'cancelado']","pronto: ['saiu_entrega', 'cancelado']","saiu_entrega: ['entregue', 'cancelado']"]){assert.ok(s.includes(x),`missing flow ${x}`)}
console.log('Order state machine: OK');
