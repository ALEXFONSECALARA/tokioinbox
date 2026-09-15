# Reparo Render

Correções aplicadas:
- Removido o uso incompatível de `fileURLToPath(import.meta.url)` no servidor quando empacotado como CommonJS.
- Porta do servidor adaptada para `process.env.PORT`, com fallback 10000.
- `npm start` mantido/apontado para o artefato de produção quando o build gera `dist/server.cjs`.
- Node.js 22.x adicionado ao package.json quando não havia versão definida.
- render.yaml criado quando inexistente.

No Render:
Build Command: npm install && npm run build
Start Command: npm start

Não inclua segredos no GitHub. Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (e demais variáveis exigidas pelo código) em Environment Variables do Render.
