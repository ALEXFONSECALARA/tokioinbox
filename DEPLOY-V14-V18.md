# Deploy V14-V18

1. Rode as migrations 0019 e 0020 no Supabase, após 0001-0018.
2. Configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD` e `CORS_ORIGINS`.
3. Faça deploy do servidor/frontend.
4. Teste `/api/health` e `/api/health/ready`.
5. No restaurante, gere um backup em Ferramentas → Produção V18.
6. Se houver impressora térmica, configure `print-bridge/` na máquina local.
7. Para múltiplas instâncias Render, use Supabase: os eventos compartilhados são persistidos em `realtime_events` e retransmitidos por cada processo.

## Checklist de go-live
- [ ] domínio HTTPS
- [ ] senha admin forte e diferente da padrão
- [ ] CORS restrito
- [ ] Supabase migrations aplicadas
- [ ] storage persistente configurado
- [ ] backup testado e restore testado
- [ ] impressora testada
- [ ] pedido teste completo até entregue
- [ ] teste de cancelamento
- [ ] teste de conflito entre dois dispositivos
- [ ] teste mobile/PWA
- [ ] monitoramento de `/api/health/ready`
