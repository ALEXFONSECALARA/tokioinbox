# V9.2 — o que foi alterado (sobre a V9_ULTRA_PLUS)

## Novos arquivos
- src/components/AdminSystemSettings.tsx — toggle KDS, regra Caixa×Mesas, tipos do relatório
- src/components/RemoveOrderItemButton.tsx — [Excluir Item]
- src/components/CashRequiredGate.tsx — "Abra o Caixa para utilizar as mesas."
- src/components/AdminMenuAllStores.tsx — cardápio consolidado "Todas as Lojas"
- src/components/AdminDeviceQrPanel.tsx — gerar QR, autorizar/recusar solicitações
- src/painel/QrPairScreen.tsx — tela de autorização no celular
- src/components/CashCloseModal.tsx — fechamento com resumo, diferença e impressão
- src/utils/cashReport.ts — relatório de venda detalhado (por pagamento/canal/operador/hora/mesa)
- scripts/v92-features-test.mjs (40 testes), scripts/cash-report-test.ts (17 testes)

## Novos endpoints
DELETE /api/orders/:id/items/:itemId · POST /api/devices/qr/create · POST /api/devices/qr/claim ·
GET /api/devices/qr/claim/:id · GET /api/devices/qr/pending · POST /api/devices/qr/claim/:id/decision ·
POST /api/devices/:id/revoke

## Banco / migrations
Nenhuma. `systemSettings` é um novo documento no mecanismo de estado existente (server/stateService.ts).

## Correções de bugs que já existiam
- POST /api/devices/pair aceitava QUALQUER código: agora só códigos emitidos pelo servidor, expiram em 10 min e são de uso único.
- PATCH /api/devices/:id aceitava qualquer campo do corpo (mass-assignment): agora lista permitida.
- Fechamento de caixa gravava PIX/cartão sempre zerados (nenhum fluxo cria movimentos venda_*): agora usa os pedidos do turno.
- "Todas as Lojas" no cardápio caía silenciosamente em 1 restaurante.
- Botão único "Pausar as 4 lojas" trocado por controle individual.

## Riscos / pendências conhecidas (não alteradas)
- A senha do usuário `admin` é FIXA como `admin` no código (server/authAndDeviceService.ts) e ignora ADMIN_PASSWORD. Trocar a senha no painel após o deploy.
- api-security-test: 5 falhas idênticas no ZIP original (causadas pelo item acima). Não é regressão.
- KDS desativado age no cliente; o servidor ainda transmite eventos de pedidos por SSE.
- Excluir Item só na tela do garçom (WaiterPdvTouch).
- Portão do Caixa bloqueia a tela de mesas inteira; o servidor só recusa o pagamento (close-table).
- Não validado: npm run test:e2e (navegador), causa real do "só 4 restaurantes", itens 14–16 e 20–24.

---

# V9.3 — dados reais dos 7 restaurantes, módulo fiscal, WhatsApp/Instagram/Facebook, varredura de bugs

## Restaurantes e dados de demonstração
- Confirmados os 7 restaurantes oficiais (nomes exatos pedidos). "Botanique Gastronomia Vegetal Prime" → "Botanique Gastronomia Vegetal".
- Removidos do seed: WhatsApp, telefone, endereço e chave PIX fictícios (domínio `@tokioinbox.com.br`), e avaliações de clientes inventados (nomes como "Mariana Silveira"). Bases já em produção são migradas automaticamente no boot (só remove valores que ainda são exatamente os do seed — não mexe em dado real já cadastrado pelo dono).
- Pedidos de demonstração (`seed-ord-*`) removidos do carregamento do servidor.
- Novo: `src/utils/demoData.ts` (sanitização + detecção de dado de exemplo, usado também no painel de Ferramentas para avisar o dono do que falta cadastrar).

## PIX real e pedidos por WhatsApp/Instagram/Facebook
- PIX "copia e cola" (BR Code) agora é gerado com CRC16 correto (`src/utils/pix.ts`, testado contra o vetor padrão "123456789"→"29B1"). Antes o CRC era fixo e o QR mostrado no checkout era só decoração — nenhum banco aceitaria.
- Botões de pedido por WhatsApp, Instagram (abre DM) e Facebook (abre Messenger) no cabeçalho do cardápio e no checkout (`src/utils/contactLinks.ts`). Só aparecem se o restaurante tiver o dado cadastrado; o dono pode desligar cada canal individualmente em Restaurantes → Editar.
- Avaliações/estrelas falsas (fallback "96% 5 estrelas" quando não havia nenhuma avaliação) removidas do cabeçalho, checkout e dossiê do restaurante.

## Módulo de Nota Fiscal (certificado digital A1 em arquivo)
O módulo já existia quase pronto no código (1712 linhas de tela administrativa + backend completo de certificado, assinatura XML, DANFC-e, simulação tributária), mas estava **completamente desligado**: o roteador nunca era montado no servidor e a tela nunca aparecia no menu. Consertado e testado ponta a ponta (30 testes em `scripts/fiscal-test.mjs`, incluindo geração de um certificado .pfx real com OpenSSL e emissão simulada completa):
- `server/fiscal/fiscalRoutes.ts` agora é montado em `/api/fiscal`.
- Nova aba "Fiscal" no painel administrativo (`AdminFiscalModule`), com upload de certificado A1 (.pfx/.p12), configuração de CNPJ/regime tributário/CSC, emissão em ambiente de homologação, simulador tributário e exportação para contador.
- **Bug de parser corrigido:** o código lia `p12.safeContents` como dicionário, mas é um array — nenhum certificado real (de nenhuma AC) jamais era aceito. Corrigido para usar `p12.getBags(...)`, a API correta do `node-forge`.
- **Risco fiscal grave corrigido:** os 7 restaurantes tinham CNPJ, razão social, inscrição estadual e token CSC **inventados** pré-cadastrados e gravados automaticamente em disco na primeira leitura. Isso significava risco real de emitir nota fiscal com dados de identificação que não são os do estabelecimento. Agora cada restaurante começa em branco; só fica pronto para emitir depois que o próprio dono cadastra CNPJ e certificado reais.
- **Emissão sem CSC bloqueada:** o gerador de QR Code da NFC-e usava um token de exemplo (`SEFAZ_CSC_HOMOLOGACAO_TOKIO_KEY`) quando o CSC não estava configurado, produzindo um QR Code inválido. Agora a emissão é recusada com mensagem clara até o CSC real ser cadastrado.
- **Falha de autorização grave corrigida (IDOR):** nenhuma rota fiscal validava se o usuário logado tinha permissão sobre o restaurante da URL/corpo — só se ele estava logado. Um gerente vinculado à loja A podia ler/alterar CNPJ, enviar certificado e até emitir nota fiscal em nome de outra loja só trocando o slug. Corrigido com verificação de propriedade em todas as rotas (config, certificado, emissão, cancelamento, reprocessamento, inutilização, auditoria, lista e leitura de documentos).
- Emissão real continua exigindo certificado digital carregado (regra que já existia e foi preservada: "Impressora fiscal não configurada." sem certificado).
- SEFAZ em si continua **simulada** (`[SIMULADO]`) — não há homologação com a Receita/SEFAZ de nenhum estado; isso exigiria contrato e credenciais reais por UF, fora do alcance de uma sessão de código.

## Persistência em disco (bug de infraestrutura)
- `server/authMiddleware.ts` (sessões de login) e os três arquivos do módulo fiscal usavam `process.cwd()/data` fixo, ignorando a variável `DATA_DIR` que o resto do sistema já usa para apontar a um disco persistente. Em produção com filesystem efêmero, sessões de login e todos os dados fiscais (config, certificados, documentos, auditoria) seriam perdidos a cada deploy — a mesma classe de bug que motivou a criação do `DATA_DIR` originalmente, mas esses 4 arquivos ficaram de fora. Corrigido.

## Testes desta rodada
- `scripts/utils-test.ts` — 23 testes (PIX/CRC16, WhatsApp/Instagram/Facebook, sanitização de dado de demonstração)
- `scripts/fiscal-test.mjs` — 30 testes (config, certificado real via OpenSSL, emissão completa, autorização entre restaurantes)
- Suites anteriores continuam passando: `v92-features-test.mjs` (40), `cash-report-test.ts` (17)
- Build (`npm run build`) e `tsc --noEmit` limpos.

## Pendências conhecidas
- `test:e2e` (navegador) não foi executado.
- SEFAZ real (homologação/produção por UF) não implementada — exige credenciamento junto a cada estado.
- WhatsApp Business API (webhooks, mensagens automáticas de status de pedido) não implementada — o que existe é o link `wa.me` (abre conversa com mensagem pré-preenchida), que é a forma de integração possível sem custo de API paga e sem credenciais de terceiros.
- `api-security-test.mjs`: as mesmas 5 falhas do ZIP original persistem (senha do usuário `admin` fixa no código, ignora `ADMIN_PASSWORD`) — não é regressão desta sessão, já reportado anteriormente.
