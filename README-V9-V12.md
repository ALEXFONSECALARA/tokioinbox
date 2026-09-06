# TokioInbox — Evolução V9 → V12

## V9 — Operação de impressão resiliente
- Estado da fila de impressão persistido por restaurante e dispositivo.
- Estados: `pendente`, `imprimindo`, `impresso`, `erro`.
- A fila sobrevive a reload da página.
- Preparado para evolução futura para agente de impressão local.

## V10 — Central de notificações
- Central unificada no painel operacional.
- Eventos de pedido, cardápio e configuração.
- Histórico local limitado aos últimos 40 eventos.
- Limpeza manual da central.

## V11 — Sincronização em tempo real
- Alterações de produtos/categorias em um dispositivo avisam os demais.
- Alterações de configuração também são propagadas.
- SSE continua autenticado e o polling permanece como fallback.

## V12 — Resiliência e observabilidade
- Endpoint `/api/version` identifica release e capacidades.
- Health/readiness da V8 mantidos.
- Backend continua compatível com JSON local e Supabase.
- A arquitetura evita confiar exclusivamente no realtime: polling continua garantindo convergência eventual.
