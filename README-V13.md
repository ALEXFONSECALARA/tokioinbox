# TokioInbox V13 — operação resiliente

V13 transforma a impressão em uma **fila persistente por restaurante**. O navegador ainda abre a impressão nativa (não existe impressão silenciosa universal via navegador), mas o pedido de impressão passa a ser registrado no backend.

## O que evoluiu
- `print_jobs` persistente no Supabase, com fallback JSON local.
- Cada trabalho guarda restaurante, pedido, via, tentativas, estado, erro e timestamps.
- API administrativa para listar/criar/atualizar trabalhos de impressão.
- Eventos realtime `print-job-created` e `print-job-updated`.
- O modal de impressão registra automaticamente o trabalho e sincroniza o estado `pendente → imprimindo → impresso/erro`.
- A fila fica preparada para um futuro agente local de impressão térmica, sem acoplar o painel a uma impressora específica.
- Versão `/api/version`: `13.0.0`.

## Migração Supabase
Execute `supabase/migrations/0019_print_jobs.sql` depois das migrations anteriores.

## Observação importante
O navegador continua exigindo interação/caixa de impressão. Para impressão física automática, o próximo passo é um **Print Bridge local** (Windows/Linux) que consuma a fila e envie ESC/POS para a impressora térmica.
