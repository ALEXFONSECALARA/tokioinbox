# Ajuste — 30 mesas e numeração sem #

- PDV Touch passa a renderizar as mesas padrão de 1 a 30, mesmo quando uma configuração antiga possua somente 12/14 mesas.
- Salão/Serviço de Mesas normaliza o estado operacional para incluir as mesas 1 a 30 e preserva mesas adicionais que já existam.
- A migração do catálogo/servidor mantém as mesas existentes e adiciona 1..30.
- Cards do PDV Touch exibem somente o número da mesa, sem o prefixo `#`.
- Pedidos ativos de mesas fora da configuração continuam sendo preservados para evitar perda de dados.
