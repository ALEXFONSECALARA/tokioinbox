# Deploy V9-V12

1. Use Node.js compatível com o `package.json`.
2. Configure `ADMIN_PASSWORD` em produção.
3. Para produção, prefira Supabase para persistência.
4. Configure Supabase Storage ou Cloudinary para mídia.
5. Configure VAPID se Push for usado.
6. Configure `GEMINI_API_KEY` somente se IA for usada.
7. Configure o health check do serviço para `/api/health/ready`.
8. Monitore `/api/health` e `/api/version`.
9. A fila de impressão da V9 é persistente no navegador; impressão automática real exige um agente/bridge local de impressora.
10. Em múltiplas instâncias do Node, o SSE local não é um barramento global; o polling garante convergência, enquanto um pub/sub compartilhado (ex.: Redis/Supabase Realtime) pode ser adicionado em uma próxima etapa.

## V13
Antes de produção, execute também `supabase/migrations/0019_print_jobs.sql`. A fila de impressão agora é persistente no backend; o localStorage permanece como fallback visual do painel.
