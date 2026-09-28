# V9 ULTRA PLUS — o que mudou

1. **Cupom de conferência automático ao clicar em FECHAR/FECHAMENTO** (Garçom, Salão/Mesas, Caixa, Balcão, Retirada, Delivery e Pedidos/Kanban).
   - Arquivos: `src/utils/conferencePrint.ts`, `src/utils/useConferencePrint.ts`, `src/components/ConferenceAutoPrintPanel.tsx`.
   - Impressora escolhida no Caixa (botão "Conferência AUTO" no topo do Caixa): liga/desliga por tela, vias (1-3x) e modo (Agente / Navegador / Automático).
   - Agente de Impressão = totalmente silencioso. Pelo navegador, abra o Chrome/Edge do caixa com `--kiosk-printing` para não aparecer a janela de impressão.
2. **Caixa volta para a tela inicial** depois de adicionar/enviar item na mesa.
3. **Ferramentas desativadas ficam ocultas** (canal de venda desligado some da barra de ambientes, da navegação e das abas do Caixa).
4. **Novo login → Salão limpo, mesas centralizadas, sem corte e sem rolagem** (`src/components/FitTableGrid.tsx`; o estado do usuário anterior é descartado no login/logout).
