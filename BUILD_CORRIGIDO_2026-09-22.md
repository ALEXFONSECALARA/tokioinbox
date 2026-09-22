# Correção de build — 22/09/2026

Corrigido o `vite.config.ts` para usar imports ESM/Node compatíveis, resolução explícita de `__dirname` via `fileURLToPath`, aliases com `resolve()` e configuração estável dos plugins React + Tailwind.

Comando esperado no Render:
`npm run build`

O build executa:
`vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs`
