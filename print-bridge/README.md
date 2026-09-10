# TokioInbox Print Bridge
Agente local opcional para impressão térmica ESC/POS via TCP (porta 9100 por padrão).

Variáveis: `TOKIO_API_URL`, `TOKIO_RESTAURANT_SLUG`, `TOKIO_ADMIN_TOKEN`, `PRINTER_HOST`, `PRINTER_PORT=9100`, `POLL_MS=2000`.

O bridge busca a fila persistente, reserva um job, imprime e atualiza `impresso` ou `erro`. Rode na máquina ligada à impressora. Não coloque credenciais em código-fonte.
