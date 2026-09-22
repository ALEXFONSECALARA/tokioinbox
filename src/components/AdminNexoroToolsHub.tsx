import React, { useState } from 'react';
import {
  LayoutDashboard,
  Bot,
  Printer,
  Smartphone,
  Gift,
  LogIn,
  Crown,
  Store,
  Utensils,
  Calculator,
  ChefHat,
  Bike,
  Users,
  Megaphone,
  BarChart3,
  BellRing,
  Database,
  ShieldCheck,
  WifiOff,
  Wrench,
  Monitor,
  Sparkles,
  ShieldAlert,
  Search,
  CheckCircle2,
  ExternalLink,
  SlidersHorizontal,
  ChevronRight,
  TrendingUp,
  Cpu,
  RefreshCw,
  QrCode,
  FileSpreadsheet,
  Clock,
  MapPin,
  Lock,
} from 'lucide-react';
import { BRAND_CONFIG } from '../config/brand';

export interface NexoroToolDefinition {
  id: number;
  code: string;
  title: string;
  category: 'operacao' | 'inteligencia' | 'vendas' | 'gestao' | 'seguranca';
  icon: React.ElementType;
  summary: string;
  items: string[];
  status: 'ativo' | 'operacional' | 'conectado' | 'ia_ativa';
  badgeColor: string;
  tabTarget?: string;
  actionLabel?: string;
}

export const NEXORO_TOOLS: NexoroToolDefinition[] = [
  {
    id: 1,
    code: '01',
    title: 'PAINEL MULTIRRESTAURANTE',
    category: 'operacao',
    icon: LayoutDashboard,
    summary: 'Visão executiva centralizada de todas as unidades e operações.',
    items: [
      'Visão geral de todos os restaurantes',
      'Indicadores em tempo real',
      'Central de exceções e alertas',
      'Filtros, gráficos e relatórios',
      'Visualização por dispositivo (desktop, tablet, mobile)',
    ],
    status: 'operacional',
    badgeColor: 'text-[#00C896] bg-[#00C896]/10 border-[#00C896]/30',
    tabTarget: 'kanban',
    actionLabel: 'Abrir Painel Geral',
  },
  {
    id: 2,
    code: '02',
    title: 'CENTRAL DE INTELIGÊNCIA ARTIFICIAL (AI ENGINE)',
    category: 'inteligencia',
    icon: Bot,
    summary: 'Central modular de IA: Atendente Virtual, Smart Pairing, Engenheiro CMV e Smart KDS.',
    items: [
      '1. Atendente Virtual & Concierge com personalização e regras de alergia',
      '2. Chef & Sommelier Virtual (Smart Pairing no carrinho)',
      '3. Engenheiro de Cardápio & Consultor CMV (Matriz BCG com aprovação de preços)',
      '4. Gerente de Cozinha & Smart KDS (Praças e alertas)',
      'Governança, auditoria de logs e modo de simulação seguro',
    ],
    status: 'ia_ativa',
    badgeColor: 'text-purple-300 bg-purple-950/50 border-purple-500/40',
    tabTarget: 'ai_engine',
    actionLabel: 'Central de IA',
  },
  {
    id: 3,
    code: '03',
    title: 'IMPRESSÃO AUTOMÁTICA INTELIGENTE',
    category: 'operacao',
    icon: Printer,
    summary: 'Print Agent térmico local para Windows, Mac e Linux sem falhas.',
    items: [
      'Print Agent local (Windows / Spooler ESC/POS)',
      'Fila de impressão e retry automático',
      'Impressão por setor (cozinha, bar, sushi, expedição)',
      'Monitoramento e status em tempo real',
      'Evita duplicidade de impressão',
    ],
    status: 'ativo',
    badgeColor: 'text-cyan-400 bg-cyan-950/40 border-cyan-500/30',
    tabTarget: 'print_agent',
    actionLabel: 'Fila de Impressão',
  },
  {
    id: 4,
    code: '04',
    title: 'PWA E APP DO CLIENTE',
    category: 'vendas',
    icon: Smartphone,
    summary: 'Aplicativo web progressivo instalável no Android e iOS.',
    items: [
      'Instalação automática (Android / iOS)',
      'Acesso ultra-rápido e suporte offline',
      'Notificações push de status do pedido',
      'Interface moderna, ágil e responsiva',
    ],
    status: 'operacional',
    badgeColor: 'text-[#00C896] bg-[#00C896]/10 border-[#00C896]/30',
    tabTarget: 'devices',
    actionLabel: 'Configurar PWA',
  },
  {
    id: 5,
    code: '05',
    title: 'BÔNUS DE INSTALAÇÃO',
    category: 'vendas',
    icon: Gift,
    summary: 'Incentivos automáticos para fidelizar clientes no app próprio.',
    items: [
      'Desconto, brinde ou complemento grátis',
      'Configuração independente por restaurante',
      'Validade e limite de uso programável',
      'Controle automático e anti-fraude no sistema',
    ],
    status: 'ativo',
    badgeColor: 'text-amber-400 bg-amber-950/40 border-amber-500/30',
    tabTarget: 'promotions',
    actionLabel: 'Regras de Bônus',
  },
  {
    id: 6,
    code: '06',
    title: 'LOGIN DO CLIENTE',
    category: 'seguranca',
    icon: LogIn,
    summary: 'Autenticação fluida sem atritos com histórico completo.',
    items: [
      'Login único ou por restaurante',
      'Recuperação via e-mail ou WhatsApp',
      'Segurança, criptografia e conformidade LGPD',
      'Acesso restrito ao cardápio e histórico de pedidos',
    ],
    status: 'ativo',
    badgeColor: 'text-emerald-400 bg-emerald-950/40 border-emerald-500/30',
    tabTarget: 'customers',
    actionLabel: 'Painel de Clientes',
  },
  {
    id: 7,
    code: '07',
    title: 'SUPER ADMIN / ADMIN MASTER',
    category: 'gestao',
    icon: Crown,
    summary: 'Controle irrestrito para proprietários e diretores da rede.',
    items: [
      'Acesso total e simultâneo a todos os restaurantes',
      'Gerenciar usuários, permissões granulares e dados',
      'Excluir e resetar pedidos do dia (com confirmação)',
      'Controle de motoboys, senhas e chaves de acesso',
      'Acesso irrestrito a todas as ferramentas e relatórios',
    ],
    status: 'operacional',
    badgeColor: 'text-[#D4AF37] bg-[#D4AF37]/10 border-[#D4AF37]/30',
    tabTarget: 'users',
    actionLabel: 'Acessar Master',
  },
  {
    id: 8,
    code: '08',
    title: 'VITRINE PRINCIPAL',
    category: 'vendas',
    icon: Store,
    summary: 'Página inicial comercial com múltiplos conceitos culinários.',
    items: [
      'Gerenciar restaurantes e dark kitchens ativas',
      'Ordenar e personalizar posições da vitrine',
      'Banners de destaque, promoções e horários',
      'Status automático de aberto/fechado',
      'Configurações visuais de exibição e layout',
    ],
    status: 'operacional',
    badgeColor: 'text-[#00C896] bg-[#00C896]/10 border-[#00C896]/30',
    tabTarget: 'vitrine',
    actionLabel: 'Editar Vitrine',
  },
  {
    id: 9,
    code: '09',
    title: 'GESTÃO DE CARDÁPIO',
    category: 'gestao',
    icon: Utensils,
    summary: 'Administração de itens, adicionais, fotos e categorias.',
    items: [
      'Categorias, produtos e complementos múltiplos',
      'Fotos em alta resolução, preços e promoções',
      'Destaques e badges (vegano, sem glúten, picante)',
      'Duplicar e desativar produtos em 1 clique',
      'Observações personalizáveis para a cozinha',
    ],
    status: 'operacional',
    badgeColor: 'text-cyan-400 bg-cyan-950/40 border-cyan-500/30',
    tabTarget: 'menu',
    actionLabel: 'Abrir Cardápio',
  },
  {
    id: 10,
    code: '10',
    title: 'CMV E PRECIFICAÇÃO',
    category: 'gestao',
    icon: Calculator,
    summary: 'Ficha técnica de custo de mercadorias vendidas e margem real.',
    items: [
      'Ficha técnica e custo por ingrediente',
      'Rendimento real e margem de contribuição líquida',
      'Simulação de cenários de preços e taxas de entrega',
      'Sem alteração automática acidental de valores no ar',
    ],
    status: 'ativo',
    badgeColor: 'text-amber-400 bg-amber-950/40 border-amber-500/30',
    tabTarget: 'pricing',
    actionLabel: 'Calcular CMV',
  },
  {
    id: 11,
    code: '11',
    title: 'PRODUÇÃO (KDS)',
    category: 'operacao',
    icon: ChefHat,
    summary: 'Kitchen Display System com roteamento por praças e setores.',
    items: [
      'Cozinha quente, sushi bar, bar de drinks e sobremesas',
      'Encaminhamento automático e imediato de pedidos',
      'Controle visual de tempo decorrido, prioridade e observações',
      'Sincronização em tempo real entre operadores e cozinheiros',
    ],
    status: 'operacional',
    badgeColor: 'text-[#00C896] bg-[#00C896]/10 border-[#00C896]/30',
    tabTarget: 'kds',
    actionLabel: 'Abrir Tela KDS',
  },
  {
    id: 12,
    code: '12',
    title: 'ENTREGADORES',
    category: 'operacao',
    icon: Bike,
    summary: 'Despacho, frota própria, cálculo de repasses e rotas.',
    items: [
      'Cadastro e gerenciamento de motoboys parceiros',
      'Status em rota, ocupado ou disponível',
      'Histórico detalhado de entregas com PIN de segurança',
      'Comissões, taxas por KM e fechamento de repasses',
    ],
    status: 'operacional',
    badgeColor: 'text-blue-400 bg-blue-950/40 border-blue-500/30',
    tabTarget: 'dispatch',
    actionLabel: 'Painel Despacho',
  },
  {
    id: 13,
    code: '13',
    title: 'CENTRAL DE CLIENTES (CRM)',
    category: 'vendas',
    icon: Users,
    summary: 'Base de clientes com segmentação RFM e fidelização.',
    items: [
      'Dados de contato, endereços e histórico de compras',
      'Segmentação inteligente (VIP, Recorrente, Em Risco, Inativo)',
      'Disparos automatizados de cupons e mensagens',
      'Estratégias de fidelização e reativação',
    ],
    status: 'ativo',
    badgeColor: 'text-emerald-400 bg-emerald-950/40 border-emerald-500/30',
    tabTarget: 'crm_recovery',
    actionLabel: 'Ver CRM',
  },
  {
    id: 14,
    code: '14',
    title: 'MARKETING E PROMOÇÕES',
    category: 'vendas',
    icon: Megaphone,
    summary: 'Gerador de campanhas e copy persuasiva multicanal.',
    items: [
      'Posts e legendas para Instagram, Facebook e TikTok',
      'Campanhas prontas para WhatsApp comercial',
      'Promoções compre 1 leve 2 e cupons progressivos',
      'Conteúdo gastronômico gerado por Inteligência Artificial',
      'Agendamento e acompanhamento de retorno das campanhas',
    ],
    status: 'ia_ativa',
    badgeColor: 'text-[#D4AF37] bg-[#D4AF37]/10 border-[#D4AF37]/30',
    tabTarget: 'marketing',
    actionLabel: 'Criar Campanhas',
  },
  {
    id: 15,
    code: '15',
    title: 'ANALYTICS E RELATÓRIOS',
    category: 'gestao',
    icon: BarChart3,
    summary: 'Métricas de conversão, ticket médio, horários de pico e itens.',
    items: [
      'Vendas brutas, ticket médio e taxa de conversão',
      'Curva ABC de produtos e categorias mais rentáveis',
      'Monitoramento de cancelamentos e devoluções',
      'Relatórios consolidados ou por restaurante',
      'Gráficos interativos e exportação em CSV/JSON',
    ],
    status: 'operacional',
    badgeColor: 'text-cyan-400 bg-cyan-950/40 border-cyan-500/30',
    tabTarget: 'audit',
    actionLabel: 'Ver Analytics',
  },
  {
    id: 16,
    code: '16',
    title: 'ALERTAS E NOTIFICAÇÕES',
    category: 'operacao',
    icon: BellRing,
    summary: 'Sons de alto impacto, campainha de novos pedidos e atrasos.',
    items: [
      'Alerta sonoro estridente para novo pedido',
      'Avisos de pedidos atrasados na cozinha (>15 min)',
      'Push notifications para navegadores e celulares',
      'Configuração individual por usuário e loja',
      'Central unificada de alertas com histórico',
    ],
    status: 'ativo',
    badgeColor: 'text-rose-400 bg-rose-950/40 border-rose-500/30',
    tabTarget: 'settings',
    actionLabel: 'Ajustar Sons',
  },
  {
    id: 17,
    code: '17',
    title: 'BACKUP E EXPORTAÇÃO',
    category: 'seguranca',
    icon: Database,
    summary: 'Snapshots completos, cópia de segurança e migração.',
    items: [
      'Exportação instantânea de banco em CSV / JSON',
      'Backup sanitizado (sem hashes de senhas expostas)',
      'Restauração de dados controlada com confirmação',
      'Registro inalterável de auditoria no log do sistema',
    ],
    status: 'ativo',
    badgeColor: 'text-emerald-400 bg-emerald-950/40 border-emerald-500/30',
    tabTarget: 'backup',
    actionLabel: 'Fazer Backup',
  },
  {
    id: 18,
    code: '18',
    title: 'AUDITORIA E SEGURANÇA',
    category: 'seguranca',
    icon: ShieldCheck,
    summary: 'Rastreamento de cada clique, login e alteração de preço.',
    items: [
      'Logs completos com timestamp, IP e usuário responsável',
      'Auditoria de segurança em tempo real',
      'Políticas de RLS e isolamento multi-inquilino estrito',
      'Detecção de anomalias e tentativas suspeitas',
      'Monitor de sessões e dispositivos ativos',
    ],
    status: 'operacional',
    badgeColor: 'text-emerald-400 bg-emerald-950/40 border-emerald-500/30',
    tabTarget: 'audit',
    actionLabel: 'Logs de Segurança',
  },
  {
    id: 19,
    code: '19',
    title: 'MODO OFFLINE E RECONEXÃO',
    category: 'operacao',
    icon: WifiOff,
    summary: 'Continuidade de atendimento mesmo sem internet ou com instabilidade.',
    items: [
      'Funciona sem conexão (fila local em IndexedDB/Storage)',
      'Sincronização automática assim que a rede retornar',
      'Proteção rigorosa contra duplicidade de pedidos',
      'Aviso visual imediato de conexão perdida e restaurada',
    ],
    status: 'ativo',
    badgeColor: 'text-amber-400 bg-amber-950/40 border-amber-500/30',
    tabTarget: 'health',
    actionLabel: 'Status de Rede',
  },
  {
    id: 20,
    code: '20',
    title: 'FERRAMENTAS ADMINISTRATIVAS',
    category: 'gestao',
    icon: Wrench,
    summary: 'Suite completa com mais de 25 utilitários diários de gestão.',
    items: [
      'Gerador de Flyer & QR Code de mesa e balcão',
      'Calculadora de CMV e simulação de margem',
      'Simulador de pedidos para treinamento da equipe',
      'Fechamento de caixa, conciliação e repasses',
      'Horários, geofencing de entrega e dispositivos',
    ],
    status: 'operacional',
    badgeColor: 'text-[#D4AF37] bg-[#D4AF37]/10 border-[#D4AF37]/30',
    tabTarget: 'admin_suite',
    actionLabel: 'Abrir Suite Admin',
  },
  {
    id: 21,
    code: '21',
    title: 'PREVIEW RESPONSIVO',
    category: 'operacao',
    icon: Monitor,
    summary: 'Simulador visual em tempo real para Desktop, Tablet e Mobile.',
    items: [
      'Visão simulada de telas (Desktop, Tablet, iPhone, Android)',
      'Alternância de orientação retrato / paisagem',
      'Zoom e medidas de tela personalizadas',
      'Visualização lado a lado de cardápio e checkout',
    ],
    status: 'operacional',
    badgeColor: 'text-cyan-400 bg-cyan-950/40 border-cyan-500/30',
    tabTarget: 'devices',
    actionLabel: 'Abrir Simulador',
  },
  {
    id: 22,
    code: '22',
    title: 'IA E FUTURO',
    category: 'inteligencia',
    icon: Sparkles,
    summary: 'Previsão de demanda, precificação dinâmica e automações futuras.',
    items: [
      'Análise preditiva de vendas e demanda semanal',
      'Sugestões autônomas de novos pratos e promoções',
      'Atendimento por voz e chat 100% automatizado',
      'Expansão de integrações com ERPs e marketplaces',
    ],
    status: 'ia_ativa',
    badgeColor: 'text-[#D4AF37] bg-[#D4AF37]/10 border-[#D4AF37]/30',
    tabTarget: 'ai_sales',
    actionLabel: 'Explorar IA',
  },
  {
    id: 23,
    code: '23',
    title: 'AUDITOR SÊNIOR',
    category: 'seguranca',
    icon: ShieldAlert,
    summary: 'Diagnóstico automatizado de integridade, isolamento e desempenho.',
    items: [
      'Varredura completa em todos os módulos e tabelas',
      'Correção automática de inconsistências de estado',
      'Relatório final de conformidade de segurança e performance',
      'Auditoria de permissões e chaves de segurança',
    ],
    status: 'operacional',
    badgeColor: 'text-rose-400 bg-rose-950/40 border-rose-500/30',
    tabTarget: 'auditor',
    actionLabel: 'Executar Auditor',
  },
];

// Reordenação por PRIORIDADE DE USO no dia a dia operacional (mapeado por id da ferramenta
// acima). Ferramentas usadas o tempo todo em turno (produção, entregas, cardápio, caixa)
// aparecem primeiro; ferramentas de configuração/avançadas/auditoria ficam por último.
const TOOL_PRIORITY_BY_ID: Record<number, number> = {
  1: 1, // Painel Multirrestaurante — visão geral, usada o tempo todo
  11: 2, // Produção (KDS) — cozinha, uso contínuo em turno
  12: 3, // Entregadores — logística de entrega em tempo real
  3: 4, // Impressão automática — operação de cada pedido
  9: 5, // Gestão de Cardápio — atualização frequente
  10: 6, // CMV e Precificação — acompanhamento de margem
  16: 7, // Alertas e Notificações — monitoramento contínuo
  8: 8, // Vitrine Principal — visibilidade da loja
  13: 9, // CRM — relacionamento com clientes
  14: 10, // Marketing e Promoções
  15: 11, // Analytics e Relatórios
  19: 12, // Modo Offline e Reconexão
  4: 13, // PWA / App do Cliente
  6: 14, // Login do Cliente
  5: 15, // Bônus de Instalação
  2: 16, // Central de IA (uso avançado)
  22: 17, // IA e Futuro
  7: 18, // Super Admin / Admin Master (configuração)
  20: 19, // Ferramentas Administrativas
  21: 20, // Preview Responsivo
  17: 21, // Backup e Exportação
  18: 22, // Auditoria e Segurança
  23: 23, // Auditor Sênior
};

NEXORO_TOOLS.sort(
  (a, b) => (TOOL_PRIORITY_BY_ID[a.id] ?? a.id) - (TOOL_PRIORITY_BY_ID[b.id] ?? b.id)
);

interface AdminNexoroToolsHubProps {
  onSelectTab: (tab: any) => void;
  onOpenDevicePreview?: () => void;
}

// Paleta por categoria — cada grupo de ferramentas ganha uma cor fixa e reconhecível,
// para que o usuário identifique de relance a que área do sistema a ferramenta pertence.
const CATEGORY_STYLES: Record<
  NexoroToolDefinition['category'],
  { label: string; border: string; chip: string; iconBg: string; iconBorder: string; iconText: string }
> = {
  operacao: {
    label: 'Operação',
    border: 'border-l-emerald-500/70',
    chip: 'text-emerald-300 bg-emerald-950/50 border-emerald-500/30',
    iconBg: 'bg-emerald-950/40',
    iconBorder: 'border-emerald-500/30',
    iconText: 'text-emerald-400',
  },
  inteligencia: {
    label: 'Inteligência IA',
    border: 'border-l-purple-500/70',
    chip: 'text-purple-300 bg-purple-950/50 border-purple-500/30',
    iconBg: 'bg-purple-950/40',
    iconBorder: 'border-purple-500/30',
    iconText: 'text-purple-400',
  },
  vendas: {
    label: 'Vendas & CRM',
    border: 'border-l-sky-500/70',
    chip: 'text-sky-300 bg-sky-950/50 border-sky-500/30',
    iconBg: 'bg-sky-950/40',
    iconBorder: 'border-sky-500/30',
    iconText: 'text-sky-400',
  },
  gestao: {
    label: 'Gestão',
    border: 'border-l-amber-500/70',
    chip: 'text-amber-300 bg-amber-950/50 border-amber-500/30',
    iconBg: 'bg-amber-950/40',
    iconBorder: 'border-amber-500/30',
    iconText: 'text-amber-400',
  },
  seguranca: {
    label: 'Segurança',
    border: 'border-l-rose-500/70',
    chip: 'text-rose-300 bg-rose-950/50 border-rose-500/30',
    iconBg: 'bg-rose-950/40',
    iconBorder: 'border-rose-500/30',
    iconText: 'text-rose-400',
  },
};

export const AdminNexoroToolsHub: React.FC<AdminNexoroToolsHubProps> = ({
  onSelectTab,
  onOpenDevicePreview,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredTools = NEXORO_TOOLS.filter((tool) => {
    const matchesCategory = selectedCategory === 'all' || tool.category === selectedCategory;
    if (!matchesCategory) return false;

    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      tool.title.toLowerCase().includes(q) ||
      tool.summary.toLowerCase().includes(q) ||
      tool.code.includes(q) ||
      tool.items.some((item) => item.toLowerCase().includes(q))
    );
  });

  const handleToolAction = (tool: NexoroToolDefinition) => {
    if (tool.id === 21 && onOpenDevicePreview) {
      onOpenDevicePreview();
      return;
    }
    if (tool.tabTarget) {
      onSelectTab(tool.tabTarget);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner com Identidade Visual Oficial NEXORO */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0B0B0B] via-[#121212] to-[#0B0B0B] border border-[#D4AF37]/30 p-6 sm:p-8 shadow-[0_10px_40px_rgba(0,0,0,0.8)]">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent opacity-80" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40">
                Catálogo Oficial • 24 Ferramentas Integradas
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold text-[#00C896] bg-[#00C896]/10 border border-[#00C896]/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00C896] animate-pulse" />
                100% Operacional
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight flex items-center gap-3">
              <span className="bg-gradient-to-r from-[#FFF2C6] via-[#D4AF37] to-[#AA7A1C] bg-clip-text text-transparent">
                NEXORO FOOD SYSTEM
              </span>
              <span className="text-slate-400 text-lg sm:text-2xl font-normal">| Ferramentas</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-2xl">
              "Mais que pedidos, uma experiência completa." Selecione qualquer um dos 24 módulos para monitorar, configurar e operar seu ecossistema gastronômico.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-[#151515] border border-[#2A2A2A] rounded-2xl p-3.5 text-center min-w-[100px]">
              <span className="text-2xl font-black text-[#D4AF37]">24</span>
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Módulos</span>
            </div>
            <div className="bg-[#151515] border border-[#2A2A2A] rounded-2xl p-3.5 text-center min-w-[100px]">
              <span className="text-2xl font-black text-[#00C896]">100%</span>
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Uptime</span>
            </div>
            <div className="bg-[#151515] border border-[#2A2A2A] rounded-2xl p-3.5 text-center min-w-[100px]">
              <span className="text-2xl font-black text-cyan-400">AI</span>
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Gemini V2</span>
            </div>
          </div>
        </div>

        {/* Search & Categories Bar */}
        <div className="mt-6 pt-6 border-t border-[#2A2A2A] flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-[#D4AF37] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar entre as 23 ferramentas..."
              className="w-full bg-[#151515] border border-[#2A2A2A] rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#D4AF37] transition-colors"
            />
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto no-scrollbar">
            {[
              { id: 'all', label: 'Todas (23)' },
              { id: 'operacao', label: 'Operação & KDS' },
              { id: 'inteligencia', label: 'IA & Vendas' },
              { id: 'vendas', label: 'Marketing & CRM' },
              { id: 'gestao', label: 'Gestão & CMV' },
              { id: 'seguranca', label: 'Segurança & Auditoria' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                  selectedCategory === cat.id
                    ? 'bg-[#D4AF37] text-slate-950 font-black shadow-[0_0_12px_rgba(212,175,55,0.4)]'
                    : 'bg-[#151515] text-slate-400 hover:text-white border border-[#2A2A2A]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid de Ferramentas — ordenadas por prioridade de uso, com cor por categoria
          para facilitar a leitura rápida (operação, IA, vendas, gestão, segurança) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTools.map((tool) => {
          const Icon = tool.icon;
          const cat = CATEGORY_STYLES[tool.category] || CATEGORY_STYLES.operacao;
          return (
            <div
              key={tool.id}
              className={`group relative rounded-2xl bg-[#0E0E0E] border-l-4 ${cat.border} border-t border-r border-b border-[#222222] hover:border-t-[#D4AF37]/60 hover:border-r-[#D4AF37]/60 hover:border-b-[#D4AF37]/60 p-5 transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.6)] flex flex-col justify-between`}
            >
              <div>
                {/* Top: Code, Categoria & Badge */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black text-[#D4AF37] font-mono tracking-widest bg-[#D4AF37]/10 px-2 py-0.5 rounded-md border border-[#D4AF37]/20">
                      {tool.code}
                    </span>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${cat.chip}`}>
                      {cat.label}
                    </span>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${tool.badgeColor}`}>
                      {tool.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className={`w-9 h-9 rounded-xl ${cat.iconBg} border ${cat.iconBorder} flex items-center justify-center ${cat.iconText} group-hover:scale-105 transition-all shrink-0`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </div>

                {/* Title & Summary */}
                <h3 className="text-base font-black text-white group-hover:text-[#D4AF37] transition-colors tracking-tight">
                  {tool.title}
                </h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  {tool.summary}
                </p>

                {/* Sub-items bullets from image 2 */}
                <div className="mt-3.5 pt-3.5 border-t border-[#1C1C1C] space-y-1.5">
                  {tool.items.slice(0, 4).map((item, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 text-[11px] text-slate-300">
                      <span className="text-[#D4AF37] font-black text-xs leading-none mt-0.5">•</span>
                      <span className="leading-tight">{item}</span>
                    </div>
                  ))}
                  {tool.items.length > 4 && (
                    <p className="text-[10px] text-slate-400 font-medium pl-2.5">
                      + {tool.items.length - 4} outros recursos integrados
                    </p>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-5 pt-3 border-t border-[#1A1A1A]">
                <button
                  onClick={() => handleToolAction(tool)}
                  className="w-full py-2 px-3 rounded-xl bg-[#171717] hover:bg-[#D4AF37] text-slate-300 hover:text-slate-950 text-xs font-black border border-[#2A2A2A] hover:border-[#D4AF37] transition-all flex items-center justify-center gap-1.5 group-hover:shadow-[0_0_15px_rgba(212,175,55,0.2)]"
                >
                  <span>{tool.actionLabel || 'Acessar Ferramenta'}</span>
                  <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredTools.length === 0 && (
        <div className="text-center py-16 bg-[#0E0E0E] rounded-3xl border border-[#222222] p-8">
          <Wrench className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white">Nenhuma ferramenta encontrada</h3>
          <p className="text-xs text-slate-400 mt-1">
            Tente buscar com outro termo ou selecione a categoria "Todas".
          </p>
        </div>
      )}
    </div>
  );
};
